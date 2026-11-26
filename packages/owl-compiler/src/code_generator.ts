import { OwlError } from "@odoo/owl-core";
import { compileExpr, INTERP_REGEXP, interpolate, withCtxName } from "./inline_expressions";
import {
  AST,
  ASTComponent,
  ASTDomNode,
  ASTTCall,
  ASTTCallSlot,
  ASTText,
  ASTTForEach,
  ASTTif,
  ASTTKey,
  ASTTOut,
  ASTTSet,
  ASTType,
  Attrs,
  EventHandlers,
} from "./parser";

// -----------------------------------------------------------------------------
// Render-once code generator
// -----------------------------------------------------------------------------
//
// A compiled template runs once per instance (a component, a t-if branch, a
// list row, a slot, ...) and returns a "content": a range of DOM nodes that the
// runtime inserts, moves and removes. Nothing is re-rendered:
//
// - static DOM is cloned from block templates (createBlock);
// - the dynamic values of a block (attributes, properties) are kept up to date
//   by one render effect per block, which re-runs when a value it read
//   changes, and only writes the values that changed;
// - event handlers and refs are set once;
// - structural nodes (t-if, t-foreach, t-out, components, slots, ...) are
//   runtime helpers that own their sub-contents, and create or dispose them
//   when what they depend on changes.
//
// Closures in the generated code (branches, rows, slots, effects) are created
// once and run later, so the rendering context is never reassigned: a t-set
// introduces a new context layer in a new constant (see withCtxName).
// -----------------------------------------------------------------------------

export interface Config {
  translateFn?: (s: string, translationCtx: string) => string;
  translatableAttributes?: string[];
  dev?: boolean;
}

interface CodeGenOptions extends Config {
  name?: string;
  hasGlobalValues: boolean;
}

const whitespaceRE = /\s+/g;

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

function propKey(name: string): string {
  return /^[a-z_]+$/i.test(name) ? name : `'${name}'`;
}

/** an arrow function returning `expr` (parenthesized, for object literals) */
function thunk(expr: string, params: string = ""): string {
  return `(${params}) => (${expr})`;
}

// -----------------------------------------------------------------------------
// BlockDescription
// -----------------------------------------------------------------------------

class BlockDescription {
  static nextBlockId = 1;

  id: number;
  varName: string;
  blockName: string;
  dom?: Node;
  currentDom?: Element;
  // next block-child-N index
  childNumber = 0;
  // next data location index (attributes, properties, handlers, refs)
  dataNumber = 0;
  // statements run by the render effect of the block
  dynamic: string[] = [];
  hasDynamicTag = false;

  constructor() {
    this.id = BlockDescription.nextBlockId++;
    this.varName = "b" + this.id;
    this.blockName = "block" + this.id;
  }

  insert(dom: Node) {
    if (this.currentDom) {
      this.currentDom.appendChild(dom);
    } else {
      this.dom = dom;
    }
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

interface State {
  translate: boolean;
  translationCtx: string;
  inPreTag: boolean;
  nameSpace: string | null;
  tModelSelectedExpr: string | null;
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
  isDebug: boolean = false;
  fnName = "template";
  templateName?: string;
  dev: boolean;
  translateFn: (s: string, translationCtx: string) => string;
  translatableAttributes: string[] = TRANSLATABLE_ATTRS;
  ast: AST;
  staticDefs: { id: string; expr: string }[] = [];
  helpers: Set<string> = new Set();

  // generation state
  lines: string[] = [];
  indent = 0;
  ctxVar = "ctx";
  state: State = {
    translate: true,
    translationCtx: "",
    inPreTag: false,
    nameSpace: null,
    tModelSelectedExpr: null,
  };

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
        this.fnName = options.name;
      } else {
        this.fnName = `template_${options.name.replace(/[^a-zA-Z0-9_$]/g, "_")}`;
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
    const result = this.genContent(ast);

    let mainCode = [`  let { createBlock } = bdom;`];
    if (this.helpers.size) {
      mainCode.push(`let { ${[...this.helpers].join(", ")} } = helpers;`);
    }
    if (this.templateName) {
      mainCode.push(`// Template name: "${this.templateName}"`);
    }
    for (let { id, expr } of this.staticDefs) {
      mainCode.push(`const ${id} = ${expr};`);
    }
    if (this.blocks.length) {
      mainCode.push(``);
      for (let block of this.blocks) {
        let xmlString = toStringExpression(block.asXmlString());
        if (block.hasDynamicTag) {
          const nodeName = block.dom!.nodeName;
          xmlString = xmlString.replace(/^`<\w+/, `\`<\${tag || '${nodeName}'}`);
          xmlString = xmlString.replace(/\w+>`$/, `\${tag || '${nodeName}'}>\``);
          mainCode.push(`let ${block.blockName} = tag => createBlock(${xmlString});`);
        } else {
          mainCode.push(`let ${block.blockName} = createBlock(${xmlString});`);
        }
      }
    }
    mainCode.push("");
    mainCode.push(`return function ${this.fnName}(ctx, node) {`);
    for (const line of this.lines) {
      mainCode.push(line);
    }
    mainCode.push(`  return ${result};`);
    mainCode.push(`}`);
    const code = mainCode.join("\n  ");

    if (this.isDebug) {
      const msg = `[Owl Debug]\n${code}`;
      console.log(msg);
    }
    return code;
  }

  // ---------------------------------------------------------------------------
  // utilities
  // ---------------------------------------------------------------------------

  addLine(line: string) {
    this.lines.push("  ".repeat(this.indent + 1) + line);
  }

  define(prefix: string, expr: string): string {
    const id = generateId(prefix);
    this.addLine(`const ${id} = ${expr};`);
    return id;
  }

  expr(expr: string): string {
    return withCtxName(this.ctxVar, () => compileExpr(expr));
  }

  interp(str: string): string {
    return withCtxName(this.ctxVar, () => interpolate(str));
  }

  withState<T>(state: Partial<State>, fn: () => T): T {
    const previous = this.state;
    this.state = Object.assign({}, previous, state);
    try {
      return fn();
    } finally {
      this.state = previous;
    }
  }

  /**
   * Generates an arrow function, whose body is produced by `build` (which
   * returns the expression to return). The context variable and the state are
   * restored afterwards, so a t-set inside the function stays local to it.
   */
  genFunction(params: string, build: () => string): string {
    const lines = this.lines;
    const ctxVar = this.ctxVar;
    const state = this.state;
    const indent = this.indent;
    this.lines = [];
    this.indent = indent + 1;
    let result: string;
    let inner: string[];
    try {
      result = build();
    } finally {
      inner = this.lines;
      this.lines = lines;
      this.ctxVar = ctxVar;
      this.state = state;
      this.indent = indent;
    }
    if (!inner.length) {
      return `(${params}) => ${result}`;
    }
    const pad = "  ".repeat(indent + 2);
    return `(${params}) => {\n${inner.join("\n")}\n${pad}return ${result};\n${"  ".repeat(indent + 1)}}`;
  }

  translate(str: string, translationCtx: string): string {
    const match = translationRE.exec(str) as any;
    return match[1] + this.translateFn(match[2], translationCtx) + match[3];
  }

  textValue(ast: ASTText): string {
    let value = ast.value;
    if (value && this.state.translate !== false) {
      value = this.translate(value, this.state.translationCtx);
    }
    if (!this.state.inPreTag) {
      value = value.replace(whitespaceRE, " ");
    }
    return value;
  }

  emptyContent(): string {
    this.helpers.add("text");
    return this.define("c", `text("")`);
  }

  // ---------------------------------------------------------------------------
  // contents
  // ---------------------------------------------------------------------------

  /**
   * Generates the code creating the content of `ast`, and returns the
   * expression (usually a variable) holding it.
   */
  genContent(ast: AST): string {
    switch (ast.type) {
      case ASTType.Text:
        this.helpers.add("text");
        return this.define("c", `text(${toStringExpression(this.textValue(ast))})`);
      case ASTType.DomNode:
        return this.genDomNodeContent(ast);
      case ASTType.TOut:
        return this.genTOut(ast);
      case ASTType.TIf:
        return this.genTIf(ast);
      case ASTType.TForEach:
        return this.genTForEach(ast);
      case ASTType.TKey:
        return this.genTKey(ast);
      case ASTType.Multi:
        return this.genMulti(ast.content);
      case ASTType.TCall:
        return this.genTCall(ast);
      case ASTType.TCallBlock:
        throw new OwlError("t-call-block is not supported");
      case ASTType.TSet:
        this.genTSet(ast);
        return this.emptyContent();
      case ASTType.TComponent:
        return this.genComponent(ast);
      case ASTType.TDebug:
        this.addLine(`debugger;`);
        return ast.content ? this.genContent(ast.content) : this.emptyContent();
      case ASTType.TLog:
        this.addLine(`console.log(${this.expr(ast.expr)});`);
        return ast.content ? this.genContent(ast.content) : this.emptyContent();
      case ASTType.TCallSlot:
        return this.genTCallSlot(ast);
      case ASTType.TTranslation:
        return this.withState({ translate: false }, () =>
          ast.content ? this.genContent(ast.content) : this.emptyContent()
        );
      case ASTType.TTranslationContext:
        return this.withState({ translationCtx: ast.translationCtx }, () =>
          ast.content ? this.genContent(ast.content) : this.emptyContent()
        );
    }
  }

  genMulti(children: AST[]): string {
    const contents: string[] = [];
    for (const child of children) {
      if (child.type === ASTType.TSet) {
        this.genTSet(child);
      } else {
        contents.push(this.genContent(child));
      }
    }
    if (!contents.length) {
      return this.emptyContent();
    }
    if (contents.length === 1) {
      return contents[0];
    }
    this.helpers.add("multi");
    return this.define("c", `multi([${contents.join(", ")}])`);
  }

  // ---------------------------------------------------------------------------
  // blocks
  // ---------------------------------------------------------------------------

  genDomNodeContent(ast: ASTDomNode): string {
    if (ast.dynamicTag) {
      this.helpers.add("keyed");
      const tag = this.expr(ast.dynamicTag);
      const build = this.genFunction("tag", () => this.genBlock(ast, "tag"));
      return this.define("c", `keyed(${thunk(tag)}, ${build})`);
    }
    return this.genBlock(ast, null);
  }

  genBlock(ast: ASTDomNode, tagVar: string | null): string {
    const block = new BlockDescription();
    this.blocks.push(block);
    block.hasDynamicTag = !!tagVar;
    const factory = tagVar ? `${block.blockName}(${tagVar})` : block.blockName;
    this.addLine(`const ${block.varName} = ${factory}();`);
    this.genDomNode(ast, block);
    if (block.dynamic.length) {
      this.helpers.add("renderEffect");
      this.addLine(`renderEffect(() => {`);
      for (const statement of block.dynamic) {
        this.addLine(`  ${statement}`);
      }
      this.addLine(`});`);
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

    // hoisted handlers receive the context as their `ctx` parameter
    const compiled = withCtxName("ctx", () => compileExpr(handler));
    if (!compiled.trim()) {
      return `[${modifiersCode}, ${this.ctxVar}]`;
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
    return `[${modifiersCode}${id}, ${this.ctxVar}]`;
  }

  /**
   * Adds the element of `ast` (and its static descendants) to the template of
   * `block`, and generates the code setting its dynamic parts.
   */
  genDomNode(ast: ASTDomNode, block: BlockDescription) {
    const bv = block.varName;
    // a value kept up to date by the render effect of the block
    const dynamic = (expr: string): number => {
      const idx = block.dataNumber++;
      block.dynamic.push(`${bv}.set(${idx}, ${expr});`);
      return idx;
    };
    // a value set once
    const once = (expr: string): number => {
      const idx = block.dataNumber++;
      this.addLine(`${bv}.set(${idx}, ${expr});`);
      return idx;
    };

    // attributes
    const attrs: Attrs = {};
    for (let key in ast.attrs) {
      let expr, attrName;
      if (key.startsWith("t-attf")) {
        expr = this.interp(ast.attrs[key]);
        const idx = dynamic(expr);
        attrName = key.slice(7);
        attrs["block-attribute-" + idx] = attrName;
      } else if (key.startsWith("t-att")) {
        attrName = key === "t-att" ? null : key.slice(6);
        expr = this.expr(ast.attrs[key]);
        if (attrName && isProp(ast.tag, attrName)) {
          if (attrName === "readonly") {
            // the property has a different name than the attribute
            attrName = "readOnly";
          }
          if (attrName === "value") {
            // When the expression is falsy (except 0), fall back to an empty string
            expr = `new String((${expr}) === 0 ? 0 : ((${expr}) || ""))`;
          } else {
            expr = `new Boolean(${expr})`;
          }
          const idx = dynamic(expr);
          attrs[`block-property-${idx}`] = attrName!;
        } else {
          const idx = dynamic(expr);
          if (key === "t-att") {
            attrs[`block-attributes`] = String(idx);
          } else {
            attrs[`block-attribute-${idx}`] = attrName!;
          }
        }
      } else if (this.translatableAttributes.includes(key)) {
        const attrTranslationCtx = ast.attrsTranslationCtx?.[key] || this.state.translationCtx;
        attrs[key] = this.translateFn(ast.attrs[key], attrTranslationCtx);
      } else {
        expr = `"${ast.attrs[key]}"`;
        attrName = key;
        attrs[key] = ast.attrs[key];
      }

      if (attrName === "value" && this.state.tModelSelectedExpr) {
        const idx = dynamic(`${this.state.tModelSelectedExpr} === ${expr}`);
        attrs[`block-attribute-${idx}`] = "selected";
      }
    }

    // t-model
    let tModelSelectedExpr: string | null = null;
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
        const expression = this.expr(expr);
        readExpr = expression;
        writeExpr = (value) => `${expression} = ${value}`;
      } else {
        // evaluated where it is used: the expression may designate another
        // signal later (e.g. `this.values[this.key()]`)
        this.helpers.add("modelExpr");
        const expression = `modelExpr(${this.expr(expr)})`;
        readExpr = `${expression}()`;
        writeExpr = (value) => `${expression}.set(${value})`;
      }

      if (specialInitTargetAttr) {
        let targetExpr = targetAttr in attrs && `'${attrs[targetAttr]}'`;
        if (!targetExpr && ast.attrs) {
          // look at the dynamic attribute counterpart
          const dynamicTgExpr = ast.attrs[`t-att-${targetAttr}`];
          if (dynamicTgExpr) {
            targetExpr = this.expr(dynamicTgExpr);
          }
        }
        const idx = dynamic(`${readExpr} === ${targetExpr}`);
        attrs[`block-property-${idx}`] = specialInitTargetAttr;
      } else if (hasDynamicChildren) {
        // evaluated by the render effect of each option
        tModelSelectedExpr = readExpr;
      } else {
        const idx = dynamic(readExpr);
        attrs[`block-property-${idx}`] = targetAttr;
      }
      this.helpers.add("toNumber");
      let valueCode = `ev.target.${targetAttr}`;
      valueCode = shouldTrim ? `${valueCode}.trim()` : valueCode;
      valueCode = shouldNumberize ? `toNumber(${valueCode})` : valueCode;

      const idx = once(`[(_ctx, ev) => { ${writeExpr(valueCode)}; }, ${this.ctxVar}]`);
      attrs[`block-handler-${idx}`] = eventType;
    }

    // event handlers
    for (let ev in ast.on) {
      const idx = once(this.generateHandlerCode(ev, ast.on[ev]));
      attrs[`block-handler-${idx}`] = ev;
    }

    // t-ref
    if (ast.ref) {
      this.helpers.add("createRef");
      const idx = block.dataNumber++;
      this.addLine(`${bv}.ref(${idx}, createRef(${this.expr(ast.ref)}, node));`);
      attrs["block-ref"] = String(idx);
    }

    const nameSpace = ast.ns || this.state.nameSpace;
    const dom = nameSpace
      ? xmlDoc.createElementNS(nameSpace, ast.tag)
      : xmlDoc.createElement(ast.tag);
    for (const [attr, val] of Object.entries(attrs)) {
      if (!(attr === "class" && val === "")) {
        dom.setAttribute(attr, val);
      }
    }
    block.insert(dom);
    if (ast.content.length) {
      const initialDom = block.currentDom;
      block.currentDom = dom;
      this.withState(
        {
          nameSpace,
          tModelSelectedExpr,
          inPreTag: this.state.inPreTag || ast.tag === "pre",
        },
        () => {
          for (const child of ast.content) {
            this.genChildInBlock(child, block);
          }
        }
      );
      block.currentDom = initialDom;
    }
  }

  genChildInBlock(child: AST, block: BlockDescription) {
    switch (child.type) {
      case ASTType.DomNode:
        if (!child.dynamicTag && !child.ns) {
          this.genDomNode(child, block);
          return;
        }
        break;
      case ASTType.Text:
        block.insert(xmlDoc.createTextNode(this.textValue(child)));
        return;
      case ASTType.TSet:
        this.genTSet(child);
        return;
      case ASTType.Multi:
        for (const c of child.content) {
          this.genChildInBlock(c, block);
        }
        return;
      case ASTType.TDebug:
        this.addLine(`debugger;`);
        if (child.content) {
          this.genChildInBlock(child.content, block);
        }
        return;
      case ASTType.TLog:
        this.addLine(`console.log(${this.expr(child.expr)});`);
        if (child.content) {
          this.genChildInBlock(child.content, block);
        }
        return;
      case ASTType.TTranslation:
        if (child.content) {
          const content = child.content;
          this.withState({ translate: false }, () => this.genChildInBlock(content, block));
        }
        return;
      case ASTType.TTranslationContext:
        if (child.content) {
          const content = child.content;
          this.withState({ translationCtx: child.translationCtx }, () =>
            this.genChildInBlock(content, block)
          );
        }
        return;
    }
    // a structural child: inserted at an anchor in the template
    const index = block.childNumber++;
    block.insert(xmlDoc.createElement(`block-child-${index}`));
    const content = this.genContent(child);
    this.addLine(`${block.varName}.insert(${index}, ${content});`);
  }

  // ---------------------------------------------------------------------------
  // structural nodes
  // ---------------------------------------------------------------------------

  genTOut(ast: ASTTOut): string {
    if (ast.expr === "0") {
      this.helpers.add("callZero");
      return this.define("c", `callZero(${this.ctxVar})`);
    }
    this.helpers.add("out");
    const value = this.expr(ast.expr);
    let defaultContent = "";
    if (ast.body) {
      const body = ast.body;
      defaultContent = ", " + this.genFunction("", () => this.genMulti(body));
    }
    return this.define("c", `out(${thunk(value)}${defaultContent})`);
  }

  genTIf(ast: ASTTif): string {
    const conditions = [ast.condition];
    const branches = [ast.content];
    for (const clause of ast.tElif || []) {
      conditions.push(clause.condition);
      branches.push(clause.content);
    }
    let select = conditions.map((c, i) => `(${this.expr(c)}) ? ${i} : `).join("");
    select += ast.tElse ? String(conditions.length) : "-1";
    if (ast.tElse) {
      branches.push(ast.tElse);
    }
    const fns = branches.map((branch) => this.genFunction("", () => this.genContent(branch)));
    this.helpers.add("toggle");
    return this.define("c", `toggle(() => ${select}, [${fns.join(", ")}])`);
  }

  genTForEach(ast: ASTTForEach): string {
    const rowCtx = generateId("ctx");
    const collection = this.expr(ast.collection);
    const keyFn = ast.key
      ? thunk(
          withCtxName(rowCtx, () => compileExpr(ast.key!)),
          rowCtx
        )
      : "null";
    const rowFn = this.genFunction(rowCtx, () => {
      this.ctxVar = rowCtx;
      return this.genContent(ast.body);
    });
    this.helpers.add("list");
    return this.define(
      "c",
      `list(${thunk(collection)}, ${this.ctxVar}, \`${ast.elem}\`, ${keyFn}, ${ast.noFlags}, ${rowFn}, ${this.dev})`
    );
  }

  genTKey(ast: ASTTKey): string {
    this.helpers.add("keyed");
    const key = this.expr(ast.expr);
    const build = this.genFunction("", () => this.genContent(ast.content));
    return this.define("c", `keyed(${thunk(key)}, ${build})`);
  }

  genTSet(ast: ASTTSet) {
    let value: string;
    let isGetter: boolean;
    if (ast.body) {
      this.helpers.add("lazy");
      const body = ast.body;
      const bodyFn = this.genFunction("", () => this.genMulti(body));
      const lazyValue = this.define("lazy", `lazy(${bodyFn})`);
      if (ast.value) {
        this.helpers.add("withDefault");
        value = thunk(`withDefault(${this.expr(ast.value)}, ${lazyValue})`);
        isGetter = true;
      } else {
        value = lazyValue;
        isGetter = false;
      }
    } else if (ast.defaultValue) {
      const defaultValue = toStringExpression(
        this.state.translate
          ? this.translate(ast.defaultValue, this.state.translationCtx)
          : ast.defaultValue
      );
      if (ast.value) {
        this.helpers.add("withDefault");
        value = thunk(`withDefault(${this.expr(ast.value)}, ${defaultValue})`);
        isGetter = true;
      } else {
        value = defaultValue;
        isGetter = false;
      }
    } else {
      value = thunk(ast.value ? this.expr(ast.value) : "null");
      isGetter = true;
    }
    this.helpers.add("tset");
    // the value is computed in the previous layer, so that a t-set can refer to
    // the value it shadows
    this.ctxVar = this.define(
      "ctx",
      `tset(${this.ctxVar}, \`${ast.name}\`, ${isGetter}, ${value})`
    );
  }

  /**
   * Formats a prop name and value, as a `key: value` entry
   *
   * Name              Value            Result
   * ---------------------------------------------------------
   * "number"          "state"          "number: ctx['state']"
   * "something"       ""               "something: undefined"
   * "some-prop"       "state"          "'some-prop': ctx['state']"
   * "onClick.bind"    "onClick"        "onClick: (ctx['onClick']).bind(this)"
   */
  formatProp(
    name: string,
    value: string,
    attrsTranslationCtx: { [name: string]: string } | null
  ): [string, string] {
    if (name.endsWith(".translate")) {
      const attrTranslationCtx = attrsTranslationCtx?.[name] || this.state.translationCtx;
      value = toStringExpression(this.translateFn(value, attrTranslationCtx));
    } else {
      value = this.expr(value);
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
    return [propKey(name), value || "undefined"];
  }

  /** `{ key: () => value, ... }`: values evaluated when read */
  getterFns(attrs: Attrs, attrsTranslationCtx: Attrs | null): string[] {
    return Object.entries(attrs).map(([name, value]) => {
      const [key, expr] = this.formatProp(name, value, attrsTranslationCtx);
      return `${key}: ${thunk(expr)}`;
    });
  }

  genTCall(ast: ASTTCall): string {
    const getters = ast.attrs ? this.getterFns(ast.attrs, ast.attrsTranslationCtx) : [];
    let zeroFn = "null";
    if (ast.body) {
      const body = ast.body;
      zeroFn = this.genFunction("", () => this.genContent(body));
    }
    let base = this.ctxVar;
    if (ast.context) {
      base = "null";
      getters.push(`this: ${thunk(this.expr(ast.context))}`);
    }
    let subCtx = base;
    if (getters.length || zeroFn !== "null") {
      this.helpers.add("callCtx");
      subCtx = this.define("ctx", `callCtx(${base}, {${getters.join(", ")}}, ${zeroFn})`);
    }
    this.helpers.add("callTemplate");
    if (ast.name.match(INTERP_REGEXP)) {
      this.helpers.add("keyed");
      const name = this.interp(ast.name);
      return this.define(
        "c",
        `keyed(() => ${name}, (name) => callTemplate(name, this, app, ${subCtx}, node))`
      );
    }
    return this.define("c", `callTemplate(\`${ast.name}\`, this, app, ${subCtx}, node)`);
  }

  genCatcher(content: string, on: EventHandlers): string {
    this.helpers.add("catcher");
    const handlers = Object.entries(on).map(
      ([ev, handler]) => `'${ev}': ${this.generateHandlerCode(ev, handler)}`
    );
    return this.define("c", `catcher(${content}, {${handlers.join(", ")}})`);
  }

  genComponent(ast: ASTComponent): string {
    const props: string[] = [];
    for (const p in ast.props || {}) {
      const [name, suffix] = p.split(".");
      if (suffix === "signal") {
        // a signal created once per component site, set by the props effect
        this.helpers.add("propSignal");
        const sig = this.define("sig", "propSignal()");
        props.push(`${propKey(name)}: ${sig}(${this.expr(ast.props![p])})`);
        continue;
      }
      const [key, value] = this.formatProp(p, ast.props![p], ast.propsTranslationCtx);
      props.push(`${key}: ${value}`);
    }

    // slots: created once
    let slots: string | null = null;
    if (ast.slots) {
      const entries: string[] = [];
      for (const slotName in ast.slots) {
        const slot = ast.slots[slotName];
        const params: string[] = [];
        if (slot.content) {
          const slotCtx = generateId("ctx");
          const content = slot.content;
          const fn = this.genFunction(`${slotCtx}, node`, () => {
            this.ctxVar = slotCtx;
            const result = this.genContent(content);
            return slot.on ? this.genCatcher(result, slot.on) : result;
          });
          params.push(`__render: ${fn}`, `__ctx: ${this.ctxVar}`);
        }
        if (slot.scope) {
          params.push(`__scope: "${slot.scope}"`);
        }
        if (slot.attrs) {
          // getters on the slot object (arrow functions, for `this`)
          const getters = this.getterFns(slot.attrs, slot.attrsTranslationCtx);
          params.push(`__attrs: {${getters.join(", ")}}`);
        }
        entries.push(`'${slotName}': {${params.join(", ")}}`);
      }
      this.helpers.add("makeSlots");
      slots = this.define("slots", `makeSlots({${entries.join(", ")}})`);
    }

    const hasSlotsProp = "slots" in (ast.props || {});
    if (slots && !(ast.dynamicProps || hasSlotsProp)) {
      props.push(`slots: ${slots}`);
    }
    let propsExpr = `{${props.join(", ")}}`;
    if (ast.dynamicProps) {
      propsExpr = `Object.assign({}, ${this.expr(ast.dynamicProps)}${
        props.length ? ", " + propsExpr : ""
      })`;
    }
    let propsFn: string;
    if (slots && (ast.dynamicProps || hasSlotsProp)) {
      this.helpers.add("markRaw");
      propsFn = `() => { const p = ${propsExpr}; p.slots = markRaw(Object.assign({}, ${slots}, p.slots)); return p; }`;
    } else {
      propsFn = `() => (${propsExpr})`;
    }

    let content: string;
    if (ast.isDynamic) {
      this.helpers.add("dynamicComponent");
      const C = this.expr(ast.name);
      content = this.define(
        "c",
        `dynamicComponent(this, ${this.ctxVar}, node, ${thunk(C)}, ${propsFn})`
      );
    } else {
      this.helpers.add("component");
      content = this.define(
        "c",
        `component(this, ${this.ctxVar}, node, \`${ast.name}\`, ${propsFn})`
      );
    }
    return ast.on ? this.genCatcher(content, ast.on) : content;
  }

  genTCallSlot(ast: ASTTCallSlot): string {
    const attrs = { ...ast.attrs };
    const dynProps = attrs["t-props"];
    delete attrs["t-props"];
    const getters = this.getterFns(attrs, ast.attrsTranslationCtx);
    const scope = getters.length ? `{${getters.join(", ")}}` : "null";
    const dynScope = dynProps ? thunk(this.expr(dynProps)) : "null";
    let defaultContent = "null";
    if (ast.defaultContent) {
      const content = ast.defaultContent;
      defaultContent = this.genFunction("", () => this.genContent(content));
    }
    this.helpers.add("callSlot");
    let result: string;
    if (ast.name.match(INTERP_REGEXP)) {
      this.helpers.add("keyed");
      const name = this.interp(ast.name);
      result = this.define(
        "c",
        `keyed(() => ${name}, (name) => callSlot(${this.ctxVar}, node, name, ${scope}, ${dynScope}, ${defaultContent}))`
      );
    } else {
      result = this.define(
        "c",
        `callSlot(${this.ctxVar}, node, '${ast.name}', ${scope}, ${dynScope}, ${defaultContent})`
      );
    }
    return ast.on ? this.genCatcher(result, ast.on) : result;
  }
}
