import {
  compileExpr,
  compileExprToArray,
  interpolate,
  INTERP_REGEXP,
  replaceDynamicParts,
} from "./inline_expressions";
import {
  AST,
  ASTComment,
  ASTComponent,
  ASTDebug,
  ASTDomNode,
  ASTLog,
  ASTMulti,
  ASTSlot,
  ASTTCall,
  ASTTCallBlock,
  ASTTEsc,
  ASTText,
  ASTTForEach,
  ASTTif,
  ASTTKey,
  ASTTOut,
  ASTTPortal,
  ASTTranslation,
  ASTTSet,
  ASTType,
  Attrs,
  EventHandlers,
} from "./parser";
import { OwlError } from "../common/owl_error";

type BlockType = "block" | "text" | "multi" | "list" | "html" | "comment";
const whitespaceRE = /\s+/g;

export interface Config {
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
  dev?: boolean;
}

export interface CodeGenOptions extends Config {
  hasSafeContext?: boolean;
  name?: string;
}

// using a non-html document so that <inner/outer>HTML serializes as XML instead
// of HTML (as we will parse it as xml later)
const xmlDoc = document.implementation.createDocument(null, null, null);

const MODS = new Set(["stop", "capture", "prevent", "self", "synthetic"]);

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
    // Can't use outerHTML on text/comment nodes
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
  preventRoot?: boolean;
  isLast?: boolean;
  translate: boolean;
  tKeyExpr: string | null;
  nameSpace?: string;
  tModelSelectedExpr?: string;
  ctxVar?: string;
  inPreTag?: boolean;
}

function createContext(parentCtx: Context, params?: Partial<Context>): Context {
  return Object.assign(
    {
      block: null,
      index: 0,
      forceNewBlock: true,
      translate: parentCtx.translate,
      tKeyExpr: null,
      nameSpace: parentCtx.nameSpace,
      tModelSelectedExpr: parentCtx.tModelSelectedExpr,
    },
    params
  );
}

class CodeTarget {
  name: string;
  indentLevel = 0;
  loopLevel = 0;
  code: string[] = [];
  hasRoot = false;
  hasCache = false;
  shouldProtectScope: boolean = false;
  on: EventHandlers | null;
  hasRefWrapper: boolean = false;

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
  }

  generateCode(): string {
    let result: string[] = [];
    result.push(`function ${this.name}(ctx, node, key = "") {`);
    if (this.shouldProtectScope) {
      result.push(`  ctx = Object.create(ctx);`);
      result.push(`  ctx[isBoundary] = 1`);
    }
    if (this.hasRefWrapper) {
      result.push(`  let refWrapper = makeRefWrapper(this.__owl__);`);
    }
    if (this.hasCache) {
      result.push(`  let cache = ctx.cache || {};`);
      result.push(`  let nextCache = ctx.cache = {};`);
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

const TRANSLATABLE_ATTRS = ["label", "title", "placeholder", "alt"];
const translationRE = /^(\s*)([\s\S]+?)(\s*)$/;

export class CodeGenerator {
  blocks: BlockDescription[] = [];
  nextBlockId = 1;
  hasSafeContext: boolean;
  isDebug: boolean = false;
  targets: CodeTarget[] = [];
  target = new CodeTarget("template");
  templateName?: string;
  dev: boolean;
  translateFn: (s: string) => string;
  translatableAttributes: string[] = TRANSLATABLE_ATTRS;
  ast: AST;
  staticDefs: { id: string; expr: string }[] = [];
  slotNames: Set<String> = new Set();
  helpers: Set<string> = new Set();

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
    this.hasSafeContext = options.hasSafeContext || false;
    this.dev = options.dev || false;
    this.ast = ast;
    this.templateName = options.name;
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
      isLast: true,
      translate: true,
      tKeyExpr: null,
    });
    // define blocks and utility functions
    let mainCode = [`  let { text, createBlock, list, multi, html, toggler, comment } = bdom;`];
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
          let xmlString = block.asXmlString();
          xmlString = xmlString.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
          if (block.dynamicTagName) {
            xmlString = xmlString.replace(/^<\w+/, `<\${tag || '${block.dom.nodeName}'}`);
            xmlString = xmlString.replace(/\w+>$/, `\${tag || '${block.dom.nodeName}'}>`);
            mainCode.push(`let ${block.blockName} = tag => createBlock(\`${xmlString}\`);`);
          } else {
            mainCode.push(`let ${block.blockName} = createBlock(\`${xmlString}\`);`);
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

  compileInNewTarget(prefix: string, ast: AST, ctx: Context, on?: EventHandlers | null): string {
    const name = generateId(prefix);
    const initialTarget = this.target;
    const target = new CodeTarget(name, on);
    this.targets.push(target);
    this.target = target;
    this.compileAST(ast, createContext(ctx));
    this.target = initialTarget;
    return name;
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
    if (!hasRoot && !ctx.preventRoot) {
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

    if (block.isRoot && !ctx.preventRoot) {
      if (this.target.on) {
        blockExpr = this.wrapWithEventCatcher(blockExpr, this.target.on);
      }
      this.addLine(`return ${blockExpr};`);
    } else {
      this.define(block.varName, blockExpr);
    }
  }

  /**
   * Captures variables that are used inside of an expression. This is useful
   * because in compiled code, almost all variables are accessed through the ctx
   * object. In the case of functions, that lookup in the context can be delayed
   * which can cause issues if the value has changed since the function was
   * defined.
   *
   * @param expr the expression to capture
   * @param forceCapture whether the expression should capture its scope even if
   *  it doesn't contain a function. Useful when the expression will be used as
   *  a function body.
   * @returns a new expression that uses the captured values
   */
  captureExpression(expr: string, forceCapture: boolean = false): string {
    if (!forceCapture && !expr.includes("=>")) {
      return compileExpr(expr);
    }
    const tokens = compileExprToArray(expr);
    const mapping = new Map<string, string>();
    return tokens
      .map((tok) => {
        if (tok.varName && !tok.isLocal) {
          if (!mapping.has(tok.varName)) {
            const varId = generateId("v");
            mapping.set(tok.varName, varId);
            this.define(varId, tok.value);
          }
          tok.value = mapping.get(tok.varName)!;
        }
        return tok.value;
      })
      .join("");
  }

  translate(str: string): string {
    const match = translationRE.exec(str) as any;
    return match[1] + this.translateFn(match[2]) + match[3];
  }

  /**
   * @returns the newly created block name, if any
   */
  compileAST(ast: AST, ctx: Context): string | null {
    switch (ast.type) {
      case ASTType.Comment:
        return this.compileComment(ast, ctx);
      case ASTType.Text:
        return this.compileText(ast, ctx);
      case ASTType.DomNode:
        return this.compileTDomNode(ast, ctx);
      case ASTType.TEsc:
        return this.compileTEsc(ast, ctx);
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
      case ASTType.TSlot:
        return this.compileTSlot(ast, ctx);
      case ASTType.TTranslation:
        return this.compileTTranslation(ast, ctx);
      case ASTType.TPortal:
        return this.compileTPortal(ast, ctx);
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
  compileComment(ast: ASTComment, ctx: Context): string {
    let { block, forceNewBlock } = ctx;
    const isNewBlock = !block || forceNewBlock;
    if (isNewBlock) {
      block = this.createBlock(block, "comment", ctx);
      this.insertBlock(`comment(\`${ast.value}\`)`, block, {
        ...ctx,
        forceNewBlock: forceNewBlock && !block,
      });
    } else {
      const text = xmlDoc.createComment(ast.value);
      block!.insert(text);
    }
    return block!.varName;
  }

  compileText(ast: ASTText, ctx: Context): string {
    let { block, forceNewBlock } = ctx;

    let value = ast.value;
    if (value && ctx.translate !== false) {
      value = this.translate(value);
    }
    if (!ctx.inPreTag) {
      value = value.replace(whitespaceRE, " ");
    }

    if (!block || forceNewBlock) {
      block = this.createBlock(block, "text", ctx);
      this.insertBlock(`text(\`${value}\`)`, block, {
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
    return `[${modifiersCode}${this.captureExpression(handler)}, ctx]`;
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
    const nameSpace = ast.ns || ctx.nameSpace;
    if (nameSpace && isNewBlock) {
      // specific namespace uri
      attrs["block-ns"] = nameSpace;
    }

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
        attrs[key] = this.translateFn(ast.attrs[key]);
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
        baseExpr,
        expr,
        eventType,
        shouldNumberize,
        shouldTrim,
        targetAttr,
        specialInitTargetAttr,
      } = ast.model;

      const baseExpression = compileExpr(baseExpr);
      const bExprId = generateId("bExpr");
      this.define(bExprId, baseExpression);

      const expression = compileExpr(expr);
      const exprId = generateId("expr");
      this.define(exprId, expression);

      const fullExpression = `${bExprId}[${exprId}]`;

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
        idx = block!.insertData(`${fullExpression} === ${targetExpr}`, "prop");
        attrs[`block-property-${idx}`] = specialInitTargetAttr;
      } else if (hasDynamicChildren) {
        const bValueId = generateId("bValue");
        tModelSelectedExpr = `${bValueId}`;
        this.define(tModelSelectedExpr, fullExpression);
      } else {
        idx = block!.insertData(`${fullExpression}`, "prop");
        attrs[`block-property-${idx}`] = targetAttr;
      }
      this.helpers.add("toNumber");
      let valueCode = `ev.target.${targetAttr}`;
      valueCode = shouldTrim ? `${valueCode}.trim()` : valueCode;
      valueCode = shouldNumberize ? `toNumber(${valueCode})` : valueCode;

      const handler = `[(ev) => { ${fullExpression} = ${valueCode}; }]`;
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
      if (this.dev) {
        this.helpers.add("makeRefWrapper");
        this.target.hasRefWrapper = true;
      }
      const isDynamic = INTERP_REGEXP.test(ast.ref);
      let name = `\`${ast.ref}\``;
      if (isDynamic) {
        name = replaceDynamicParts(ast.ref, (expr) => this.captureExpression(expr, true));
      }
      let setRefStr = `(el) => this.__owl__.setRef((${name}), el)`;
      if (this.dev) {
        setRefStr = `refWrapper(${name}, ${setRefStr})`;
      }
      const idx = block!.insertData(setRefStr, "ref");
      attrs["block-ref"] = String(idx);
    }

    const dom = xmlDoc.createElement(ast.tag);
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
          isLast: ctx.isLast && i === children.length - 1,
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
        this.addLine(`let ${block!.children.map((c) => c.varName)};`, codeIdx);
      }
    }
    return block!.varName;
  }

  compileTEsc(ast: ASTTEsc, ctx: Context): string {
    let { block, forceNewBlock } = ctx;
    let expr: string;
    if (ast.expr === "0") {
      this.helpers.add("zero");
      expr = `ctx[zero]`;
    } else {
      expr = compileExpr(ast.expr);
      if (ast.defaultValue) {
        this.helpers.add("withDefault");
        expr = `withDefault(${expr}, \`${ast.defaultValue}\`)`;
      }
    }
    if (!block || forceNewBlock) {
      block = this.createBlock(block, "text", ctx);
      this.insertBlock(`text(${expr})`, block, { ...ctx, forceNewBlock: forceNewBlock && !block });
    } else {
      const idx = block.insertData(expr, "txt");
      const text = xmlDoc.createElement(`block-text-${idx}`);
      block.insert(text);
    }
    return block.varName;
  }

  compileTOut(ast: ASTTOut, ctx: Context): string {
    let { block } = ctx;
    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "html", ctx);
    let blockStr;
    if (ast.expr === "0") {
      this.helpers.add("zero");
      blockStr = `ctx[zero]`;
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
        this.addLine(`let ${block!.children.map((c) => c.varName)};`, codeIdx);
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
    this.addLine(`ctx = Object.create(ctx);`);
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
    this.addLine(`ctx[\`${ast.elem}\`] = ${vals}[${loopVar}];`);
    if (!ast.hasNoFirst) {
      this.addLine(`ctx[\`${ast.elem}_first\`] = ${loopVar} === 0;`);
    }
    if (!ast.hasNoLast) {
      this.addLine(`ctx[\`${ast.elem}_last\`] = ${loopVar} === ${vals}.length - 1;`);
    }
    if (!ast.hasNoIndex) {
      this.addLine(`ctx[\`${ast.elem}_index\`] = ${loopVar};`);
    }
    if (!ast.hasNoValue) {
      this.addLine(`ctx[\`${ast.elem}_value\`] = ${keys}[${loopVar}];`);
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
    let id: string;
    if (ast.memo) {
      this.target.hasCache = true;
      id = generateId();
      this.define(`memo${id}`, compileExpr(ast.memo));
      this.define(`vnode${id}`, `cache[key${this.target.loopLevel}];`);
      this.addLine(`if (vnode${id}) {`);
      this.target.indentLevel++;
      this.addLine(`if (shallowEqual(vnode${id}.memo, memo${id})) {`);
      this.target.indentLevel++;
      this.addLine(`${c}[${loopVar}] = vnode${id};`);
      this.addLine(`nextCache[key${this.target.loopLevel}] = vnode${id};`);
      this.addLine(`continue;`);
      this.target.indentLevel--;
      this.addLine("}");
      this.target.indentLevel--;
      this.addLine("}");
    }

    const subCtx = createContext(ctx, { block, index: loopVar });
    this.compileAST(ast.body, subCtx);
    if (ast.memo) {
      this.addLine(
        `nextCache[key${
          this.target.loopLevel
        }] = Object.assign(${c}[${loopVar}], {memo: memo${id!}});`
      );
    }
    this.target.indentLevel--;
    this.target.loopLevel--;
    this.addLine(`}`);
    if (!ctx.isLast) {
      this.addLine(`ctx = ctx.__proto__;`);
    }
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
      const n = ast.content.filter((c) => c.type !== ASTType.TSet).length;
      let result: string | null = null;
      if (n <= 1) {
        for (let child of ast.content) {
          const blockName = this.compileAST(child, ctx);
          result = result || blockName;
        }
        return result;
      }
      block = this.createBlock(block, "multi", ctx);
    }
    let index = 0;
    for (let i = 0, l = ast.content.length; i < l; i++) {
      const child = ast.content[i];
      const isTSet = child.type === ASTType.TSet;
      const subCtx = createContext(ctx, {
        block,
        index,
        forceNewBlock: !isTSet,
        preventRoot: ctx.preventRoot,
        isLast: ctx.isLast && i === l - 1,
      });
      this.compileAST(child, subCtx);
      if (!isTSet) {
        index++;
      }
    }
    if (isNewBlock) {
      if (block!.hasDynamicChildren) {
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
          this.addLine(`let ${block!.children.map((c) => c.varName)};`, codeIdx);
        }
      }

      const args = block!.children.map((c) => c.varName).join(", ");
      this.insertBlock(`multi([${args}])`, block!, ctx)!;
    }
    return block!.varName;
  }

  compileTCall(ast: ASTTCall, ctx: Context): string {
    let { block, forceNewBlock } = ctx;
    let ctxVar = ctx.ctxVar || "ctx";
    if (ast.context) {
      ctxVar = generateId("ctx");
      this.addLine(`let ${ctxVar} = ${compileExpr(ast.context)};`);
    }
    if (ast.body) {
      this.addLine(`${ctxVar} = Object.create(${ctxVar});`);
      this.addLine(`${ctxVar}[isBoundary] = 1;`);
      this.helpers.add("isBoundary");
      const subCtx = createContext(ctx, { preventRoot: true, ctxVar });
      const bl = this.compileMulti({ type: ASTType.Multi, content: ast.body }, subCtx);
      if (bl) {
        this.helpers.add("zero");
        this.addLine(`${ctxVar}[zero] = ${bl};`);
      }
    }
    const isDynamic = INTERP_REGEXP.test(ast.name);
    const subTemplate = isDynamic ? interpolate(ast.name) : "`" + ast.name + "`";
    if (block) {
      if (!forceNewBlock) {
        this.insertAnchor(block);
      }
    }
    const key = `key + \`${this.generateComponentKey()}\``;
    if (isDynamic) {
      const templateVar = generateId("template");
      if (!this.staticDefs.find((d) => d.id === "call")) {
        this.staticDefs.push({ id: "call", expr: `app.callTemplate.bind(app)` });
      }
      this.define(templateVar, subTemplate);
      block = this.createBlock(block, "multi", ctx);
      this.insertBlock(`call(this, ${templateVar}, ${ctxVar}, node, ${key})`, block!, {
        ...ctx,
        forceNewBlock: !block,
      });
    } else {
      const id = generateId(`callTemplate_`);
      this.staticDefs.push({ id, expr: `app.getTemplate(${subTemplate})` });
      block = this.createBlock(block, "multi", ctx);
      this.insertBlock(`${id}.call(this, ${ctxVar}, node, ${key})`, block!, {
        ...ctx,
        forceNewBlock: !block,
      });
    }
    if (ast.body && !ctx.isLast) {
      this.addLine(`${ctxVar} = ${ctxVar}.__proto__;`);
    }
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
    this.target.shouldProtectScope = true;
    this.helpers.add("isBoundary").add("withDefault");
    const expr = ast.value ? compileExpr(ast.value || "") : "null";
    if (ast.body) {
      this.helpers.add("LazyValue");
      const bodyAst: AST = { type: ASTType.Multi, content: ast.body };
      const name = this.compileInNewTarget("value", bodyAst, ctx);
      let key = this.target.currentKey(ctx);
      let value = `new LazyValue(${name}, ctx, this, node, ${key})`;
      value = ast.value ? (value ? `withDefault(${expr}, ${value})` : expr) : value;
      this.addLine(`ctx[\`${ast.name}\`] = ${value};`);
    } else {
      let value: string;
      if (ast.defaultValue) {
        const defaultValue = ctx.translate ? this.translate(ast.defaultValue) : ast.defaultValue;
        if (ast.value) {
          value = `withDefault(${expr}, \`${defaultValue}\`)`;
        } else {
          value = `\`${defaultValue}\``;
        }
      } else {
        value = expr;
      }
      this.helpers.add("setContextValue");
      this.addLine(`setContextValue(${ctx.ctxVar || "ctx"}, "${ast.name}", ${value});`);
    }
    return null;
  }

  generateComponentKey() {
    const parts = [generateId("__")];
    for (let i = 0; i < this.target.loopLevel; i++) {
      parts.push(`\${key${i + 1}}`);
    }
    return parts.join("__");
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
  formatProp(name: string, value: string): string {
    value = this.captureExpression(value);
    if (name.includes(".")) {
      let [_name, suffix] = name.split(".");
      name = _name;
      switch (suffix) {
        case "bind":
          value = `(${value}).bind(this)`;
          break;
        case "alike":
          break;
        default:
          throw new OwlError("Invalid prop suffix");
      }
    }
    name = /^[a-z_]+$/i.test(name) ? name : `'${name}'`;
    return `${name}: ${value || undefined}`;
  }

  formatPropObject(obj: { [prop: string]: any }): string[] {
    return Object.entries(obj).map(([k, v]) => this.formatProp(k, v));
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
    const props: string[] = ast.props ? this.formatPropObject(ast.props) : [];

    // slots
    let slotDef: string = "";
    if (ast.slots) {
      let ctxStr = "ctx";
      if (this.target.loopLevel || !this.hasSafeContext) {
        ctxStr = generateId("ctx");
        this.helpers.add("capture");
        this.define(ctxStr, `capture(ctx)`);
      }
      let slotStr: string[] = [];
      for (let slotName in ast.slots) {
        const slotAst = ast.slots[slotName];
        const params = [];
        if (slotAst.content) {
          const name = this.compileInNewTarget("slot", slotAst.content, ctx, slotAst.on);
          params.push(`__render: ${name}.bind(this), __ctx: ${ctxStr}`);
        }
        const scope = ast.slots[slotName].scope;
        if (scope) {
          params.push(`__scope: "${scope}"`);
        }
        if (ast.slots[slotName].attrs) {
          params.push(...this.formatPropObject(ast.slots[slotName].attrs!));
        }
        const slotInfo = `{${params.join(", ")}}`;
        slotStr.push(`'${slotName}': ${slotInfo}`);
      }
      slotDef = `{${slotStr.join(", ")}}`;
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
    const key = this.generateComponentKey();
    let expr: string;
    if (ast.isDynamic) {
      expr = generateId("Comp");
      this.define(expr, compileExpr(ast.name));
    } else {
      expr = `\`${ast.name}\``;
    }

    if (this.dev) {
      this.addLine(`helpers.validateProps(${expr}, ${propVar!}, this);`);
    }

    if (block && (ctx.forceNewBlock === false || ctx.tKeyExpr)) {
      // todo: check the forcenewblock condition
      this.insertAnchor(block);
    }

    let keyArg = `key + \`${key}\``;
    if (ctx.tKeyExpr) {
      keyArg = `${ctx.tKeyExpr} + ${keyArg}`;
    }
    let id = generateId("comp");
    const propList: string[] = [];
    for (let p in ast.props || {}) {
      let [name, suffix] = p.split(".");
      if (!suffix) {
        propList.push(`"${name}"`);
      }
    }
    this.staticDefs.push({
      id,
      expr: `app.createComponent(${
        ast.isDynamic ? null : expr
      }, ${!ast.isDynamic}, ${!!ast.slots}, ${!!ast.dynamicProps}, [${propList}])`,
    });

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

  compileTSlot(ast: ASTSlot, ctx: Context): string {
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
    } else {
      slotName = "'" + ast.name + "'";
      isMultiple = isMultiple || this.slotNames.has(ast.name);
      this.slotNames.add(ast.name);
    }
    const dynProps = ast.attrs ? ast.attrs["t-props"] : null;
    if (ast.attrs) {
      delete ast.attrs["t-props"];
    }
    let key = this.target.loopLevel ? `key${this.target.loopLevel}` : "key";
    if (isMultiple) {
      key = `${key} + \`${this.generateComponentKey()}\``;
    }

    const props = ast.attrs ? this.formatPropObject(ast.attrs) : [];
    const scope = this.getPropString(props, dynProps);
    if (ast.defaultContent) {
      const name = this.compileInNewTarget("defaultContent", ast.defaultContent, ctx);
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
  compileTPortal(ast: ASTTPortal, ctx: Context): string {
    if (!this.staticDefs.find((d) => d.id === "Portal")) {
      this.staticDefs.push({ id: "Portal", expr: `app.Portal` });
    }

    let { block } = ctx;
    const name = this.compileInNewTarget("slot", ast.content, ctx);
    const key = this.generateComponentKey();
    let ctxStr = "ctx";
    if (this.target.loopLevel || !this.hasSafeContext) {
      ctxStr = generateId("ctx");
      this.helpers.add("capture");
      this.define(ctxStr, `capture(ctx)`);
    }
    let id = generateId("comp");
    this.staticDefs.push({
      id,
      expr: `app.createComponent(null, false, true, false, false)`,
    });

    const target = compileExpr(ast.target);
    const blockString = `${id}({target: ${target},slots: {'default': {__render: ${name}.bind(this), __ctx: ${ctxStr}}}}, key + \`${key}\`, node, ctx, Portal)`;
    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "multi", ctx);
    this.insertBlock(blockString, block, { ...ctx, forceNewBlock: false });
    return block.varName;
  }
}
