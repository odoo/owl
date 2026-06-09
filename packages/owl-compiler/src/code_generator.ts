import { OwlError } from "@odoo/owl-core";
import { compileExpr, INTERP_REGEXP, interpolate, processExpr } from "./inline_expressions";
import {
  AST,
  ASTComponent,
  ASTDebug,
  ASTDomNode,
  ASTLog,
  ASTMulti,
  ASTTCall,
  ASTTCallBlock,
  ASTTCallSlot,
  ASTText,
  ASTTForEach,
  ForEachNoFlag,
  ASTTif,
  ASTTKey,
  ASTTOut,
  ASTTranslation,
  ASTTranslationContext,
  ASTTSet,
  ASTType,
  Attrs,
  EventHandlers,
} from "./parser";

const zero = Symbol("zero");

type BlockType = "block" | "text" | "multi" | "list" | "html";
const whitespaceRE = /\s+/g;

export interface Config {
  translateFn?: (s: string, translationCtx: string) => string;
  translatableAttributes?: string[];
  dev?: boolean;
}

interface CodeGenOptions extends Config {
  name?: string;
  hasGlobalValues: boolean;
}

// using a non-html document so that <inner/outer>HTML serializes as XML instead
// of HTML (as we will parse it as xml later)
let xmlDoc: Document;
if (typeof document !== "undefined") {
  xmlDoc = document.implementation.createDocument(null, null, null);
}

const MODS = new Set(["stop", "capture", "prevent", "self", "synthetic", "passive"]);

let nextDataIds: { [key: string]: number } = {};

function generateId(prefix: string = "") {
  nextDataIds[prefix] = (nextDataIds[prefix] || 0) + 1;
  return prefix + nextDataIds[prefix];
}

function isProp(tag: string, key: string): boolean {
  switch (tag) {
    case "input":
      return (
        key === "checked" ||
        key === "indeterminate" ||
        key === "value" ||
        key === "readonly" ||
        key === "readOnly" ||
        key === "disabled"
      );
    case "option":
      return key === "selected" || key === "disabled";
    case "textarea":
      return key === "value" || key === "readonly" || key === "readOnly" || key === "disabled";
    case "select":
      return key === "value" || key === "disabled";
    case "button":
    case "optgroup":
      return key === "disabled";
  }
  return false;
}

/**
 * Returns a template literal that evaluates to str. You can add interpolation
 * sigils into the string if required
 */
function toStringExpression(str: string) {
  return `\`${str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/, "\\${")}\``;
}

// -----------------------------------------------------------------------------
// BlockDescription
// -----------------------------------------------------------------------------

class BlockDescription {
  static nextBlockId = 1;

  varName: string;
  blockName: string;
  dynamicTagName: string | null = null;
  isRoot: boolean = false;
  hasDynamicChildren: boolean = false;
  children: BlockDescription[] = [];
  data: string[] = [];
  dom?: Node;
  currentDom?: Element;
  childNumber: number = 0;
  target: CodeTarget;
  type: BlockType;
  parentVar: string = "";
  id: number;

  constructor(target: CodeTarget, type: BlockType) {
    this.id = BlockDescription.nextBlockId++;
    this.varName = "b" + this.id;
    this.blockName = "block" + this.id;
    this.target = target;
    this.type = type;
  }

  insertData(str: string, prefix: string = "d"): number {
    const id = generateId(prefix);
    this.target.addLine(`let ${id} = ${str};`);
    return this.data.push(id) - 1;
  }

  insert(dom: Node) {
    if (this.currentDom) {
      this.currentDom.appendChild(dom);
    } else {
      this.dom = dom;
    }
  }

  generateExpr(expr: string): string {
    if (this.type === "block") {
      const hasChildren = this.children.length;
      let params = this.data.length ? `[${this.data.join(", ")}]` : hasChildren ? "[]" : "";
      if (hasChildren) {
        params += ", [" + this.children.map((c) => c.varName).join(", ") + "]";
      }
      if (this.dynamicTagName) {
        return `toggler(${this.dynamicTagName}, ${this.blockName}(${this.dynamicTagName})(${params}))`;
      }
      return `${this.blockName}(${params})`;
    } else if (this.type === "list") {
      return `list(c_block${this.id})`;
    }
    return expr;
  }

  asXmlString() {
    // Can't use outerHTML on text nodes
    // append dom to any element and use innerHTML instead
    const t = xmlDoc.createElement("t");
    t.appendChild(this.dom!);
    return t.innerHTML;
  }
}

// -----------------------------------------------------------------------------
// Compiler code
// -----------------------------------------------------------------------------

interface Context {
  block: BlockDescription | null;
  index: number | string;
  forceNewBlock: boolean;
  translate: boolean;
  translationCtx: string;
  tKeyExpr: string | null;
  nameSpace?: string;
  tModelSelectedExpr?: string;
  inPreTag?: boolean;
}

function createContext(parentCtx: Context, params?: Partial<Context>): Context {
  return Object.assign(
    {
      block: null,
      index: 0,
      forceNewBlock: true,
      translate: parentCtx.translate,
      translationCtx: parentCtx.translationCtx,
      tKeyExpr: null,
      nameSpace: parentCtx.nameSpace,
      tModelSelectedExpr: parentCtx.tModelSelectedExpr,
    },
    params
  );
}

// Matches the context lookups produced by processExpr (always single-quoted:
// `ctx['name']`). Generated context *writes* (t-foreach loop variables, t-set
// assignments) use backticks or double quotes, so this pattern only collects
// reads. Pinned by the "slot captures" compiler tests.
const CTX_READ_RE = /ctx\['([^']+)'\]/g;

class CodeTarget {
  name: string;
  indentLevel = 0;
  loopLevel = 0;
  loopCtxVars: string[] = [];
  tSetVars: Map<string, number> = new Map();
  code: string[] = [];
  hasRoot = false;
  deferReturn = false;
  needsScopeProtection = false;
  on: EventHandlers | null;
  // Every ctx key read by the code of this function, including code compiled
  // into nested targets (bubbled up by compileInNewTarget). For a slot target,
  // this is the slot content's capture set: the template-scope values whose
  // change must invalidate the component receiving the slot.
  ctxRefs: Set<string> = new Set();
  // Slot names re-rendered via a static <t t-call-slot="..."/> in this target
  // (or a nested one): the content forwards the *defining component's own*
  // incoming slot, which is captured by identity instead of by ctx reads.
  forwardedSlots: Set<string> = new Set();
  // True when this target's output can read ctx keys that cannot be statically
  // enumerated (t-call, t-out="0", t-call-slot with a dynamic name). A slot
  // compiled in such a target cannot be memoized by captures.
  hasOpaqueCtxReads = false;
  // Number of t-set compilations per variable name, in compilation (= code)
  // order. Used to detect captures that are written *after* a component call
  // site: the synthetic capture would then be evaluated before the write while
  // the (lazy) slot rendering sees the post-write value.
  tSetEvents: Map<string, number> = new Map();
  // Names written by a t-set *reassignment* (a write to an outer loop level's
  // ctx). The mutated ctx object is shared across loop iterations, so capture
  // values read at a component call site can differ from what the lazily
  // evaluated slot content sees, regardless of code order.
  reassignedVars: Set<string> = new Set();

  constructor(name: string, on?: EventHandlers | null) {
    this.name = name;
    this.on = on || null;
  }

  addLine(line: string, idx?: number) {
    const prefix = new Array(this.indentLevel + 2).join("  ");
    if (idx === undefined) {
      this.code.push(prefix + line);
    } else {
      this.code.splice(idx, 0, prefix + line);
    }
    if (line.includes("ctx['")) {
      for (const match of line.matchAll(CTX_READ_RE)) {
        this.ctxRefs.add(match[1]);
      }
    }
  }

  generateCode(): string {
    let result: string[] = [];
    result.push(`function ${this.name}(ctx, node, key = "") {`);
    if (this.needsScopeProtection) {
      result.push(`  ctx = Object.create(ctx);`);
    }
    for (let line of this.code) {
      result.push(line);
    }
    if (!this.hasRoot) {
      result.push(`return text('');`);
    }
    result.push(`}`);
    return result.join("\n  ");
  }

  currentKey(ctx: Context) {
    let key = this.loopLevel ? `key${this.loopLevel}` : "key";
    if (ctx.tKeyExpr) {
      key = `${ctx.tKeyExpr} + ${key}`;
    }
    return key;
  }
}

const TRANSLATABLE_ATTRS = [
  "alt",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
];
const translationRE = /^(\s*)([\s\S]+?)(\s*)$/;

export class CodeGenerator {
  blocks: BlockDescription[] = [];
  nextBlockId = 1;
  isDebug: boolean = false;
  targets: CodeTarget[] = [];
  target = new CodeTarget("template");
  templateName?: string;
  dev: boolean;
  translateFn: (s: string, translationCtx: string) => string;
  translatableAttributes: string[] = TRANSLATABLE_ATTRS;
  ast: AST;
  staticDefs: { id: string; expr: string }[] = [];
  slotNames: Set<String | Symbol> = new Set();
  helpers: Set<string> = new Set();
  // Component call sites whose opaque-slots flag depends on t-set writes that
  // may be compiled after them; resolved by finalizeSlotMemoization once all
  // targets are fully compiled.
  slotMemoChecks: Array<{
    def: { id: string; expr: string };
    makeExpr: (opaqueSlots: boolean) => string;
    target: CodeTarget;
    captures: Set<string>;
    tSetSnapshot: Map<string, number>;
  }> = [];
  constructor(ast: AST, options: CodeGenOptions) {
    this.translateFn = options.translateFn || ((s: string) => s);
    if (options.translatableAttributes) {
      const attrs = new Set(TRANSLATABLE_ATTRS);
      for (let attr of options.translatableAttributes) {
        if (attr.startsWith("-")) {
          attrs.delete(attr.slice(1));
        } else {
          attrs.add(attr);
        }
      }
      this.translatableAttributes = [...attrs];
    }
    this.dev = options.dev || false;
    this.ast = ast;
    this.templateName = options.name;
    if (options.name) {
      if (options.name.startsWith("__")) {
        this.target.name = options.name;
      } else {
        this.target.name = `template_${options.name.replace(/[^a-zA-Z0-9_$]/g, "_")}`;
      }
    }
    if (options.hasGlobalValues) {
      this.helpers.add("__globals__");
    }
  }

  generateCode(): string {
    const ast = this.ast;
    this.isDebug = ast.type === ASTType.TDebug;
    BlockDescription.nextBlockId = 1;
    nextDataIds = {};
    this.compileAST(ast, {
      block: null,
      index: 0,
      forceNewBlock: false,
      translate: true,
      translationCtx: "",
      tKeyExpr: null,
    });
    this.finalizeSlotMemoization();
    // define blocks and utility functions
    let mainCode = [`  let { text, createBlock, list, multi, html, toggler } = bdom;`];
    if (this.helpers.size) {
      mainCode.push(`let { ${[...this.helpers].join(", ")} } = helpers;`);
    }
    if (this.templateName) {
      mainCode.push(`// Template name: "${this.templateName}"`);
    }

    for (let { id, expr } of this.staticDefs) {
      mainCode.push(`const ${id} = ${expr};`);
    }

    // define all blocks
    if (this.blocks.length) {
      mainCode.push(``);
      for (let block of this.blocks) {
        if (block.dom) {
          let xmlString = toStringExpression(block.asXmlString());
          if (block.dynamicTagName) {
            xmlString = xmlString.replace(/^`<\w+/, `\`<\${tag || '${block.dom.nodeName}'}`);
            xmlString = xmlString.replace(/\w+>`$/, `\${tag || '${block.dom.nodeName}'}>\``);
            mainCode.push(`let ${block.blockName} = tag => createBlock(${xmlString});`);
          } else {
            mainCode.push(`let ${block.blockName} = createBlock(${xmlString});`);
          }
        }
      }
    }

    // define all slots/defaultcontent function
    if (this.targets.length) {
      for (let fn of this.targets) {
        mainCode.push("");
        mainCode = mainCode.concat(fn.generateCode());
      }
    }

    // generate main code
    mainCode.push("");
    mainCode = mainCode.concat("return " + this.target.generateCode());
    const code = mainCode.join("\n  ");

    if (this.isDebug) {
      const msg = `[Owl Debug]\n${code}`;
      console.log(msg);
    }
    return code;
  }

  /**
   * Resolves the deferred opaque-slots flag of component call sites: a call
   * site whose slot captures include a variable that is t-set after it (or
   * reassigned across loop iterations) cannot rely on captures read at the
   * call site, and falls back to always re-rendering the child.
   */
  finalizeSlotMemoization() {
    for (const check of this.slotMemoChecks) {
      let opaqueSlots = false;
      for (const varName of check.captures) {
        if (
          check.target.reassignedVars.has(varName) ||
          (check.target.tSetEvents.get(varName) || 0) > (check.tSetSnapshot.get(varName) || 0)
        ) {
          opaqueSlots = true;
          break;
        }
      }
      check.def.expr = check.makeExpr(opaqueSlots);
    }
  }

  compileInNewTarget(
    prefix: string,
    ast: AST,
    ctx: Context,
    on?: EventHandlers | null
  ): CodeTarget {
    const name = generateId(prefix);
    const initialTarget = this.target;
    const target = new CodeTarget(name, on);
    this.targets.push(target);
    this.target = target;
    this.compileAST(ast, createContext(ctx));
    this.target = initialTarget;
    // The new target's function is evaluated lazily but against the enclosing
    // scope chain (slot __ctx, LazyValue/t-call body bound ctx), so whatever it
    // reads from ctx is also read -- transitively -- by the enclosing target.
    for (const varName of target.ctxRefs) {
      initialTarget.ctxRefs.add(varName);
    }
    for (const slotName of target.forwardedSlots) {
      initialTarget.forwardedSlots.add(slotName);
    }
    if (target.hasOpaqueCtxReads) {
      initialTarget.hasOpaqueCtxReads = true;
    }
    return target;
  }

  addLine(line: string, idx?: number) {
    this.target.addLine(line, idx);
  }

  define(varName: string, expr: string) {
    this.addLine(`const ${varName} = ${expr};`);
  }

  insertAnchor(block: BlockDescription, index: number = block.children.length) {
    const tag = `block-child-${index}`;
    const anchor = xmlDoc.createElement(tag);
    block.insert(anchor);
  }

  createBlock(
    parentBlock: BlockDescription | null,
    type: BlockType,
    ctx: Context
  ): BlockDescription {
    const hasRoot = this.target.hasRoot;
    const block = new BlockDescription(this.target, type);
    if (!hasRoot) {
      this.target.hasRoot = true;
      block.isRoot = true;
    }
    if (parentBlock) {
      parentBlock.children.push(block);
      if (parentBlock.type === "list") {
        block.parentVar = `c_block${parentBlock.id}`;
      }
    }
    return block;
  }

  insertBlock(expression: string, block: BlockDescription, ctx: Context): void {
    let blockExpr = block.generateExpr(expression);
    if (block.parentVar) {
      let key = this.target.currentKey(ctx);
      this.helpers.add("withKey");
      this.addLine(`${block.parentVar}[${ctx.index}] = withKey(${blockExpr}, ${key});`);
      return;
    }

    if (ctx.tKeyExpr) {
      blockExpr = `toggler(${ctx.tKeyExpr}, ${blockExpr})`;
    }

    if (block.isRoot && !this.target.deferReturn) {
      if (this.target.on) {
        blockExpr = this.wrapWithEventCatcher(blockExpr, this.target.on);
      }
      this.addLine(`return ${blockExpr};`);
    } else {
      this.define(block.varName, blockExpr);
    }
  }

  translate(str: string, translationCtx: string): string {
    const match = translationRE.exec(str) as any;
    return match[1] + this.translateFn(match[2], translationCtx) + match[3];
  }

  /**
   * @returns the newly created block name, if any
   */
  compileAST(ast: AST, ctx: Context): string | null {
    switch (ast.type) {
      case ASTType.Text:
        return this.compileText(ast, ctx);
      case ASTType.DomNode:
        return this.compileTDomNode(ast, ctx);
      case ASTType.TOut:
        return this.compileTOut(ast, ctx);
      case ASTType.TIf:
        return this.compileTIf(ast, ctx);
      case ASTType.TForEach:
        return this.compileTForeach(ast, ctx);
      case ASTType.TKey:
        return this.compileTKey(ast, ctx);
      case ASTType.Multi:
        return this.compileMulti(ast, ctx);
      case ASTType.TCall:
        return this.compileTCall(ast, ctx);
      case ASTType.TCallBlock:
        return this.compileTCallBlock(ast, ctx);
      case ASTType.TSet:
        return this.compileTSet(ast, ctx);
      case ASTType.TComponent:
        return this.compileComponent(ast, ctx);
      case ASTType.TDebug:
        return this.compileDebug(ast, ctx);
      case ASTType.TLog:
        return this.compileLog(ast, ctx);
      case ASTType.TCallSlot:
        return this.compileTCallSlot(ast, ctx);
      case ASTType.TTranslation:
        return this.compileTTranslation(ast, ctx);
      case ASTType.TTranslationContext:
        return this.compileTTranslationContext(ast, ctx);
    }
  }

  compileDebug(ast: ASTDebug, ctx: Context): string | null {
    this.addLine(`debugger;`);
    if (ast.content) {
      return this.compileAST(ast.content, ctx);
    }
    return null;
  }

  compileLog(ast: ASTLog, ctx: Context): string | null {
    this.addLine(`console.log(${compileExpr(ast.expr)});`);
    if (ast.content) {
      return this.compileAST(ast.content, ctx);
    }
    return null;
  }
  compileText(ast: ASTText, ctx: Context): string {
    let { block, forceNewBlock } = ctx;

    let value = ast.value;
    if (value && ctx.translate !== false) {
      value = this.translate(value, ctx.translationCtx);
    }
    if (!ctx.inPreTag) {
      value = value.replace(whitespaceRE, " ");
    }

    if (!block || forceNewBlock) {
      block = this.createBlock(block, "text", ctx);
      this.insertBlock(`text(${toStringExpression(value)})`, block, {
        ...ctx,
        forceNewBlock: forceNewBlock && !block,
      });
    } else {
      const createFn = ast.type === ASTType.Text ? xmlDoc.createTextNode : xmlDoc.createComment;
      block.insert(createFn.call(xmlDoc, value));
    }
    return block.varName;
  }

  generateHandlerCode(rawEvent: string, handler: string): string {
    const modifiers = rawEvent
      .split(".")
      .slice(1)
      .map((m) => {
        if (!MODS.has(m)) {
          throw new OwlError(`Unknown event modifier: '${m}'`);
        }
        return `"${m}"`;
      });
    let modifiersCode = "";
    if (modifiers.length) {
      modifiersCode = `${modifiers.join(",")}, `;
    }

    const compiled = compileExpr(handler);
    // handlers are hoisted into staticDefs, bypassing addLine: collect their
    // ctx reads here (the handler runs against the captured ctx, so its reads
    // belong to the capture set of an enclosing slot)
    for (const match of compiled.matchAll(CTX_READ_RE)) {
      this.target.ctxRefs.add(match[1]);
    }
    if (!compiled.trim()) {
      return `[${modifiersCode}, ctx]`;
    }

    let hoistedExpr: string;
    const arrowMatch = compiled.match(/^(\([^)]*\))\s*=>/);
    const bareArrowMatch = !arrowMatch && compiled.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/);

    if (arrowMatch) {
      const inner = arrowMatch[1].slice(1, -1).trim();
      const rest = compiled.slice(arrowMatch[0].length);
      hoistedExpr = inner ? `(ctx,${inner})=>${rest}` : `(ctx)=>${rest}`;
    } else if (bareArrowMatch) {
      const rest = compiled.slice(bareArrowMatch[0].length);
      hoistedExpr = `(ctx,${bareArrowMatch[1]})=>${rest}`;
    } else {
      this.helpers.add("callHandler");
      hoistedExpr = `(ctx, ev) => callHandler(${compiled}, ctx, ev)`;
    }

    const id = generateId("hdlr_fn");
    this.staticDefs.push({ id, expr: hoistedExpr });
    return `[${modifiersCode}${id}, ctx]`;
  }

  compileTDomNode(ast: ASTDomNode, ctx: Context): string {
    let { block, forceNewBlock } = ctx;
    const isNewBlock = !block || forceNewBlock || ast.dynamicTag !== null || ast.ns;
    let codeIdx = this.target.code.length;
    if (isNewBlock) {
      if ((ast.dynamicTag || ctx.tKeyExpr || ast.ns) && ctx.block) {
        this.insertAnchor(ctx.block!);
      }
      block = this.createBlock(block, "block", ctx);
      this.blocks.push(block);
      if (ast.dynamicTag) {
        const tagExpr = generateId("tag");
        this.define(tagExpr, compileExpr(ast.dynamicTag));
        block.dynamicTagName = tagExpr;
      }
    }
    // attributes
    const attrs: Attrs = {};

    for (let key in ast.attrs) {
      let expr, attrName;
      if (key.startsWith("t-attf")) {
        expr = interpolate(ast.attrs[key]);
        const idx = block!.insertData(expr, "attr");

        attrName = key.slice(7);
        attrs["block-attribute-" + idx] = attrName;
      } else if (key.startsWith("t-att")) {
        attrName = key === "t-att" ? null : key.slice(6);
        expr = compileExpr(ast.attrs[key]);
        if (attrName && isProp(ast.tag, attrName)) {
          if (attrName === "readonly") {
            // the property has a different name than the attribute
            attrName = "readOnly";
          }
          // we force a new string or new boolean to bypass the equality check in blockdom when patching same value
          if (attrName === "value") {
            // When the expression is falsy (except 0), fall back to an empty string
            expr = `new String((${expr}) === 0 ? 0 : ((${expr}) || ""))`;
          } else {
            expr = `new Boolean(${expr})`;
          }
          const idx = block!.insertData(expr, "prop");
          attrs[`block-property-${idx}`] = attrName!;
        } else {
          const idx = block!.insertData(expr, "attr");
          if (key === "t-att") {
            attrs[`block-attributes`] = String(idx);
          } else {
            attrs[`block-attribute-${idx}`] = attrName!;
          }
        }
      } else if (this.translatableAttributes.includes(key)) {
        const attrTranslationCtx = ast.attrsTranslationCtx?.[key] || ctx.translationCtx;
        attrs[key] = this.translateFn(ast.attrs[key], attrTranslationCtx);
      } else {
        expr = `"${ast.attrs[key]}"`;
        attrName = key;
        attrs[key] = ast.attrs[key];
      }

      if (attrName === "value" && ctx.tModelSelectedExpr) {
        let selectedId = block!.insertData(`${ctx.tModelSelectedExpr} === ${expr}`, "attr");
        attrs[`block-attribute-${selectedId}`] = "selected";
      }
    }

    // t-model
    let tModelSelectedExpr;
    if (ast.model) {
      const {
        hasDynamicChildren,
        expr,
        eventType,
        shouldNumberize,
        shouldTrim,
        targetAttr,
        specialInitTargetAttr,
        isProxy,
      } = ast.model;

      let readExpr: string;
      let writeExpr: (value: string) => string;
      if (isProxy) {
        const expression = compileExpr(expr);
        readExpr = expression;
        writeExpr = (value) => `${expression} = ${value}`;
      } else {
        const exprId = generateId("expr");
        const expression = compileExpr(expr);
        this.helpers.add("modelExpr");
        this.define(exprId, `modelExpr(${expression})`);
        readExpr = `${exprId}()`;
        writeExpr = (value) => `${exprId}.set(${value})`;
      }

      let idx: number;
      if (specialInitTargetAttr) {
        let targetExpr = targetAttr in attrs && `'${attrs[targetAttr]}'`;
        if (!targetExpr && ast.attrs) {
          // look at the dynamic attribute counterpart
          const dynamicTgExpr = ast.attrs[`t-att-${targetAttr}`];
          if (dynamicTgExpr) {
            targetExpr = compileExpr(dynamicTgExpr);
          }
        }
        idx = block!.insertData(`${readExpr} === ${targetExpr}`, "prop");
        attrs[`block-property-${idx}`] = specialInitTargetAttr;
      } else if (hasDynamicChildren) {
        const bValueId = generateId("bValue");
        tModelSelectedExpr = `${bValueId}`;
        this.define(tModelSelectedExpr, readExpr);
      } else {
        idx = block!.insertData(readExpr, "prop");
        attrs[`block-property-${idx}`] = targetAttr;
      }
      this.helpers.add("toNumber");
      let valueCode = `ev.target.${targetAttr}`;
      valueCode = shouldTrim ? `${valueCode}.trim()` : valueCode;
      valueCode = shouldNumberize ? `toNumber(${valueCode})` : valueCode;

      const handler = `[(ctx, ev) => { ${writeExpr(valueCode)}; }, ctx]`;
      idx = block!.insertData(handler, "hdlr");
      attrs[`block-handler-${idx}`] = eventType;
    }

    // event handlers
    for (let ev in ast.on) {
      const name = this.generateHandlerCode(ev, ast.on[ev]);
      const idx = block!.insertData(name, "hdlr");
      attrs[`block-handler-${idx}`] = ev;
    }

    // t-ref
    if (ast.ref) {
      const refExpr = compileExpr(ast.ref);
      this.helpers.add("createRef");
      const setRefStr = `createRef(${refExpr})`;
      const idx = block!.insertData(setRefStr, "ref");
      attrs["block-ref"] = String(idx);
    }

    const nameSpace = ast.ns || ctx.nameSpace;
    const dom = nameSpace
      ? xmlDoc.createElementNS(nameSpace, ast.tag)
      : xmlDoc.createElement(ast.tag);
    for (const [attr, val] of Object.entries(attrs)) {
      if (!(attr === "class" && val === "")) {
        dom.setAttribute(attr, val);
      }
    }
    block!.insert(dom);
    if (ast.content.length) {
      const initialDom = block!.currentDom;
      block!.currentDom = dom;
      const children = ast.content;
      for (let i = 0; i < children.length; i++) {
        const child = ast.content[i];
        const subCtx = createContext(ctx, {
          block,
          index: block!.childNumber,
          forceNewBlock: false,
          tKeyExpr: ctx.tKeyExpr,
          nameSpace,
          tModelSelectedExpr,
          inPreTag: ctx.inPreTag || ast.tag === "pre",
        });
        this.compileAST(child, subCtx);
      }
      block!.currentDom = initialDom;
    }

    if (isNewBlock) {
      this.insertBlock(`${block!.blockName}(ddd)`, block!, ctx)!;
      // may need to rewrite code!
      if (block!.children.length && block!.hasDynamicChildren) {
        const code = this.target.code;
        const children = block!.children.slice();
        let current = children.shift();
        for (let i = codeIdx; i < code.length; i++) {
          if (code[i].trimStart().startsWith(`const ${current!.varName} `)) {
            code[i] = code[i].replace(`const ${current!.varName}`, current!.varName);
            current = children.shift();
            if (!current) break;
          }
        }
        this.addLine(`let ${block!.children.map((c) => c.varName).join(", ")};`, codeIdx);
      }
    }
    return block!.varName;
  }

  compileZero() {
    this.helpers.add("zero");
    // ctx[zero] is a t-call body bound by the caller under a symbol key: it
    // cannot be captured by name, so the enclosing target is not memoizable
    this.target.hasOpaqueCtxReads = true;
    const isMultiple = this.slotNames.has(zero);
    this.slotNames.add(zero);
    let key = this.target.loopLevel ? `key${this.target.loopLevel}` : "key";
    if (isMultiple) {
      key = this.generateComponentKey(key);
    }
    return `ctx[zero]?.(node, ${key}) || text("")`;
  }

  compileTOut(ast: ASTTOut, ctx: Context): string {
    let { block } = ctx;
    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "html", ctx);
    let blockStr;
    if (ast.expr === "0") {
      blockStr = this.compileZero();
    } else if (ast.body) {
      let bodyValue = null;
      bodyValue = BlockDescription.nextBlockId;
      const subCtx = createContext(ctx);
      this.compileAST({ type: ASTType.Multi, content: ast.body }, subCtx);
      this.helpers.add("safeOutput");
      blockStr = `safeOutput(${compileExpr(ast.expr)}, b${bodyValue})`;
    } else {
      this.helpers.add("safeOutput");
      blockStr = `safeOutput(${compileExpr(ast.expr)})`;
    }
    this.insertBlock(blockStr, block, ctx);
    return block.varName;
  }

  compileTIfBranch(content: AST, block: BlockDescription, ctx: Context) {
    this.target.indentLevel++;
    let childN = block.children.length;
    this.compileAST(content, createContext(ctx, { block, index: ctx.index }));
    if (block.children.length > childN) {
      // we have some content => need to insert an anchor at correct index
      this.insertAnchor(block!, childN);
    }
    this.target.indentLevel--;
  }

  compileTIf(ast: ASTTif, ctx: Context, nextNode?: ASTDomNode): string {
    let { block, forceNewBlock } = ctx;
    const codeIdx = this.target.code.length;
    const isNewBlock = !block || (block.type !== "multi" && forceNewBlock);
    if (block) {
      block.hasDynamicChildren = true;
    }
    if (!block || (block.type !== "multi" && forceNewBlock)) {
      block = this.createBlock(block, "multi", ctx);
    }
    this.addLine(`if (${compileExpr(ast.condition)}) {`);
    this.compileTIfBranch(ast.content, block, ctx);
    if (ast.tElif) {
      for (let clause of ast.tElif) {
        this.addLine(`} else if (${compileExpr(clause.condition)}) {`);
        this.compileTIfBranch(clause.content, block, ctx);
      }
    }
    if (ast.tElse) {
      this.addLine(`} else {`);
      this.compileTIfBranch(ast.tElse, block, ctx);
    }
    this.addLine("}");
    if (isNewBlock) {
      // note: this part is duplicated from end of compiledomnode:
      if (block!.children.length) {
        const code = this.target.code;
        const children = block!.children.slice();
        let current = children.shift();
        for (let i = codeIdx; i < code.length; i++) {
          if (code[i].trimStart().startsWith(`const ${current!.varName} `)) {
            code[i] = code[i].replace(`const ${current!.varName}`, current!.varName);
            current = children.shift();
            if (!current) break;
          }
        }
        this.addLine(`let ${block!.children.map((c) => c.varName).join(", ")};`, codeIdx);
      }

      // note: this part is duplicated from end of compilemulti:
      const args = block!.children.map((c) => c.varName).join(", ");
      this.insertBlock(`multi([${args}])`, block!, ctx)!;
    }
    return block.varName;
  }

  compileTForeach(ast: ASTTForEach, ctx: Context): string {
    let { block } = ctx;
    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "list", ctx);
    this.target.loopLevel++;
    const loopVar = `i${this.target.loopLevel}`;
    const ctxVar = generateId("ctx");
    this.addLine(`const ${ctxVar} = ctx;`);
    this.target.loopCtxVars.push(ctxVar);
    const vals = `v_block${block.id}`;
    const keys = `k_block${block.id}`;
    const l = `l_block${block.id}`;
    const c = `c_block${block.id}`;
    this.helpers.add("prepareList");
    this.define(`[${keys}, ${vals}, ${l}, ${c}]`, `prepareList(${compileExpr(ast.collection)});`);
    // Throw errors on duplicate keys in dev mode
    if (this.dev) {
      this.define(`keys${block.id}`, `new Set()`);
    }
    this.addLine(`for (let ${loopVar} = 0; ${loopVar} < ${l}; ${loopVar}++) {`);
    this.target.indentLevel++;
    this.addLine(`let ctx = Object.create(${ctxVar});`);
    this.addLine(`ctx[\`${ast.elem}\`] = ${keys}[${loopVar}];`);
    if (!(ast.noFlags & ForEachNoFlag.First)) {
      this.addLine(`ctx[\`${ast.elem}_first\`] = ${loopVar} === 0;`);
    }
    if (!(ast.noFlags & ForEachNoFlag.Last)) {
      this.addLine(`ctx[\`${ast.elem}_last\`] = ${loopVar} === ${keys}.length - 1;`);
    }
    if (!(ast.noFlags & ForEachNoFlag.Index)) {
      this.addLine(`ctx[\`${ast.elem}_index\`] = ${loopVar};`);
    }
    if (!(ast.noFlags & ForEachNoFlag.Value)) {
      this.addLine(`ctx[\`${ast.elem}_value\`] = ${vals}[${loopVar}];`);
    }
    this.define(`key${this.target.loopLevel}`, ast.key ? compileExpr(ast.key) : loopVar);
    if (this.dev) {
      // Throw error on duplicate keys in dev mode
      this.helpers.add("OwlError");
      this.addLine(
        `if (keys${block.id}.has(String(key${this.target.loopLevel}))) { throw new OwlError(\`Got duplicate key in t-foreach: \${key${this.target.loopLevel}}\`)}`
      );
      this.addLine(`keys${block.id}.add(String(key${this.target.loopLevel}));`);
    }

    const subCtx = createContext(ctx, { block, index: loopVar });
    this.compileAST(ast.body, subCtx);
    this.target.indentLevel--;
    this.target.loopLevel--;
    this.target.loopCtxVars.pop();
    this.addLine(`}`);
    this.insertBlock("l", block, ctx);
    return block.varName;
  }

  compileTKey(ast: ASTTKey, ctx: Context): string | null {
    const tKeyExpr = generateId("tKey_");
    this.define(tKeyExpr, compileExpr(ast.expr));
    ctx = createContext(ctx, {
      tKeyExpr,
      block: ctx.block,
      index: ctx.index,
    });
    return this.compileAST(ast.content, ctx);
  }

  compileMulti(ast: ASTMulti, ctx: Context): string | null {
    let { block, forceNewBlock } = ctx;
    const isNewBlock = !block || forceNewBlock;
    let codeIdx = this.target.code.length;
    if (isNewBlock) {
      const n = ast.content.filter((c) => !c.hasNoRepresentation).length;
      let result: string | null = null;
      if (n <= 1) {
        // Check if there are non-DOM directives (like t-set) after the DOM child.
        // If so, defer the return so those directives are compiled before it.
        const shouldDefer =
          !this.target.hasRoot && ast.content[ast.content.length - 1].hasNoRepresentation;
        if (shouldDefer) {
          this.target.deferReturn = true;
        }
        for (let child of ast.content) {
          const blockName = this.compileAST(child, ctx);
          result = result || blockName;
        }
        if (shouldDefer) {
          this.target.deferReturn = false;
          this.addLine(`return ${result};`);
        }
        return result;
      }
      block = this.createBlock(block, "multi", ctx);
    }
    let index = 0;
    for (let i = 0, l = ast.content.length; i < l; i++) {
      const child = ast.content[i];
      const forceNewBlock = !child.hasNoRepresentation;
      const subCtx = createContext(ctx, {
        block,
        index,
        forceNewBlock,
      });
      this.compileAST(child, subCtx);
      if (forceNewBlock) {
        index++;
      }
    }
    if (isNewBlock) {
      if (block!.hasDynamicChildren && block!.children.length) {
        const code = this.target.code;
        const children = block!.children.slice();
        let current = children.shift();
        for (let i = codeIdx; i < code.length; i++) {
          if (code[i].trimStart().startsWith(`const ${current!.varName} `)) {
            code[i] = code[i].replace(`const ${current!.varName}`, current!.varName);
            current = children.shift();
            if (!current) break;
          }
        }
        this.addLine(`let ${block!.children.map((c) => c.varName).join(", ")};`, codeIdx);
      }

      const args = block!.children.map((c) => c.varName).join(", ");
      this.insertBlock(`multi([${args}])`, block!, ctx)!;
    }
    return block!.varName;
  }

  compileTCall(ast: ASTTCall, ctx: Context): string {
    let { block, forceNewBlock } = ctx;

    // the called template is resolved at runtime (and can be overridden per
    // App), so the set of ctx keys it reads through the scope chain cannot be
    // enumerated here
    this.target.hasOpaqueCtxReads = true;

    const attrs: string[] = ast.attrs
      ? this.formatPropObject(ast.attrs, ast.attrsTranslationCtx, ctx.translationCtx)
      : [];
    const isDynamic = INTERP_REGEXP.test(ast.name);
    const subTemplate = isDynamic ? interpolate(ast.name) : "`" + ast.name + "`";
    if (block && !forceNewBlock) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "multi", ctx);
    if (ast.body) {
      const name = this.compileInNewTarget("callBody", ast.body, ctx).name;
      const zeroStr = generateId("lazyBlock");
      this.define(zeroStr, `${name}.bind(this, ctx)`);
      this.helpers.add("zero");
      attrs.push(`[zero]: ${zeroStr}`);
    }

    let ctxExpr: string;
    const ctxString = `{${attrs.join(", ")}}`;
    if (ast.context) {
      const dynCtxVar = generateId("ctx");
      this.addLine(`const ${dynCtxVar} = ${compileExpr(ast.context)};`);
      if (attrs.length) {
        ctxExpr = `Object.assign({this: ${dynCtxVar}}, ${ctxString})`;
      } else {
        ctxExpr = `{this: ${dynCtxVar}}`;
      }
    } else {
      if (attrs.length === 0) {
        ctxExpr = "ctx";
      } else {
        ctxExpr = `Object.assign(Object.create(ctx), ${ctxString})`;
      }
    }
    const key = this.generateComponentKey();
    this.helpers.add("callTemplate");
    this.insertBlock(`callTemplate(${subTemplate}, this, app, ${ctxExpr}, node, ${key})`, block!, {
      ...ctx,
      forceNewBlock: !block,
    });
    return block.varName;
  }

  compileTCallBlock(ast: ASTTCallBlock, ctx: Context): string {
    let { block, forceNewBlock } = ctx;
    if (block) {
      if (!forceNewBlock) {
        this.insertAnchor(block);
      }
    }
    block = this.createBlock(block, "multi", ctx);
    this.insertBlock(compileExpr(ast.name), block, { ...ctx, forceNewBlock: !block });
    return block.varName;
  }

  compileTSet(ast: ASTTSet, ctx: Context): null {
    // record the write event (in compilation = code order) so component call
    // sites can detect captures that are written after them (see
    // finalizeSlotMemoization)
    const tSetEvents = this.target.tSetEvents;
    tSetEvents.set(ast.name, (tSetEvents.get(ast.name) || 0) + 1);
    const expr = ast.value ? compileExpr(ast.value || "") : "null";
    const isOuterScope = this.target.loopLevel === 0;
    const defLevel = this.target.tSetVars.get(ast.name);
    const isReassignment = defLevel !== undefined && this.target.loopLevel > defLevel;
    if (isReassignment) {
      this.target.reassignedVars.add(ast.name);
    }
    if (ast.body) {
      this.helpers.add("LazyValue");
      const bodyAst: AST = { type: ASTType.Multi, content: ast.body };
      const name = this.compileInNewTarget("value", bodyAst, ctx).name;
      let key = this.target.currentKey(ctx);
      let value = `new LazyValue(${name}, ctx, this, node, ${key})`;
      value = ast.value ? (value ? `withDefault(${expr}, ${value})` : expr) : value;
      this.helpers.add("withDefault");
      if (isReassignment) {
        const ctxVar = this.target.loopCtxVars[defLevel];
        this.addLine(`${ctxVar}[\`${ast.name}\`] = ${value};`);
      } else if (isOuterScope) {
        this.target.needsScopeProtection = true;
        this.addLine(`ctx[\`${ast.name}\`] = ${value};`);
        this.target.tSetVars.set(ast.name, 0);
      } else {
        this.addLine(`ctx[\`${ast.name}\`] = ${value};`);
        this.target.tSetVars.set(ast.name, this.target.loopLevel);
      }
    } else {
      let value: string;
      if (ast.defaultValue) {
        const defaultValue = toStringExpression(
          ctx.translate ? this.translate(ast.defaultValue, ctx.translationCtx) : ast.defaultValue
        );
        if (ast.value) {
          this.helpers.add("withDefault");
          value = `withDefault(${expr}, ${defaultValue})`;
        } else {
          value = defaultValue;
        }
      } else {
        value = expr;
      }
      if (isReassignment) {
        const ctxVar = this.target.loopCtxVars[defLevel];
        this.addLine(`${ctxVar}["${ast.name}"] = ${value};`);
      } else if (isOuterScope) {
        this.target.needsScopeProtection = true;
        this.addLine(`ctx["${ast.name}"] = ${value};`);
        this.target.tSetVars.set(ast.name, 0);
      } else {
        this.addLine(`ctx["${ast.name}"] = ${value};`);
        this.target.tSetVars.set(ast.name, this.target.loopLevel);
      }
    }
    return null;
  }

  generateComponentKey(currentKey: string = "key") {
    const parts = [generateId("__")];
    for (let i = 0; i < this.target.loopLevel; i++) {
      parts.push(`\${key${i + 1}}`);
    }
    return `${currentKey} + \`${parts.join("__")}\``;
  }

  generateSignalCacheKey() {
    const parts = [generateId("__sig_")];
    for (let i = 0; i < this.target.loopLevel; i++) {
      parts.push(`\${key${i + 1}}`);
    }
    return `\`${parts.join("__")}\``;
  }

  /**
   * Formats a prop name and value into a string suitable to be inserted in the
   * generated code. For example:
   *
   * Name              Value            Result
   * ---------------------------------------------------------
   * "number"          "state"          "number: ctx['state']"
   * "something"       ""               "something: undefined"
   * "some-prop"       "state"          "'some-prop': ctx['state']"
   * "onClick.bind"    "onClick"        "onClick: bind(ctx, ctx['onClick'])"
   */
  formatProp(
    name: string,
    value: string,
    attrsTranslationCtx: { [name: string]: string } | null,
    translationCtx: string
  ): string {
    if (name.endsWith(".translate")) {
      const attrTranslationCtx = attrsTranslationCtx?.[name] || translationCtx;
      value = toStringExpression(this.translateFn(value, attrTranslationCtx));
    } else {
      value = compileExpr(value);
    }
    if (name.includes(".")) {
      let [_name, suffix] = name.split(".");
      name = _name;
      switch (suffix) {
        case "bind":
          value = `(${value}).bind(this)`;
          break;
        case "alike":
        case "translate":
          break;
        default:
          throw new OwlError(`Invalid prop suffix: ${suffix}`);
      }
    }
    name = /^[a-z_]+$/i.test(name) ? name : `'${name}'`;
    return `${name}: ${value || undefined}`;
  }

  formatPropObject(
    obj: { [prop: string]: any },
    attrsTranslationCtx: { [name: string]: string } | null,
    translationCtx: string
  ): string[] {
    return Object.entries(obj).map(([k, v]) =>
      this.formatProp(k, v, attrsTranslationCtx, translationCtx)
    );
  }

  getPropString(props: string[], dynProps: string | null): string {
    let propString = `{${props.join(",")}}`;
    if (dynProps) {
      propString = `Object.assign({}, ${compileExpr(dynProps)}${
        props.length ? ", " + propString : ""
      })`;
    }
    return propString;
  }

  compileComponent(ast: ASTComponent, ctx: Context): string {
    let { block } = ctx;
    // props
    const hasSlotsProp = "slots" in (ast.props || {});
    const props: string[] = [];
    const propList: string[] = [];

    for (let p in ast.props || {}) {
      let [name, suffix] = p.split(".");

      if (suffix === "signal") {
        const compiledValue = compileExpr(ast.props![p]);
        const propName = /^[a-z_]+$/i.test(name) ? name : `'${name}'`;
        this.helpers.add("toSignal");
        const cacheKey = this.generateSignalCacheKey();
        props.push(`${propName}: toSignal(node, ${cacheKey}, ${compiledValue})`);
        continue;
      }

      if (suffix) {
        // .alike, .bind, .translate — delegate to formatProp, no propList entry
        props.push(this.formatProp(p, ast.props![p], ast.propsTranslationCtx, ctx.translationCtx));
        continue;
      }

      const { expr: compiledValue, freeVariables } = processExpr(ast.props![p]);

      const propName = /^[a-z_]+$/i.test(name) ? name : `'${name}'`;
      props.push(`${propName}: ${compiledValue || undefined}`);

      if (freeVariables) {
        for (const varName of freeVariables) {
          const syntheticKey = `\x01${name}.${varName}`;
          propList.push(`"${syntheticKey}"`);
          props.push(`"${syntheticKey}": ctx['${varName}']`);
        }
      } else {
        propList.push(`"${name}"`);
      }
    }

    // slots
    let slotDef: string = "";
    const slotCaptures: Set<string> = new Set();
    const slotForwards: Set<string> = new Set();
    let hasOpaqueSlots = false;
    if (ast.slots) {
      let slotStr: string[] = [];
      for (let slotName in ast.slots) {
        const slotAst = ast.slots[slotName];
        const params = [];
        if (slotAst.content) {
          const target = this.compileInNewTarget("slot", slotAst.content, ctx, slotAst.on);
          params.push(`__render: ${target.name}.bind(this), __ctx: ctx`);
          const scope = slotAst.scope;
          for (const varName of target.ctxRefs) {
            // the slot-scope variable is bound by callSlot at evaluation, not
            // captured from the enclosing scope
            if (varName !== scope) {
              slotCaptures.add(varName);
            }
          }
          for (const name of target.forwardedSlots) {
            slotForwards.add(name);
          }
          hasOpaqueSlots = hasOpaqueSlots || target.hasOpaqueCtxReads;
        }
        const scope = slotAst.scope;
        if (scope) {
          params.push(`__scope: "${scope}"`);
        }
        const attrs = slotAst.attrs;
        if (attrs) {
          for (const attrName in attrs) {
            const [paramName, paramSuffix] = attrName.split(".");
            if (paramSuffix && paramSuffix !== "bind") {
              // .translate values are static and .alike explicitly opts out
              // of comparison; unknown suffixes throw in formatProp
              params.push(
                this.formatProp(
                  attrName,
                  attrs[attrName],
                  slotAst.attrsTranslationCtx,
                  ctx.translationCtx
                )
              );
              continue;
            }
            // slot params are evaluated in the parent scope and read by the
            // child through props.slots: hoist each value so it can be shared
            // between the slot object and its memoization synthetic. For
            // .bind, the synthetic compares the unbound function: a stable
            // identity keeps the (behaviorally identical) bound wrapper
            // memoized.
            const paramVar = generateId("slotParam");
            this.define(paramVar, compileExpr(attrs[attrName]) || "undefined");
            const quotedName = /^[a-z_]+$/i.test(paramName) ? paramName : `'${paramName}'`;
            params.push(`${quotedName}: ${paramSuffix ? `${paramVar}.bind(this)` : paramVar}`);
            const syntheticKey = `"\x01slots.${slotName}.@${paramName}"`;
            props.push(`${syntheticKey}: ${paramVar}`);
            propList.push(syntheticKey);
          }
        }
        const slotInfo = `{${params.join(", ")}}`;
        slotStr.push(`'${slotName}': ${slotInfo}`);
      }
      slotDef = `{${slotStr.join(", ")}}`;
    }

    if (ast.slots && !hasOpaqueSlots) {
      // Memoization synthetics. The slot closures themselves are rebuilt on
      // every render and are not compared; what is compared is what they
      // capture: enclosing template-scope values (t-as/t-set/outer slot-scope
      // variables) and forwarded incoming slots. `this` is identity-stable for
      // a given component node and reactive reads inside slot content are
      // tracked by the child that renders it, so neither needs an entry.
      slotCaptures.delete("this");
      for (const varName of slotCaptures) {
        const syntheticKey = `"\x01slots.${varName}"`;
        props.push(`${syntheticKey}: ctx['${varName}']`);
        propList.push(syntheticKey);
      }
      for (const slotName of slotForwards) {
        const syntheticKey = `"\x01slots.__fwd.${slotName}"`;
        props.push(`${syntheticKey}: ctx.__owl__.props.slots?.['${slotName}']`);
        propList.push(syntheticKey);
      }
    }

    if (slotDef && !(ast.dynamicProps || hasSlotsProp)) {
      this.helpers.add("markRaw");
      props.push(`slots: markRaw(${slotDef})`);
    }

    let propString = this.getPropString(props, ast.dynamicProps);

    let propVar: string;
    if ((slotDef && (ast.dynamicProps || hasSlotsProp)) || this.dev) {
      propVar = generateId("props");
      this.define(propVar!, propString);
      propString = propVar!;
    }

    if (slotDef && (ast.dynamicProps || hasSlotsProp)) {
      this.helpers.add("markRaw");
      this.addLine(`${propVar!}.slots = markRaw(Object.assign(${slotDef}, ${propVar!}.slots))`);
    }

    // cmap key
    let expr: string;
    if (ast.isDynamic) {
      expr = generateId("Comp");
      this.define(expr, compileExpr(ast.name));
    } else {
      expr = `\`${ast.name}\``;
    }

    if (block && (ctx.forceNewBlock === false || ctx.tKeyExpr)) {
      // todo: check the forcenewblock condition
      this.insertAnchor(block);
    }

    let keyArg = this.generateComponentKey();
    if (ctx.tKeyExpr) {
      keyArg = `${ctx.tKeyExpr} + ${keyArg}`;
    }
    let id = generateId("comp");
    this.helpers.add("createComponent");
    const makeCreateComponentExpr = (opaqueSlots: boolean) =>
      `createComponent(app, ${
        ast.isDynamic ? null : expr
      }, ${!ast.isDynamic}, ${opaqueSlots}, ${!!ast.dynamicProps}, [${propList}])`;
    const def = { id, expr: "" };
    if (ast.slots && !hasOpaqueSlots) {
      // whether a capture is written (t-set) after this call site is only
      // known once the whole target is compiled: defer the opaque-slots
      // decision to finalizeSlotMemoization
      this.slotMemoChecks.push({
        def,
        makeExpr: makeCreateComponentExpr,
        target: this.target,
        captures: new Set(slotCaptures),
        tSetSnapshot: new Map(this.target.tSetEvents),
      });
    } else {
      def.expr = makeCreateComponentExpr(!!ast.slots);
    }
    this.staticDefs.push(def);

    if (ast.isDynamic) {
      // If the component class changes, this can cause delayed renders to go
      // through if the key doesn't change. Use the component name for now.
      // This means that two component classes with the same name isn't supported
      // in t-component. We can generate a unique id per class later if needed.
      keyArg = `(${expr}).name + ${keyArg}`;
    }
    let blockExpr = `${id}(${propString}, ${keyArg}, node, this, ${ast.isDynamic ? expr : null})`;
    if (ast.isDynamic) {
      blockExpr = `toggler(${expr}, ${blockExpr})`;
    }

    // event handling
    if (ast.on) {
      blockExpr = this.wrapWithEventCatcher(blockExpr, ast.on);
    }

    block = this.createBlock(block, "multi", ctx);
    this.insertBlock(blockExpr, block, ctx);
    return block.varName;
  }

  wrapWithEventCatcher(expr: string, on: EventHandlers): string {
    this.helpers.add("createCatcher");
    let name = generateId("catcher");
    let spec: any = {};
    let handlers: any[] = [];
    for (let ev in on) {
      let handlerId = generateId("hdlr");
      let idx = handlers.push(handlerId) - 1;
      spec[ev] = idx;
      const handler = this.generateHandlerCode(ev, on[ev]);
      this.define(handlerId, handler);
    }
    this.staticDefs.push({ id: name, expr: `createCatcher(${JSON.stringify(spec)})` });
    return `${name}(${expr}, [${handlers.join(",")}])`;
  }

  compileTCallSlot(ast: ASTTCallSlot, ctx: Context): string {
    this.helpers.add("callSlot");
    let { block } = ctx;
    let blockString: string;
    let slotName;
    let dynamic = false;
    let isMultiple = false;
    if (ast.name.match(INTERP_REGEXP)) {
      dynamic = true;
      isMultiple = true;
      slotName = interpolate(ast.name);
      // which incoming slot is rendered depends on a runtime value: an
      // enclosing slot cannot capture it by name
      this.target.hasOpaqueCtxReads = true;
    } else {
      slotName = "'" + ast.name + "'";
      isMultiple = isMultiple || this.slotNames.has(ast.name);
      this.slotNames.add(ast.name);
      // the content rendered here is the defining component's own incoming
      // slot: an enclosing slot captures it by identity (see compileComponent)
      this.target.forwardedSlots.add(ast.name);
    }
    const attrs = { ...ast.attrs };
    const dynProps = attrs["t-props"];
    delete attrs["t-props"];
    let key = this.target.loopLevel ? `key${this.target.loopLevel}` : "key";
    if (isMultiple) {
      key = this.generateComponentKey(key);
    }

    const props = ast.attrs
      ? this.formatPropObject(attrs, ast.attrsTranslationCtx, ctx.translationCtx)
      : [];
    const scope = this.getPropString(props, dynProps);
    if (ast.defaultContent) {
      const name = this.compileInNewTarget("defaultContent", ast.defaultContent, ctx).name;
      blockString = `callSlot(ctx, node, ${key}, ${slotName}, ${dynamic}, ${scope}, ${name}.bind(this))`;
    } else {
      if (dynamic) {
        let name = generateId("slot");
        this.define(name, slotName);
        blockString = `toggler(${name}, callSlot(ctx, node, ${key}, ${name}, ${dynamic}, ${scope}))`;
      } else {
        blockString = `callSlot(ctx, node, ${key}, ${slotName}, ${dynamic}, ${scope})`;
      }
    }
    // event handling
    if (ast.on) {
      blockString = this.wrapWithEventCatcher(blockString, ast.on);
    }

    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "multi", ctx);
    this.insertBlock(blockString, block, { ...ctx, forceNewBlock: false });
    return block.varName;
  }

  compileTTranslation(ast: ASTTranslation, ctx: Context): string | null {
    if (ast.content) {
      return this.compileAST(ast.content, Object.assign({}, ctx, { translate: false }));
    }
    return null;
  }
  compileTTranslationContext(ast: ASTTranslationContext, ctx: Context): string | null {
    if (ast.content) {
      return this.compileAST(
        ast.content,
        Object.assign({}, ctx, { translationCtx: ast.translationCtx })
      );
    }
    return null;
  }
}
