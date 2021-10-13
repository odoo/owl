import { BDom } from "../blockdom";
import { compileExpr, compileExprToArray, interpolate, INTERP_REGEXP } from "./inline_expressions";
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
  ASTTRaw,
  ASTTSet,
  ASTTranslation,
  ASTType,
  parse,
} from "./parser";

export type Template = (context: any, vnode: any, key?: string) => BDom;
export type TemplateFunction = (blocks: any, utils: any) => Template;

type BlockType = "block" | "text" | "multi" | "list" | "html";

export interface CompileOptions {
  name?: string;
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
}

export function compileTemplate(template: string, options?: CompileOptions): TemplateFunction {
  const compiler = new QWebCompiler(template, options);
  return compiler.compile();
}

// using a non-html document so that <inner/outer>HTML serializes as XML instead
// of HTML (as we will parse it as xml later)
const xmlDoc = document.implementation.createDocument(null, null, null);

// -----------------------------------------------------------------------------
// BlockDescription
// -----------------------------------------------------------------------------

class BlockDescription {
  static nextBlockId = 1;
  static nextDataId = 1;

  varName: string;
  blockName: string;
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

  insertData(str: string): number {
    const id = "d" + BlockDescription.nextDataId++;
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
      return `${this.blockName}(${params})`;
    } else if (this.type === "list") {
      return `list(c${this.id})`;
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
const FNAMEREGEXP = /^[$A-Z_][0-9A-Z_$]*$/i;

interface Context {
  block: BlockDescription | null;
  index: number | string;
  forceNewBlock: boolean;
  preventRoot?: boolean;
  isLast?: boolean;
  translate: boolean;
}

function createContext(parentCtx: Context, params?: Partial<Context>) {
  return Object.assign(
    {
      block: null,
      index: 0,
      forceNewBlock: true,
      translate: parentCtx.translate,
    },
    params
  );
}

class CodeTarget {
  name: string;
  signature: string = "";
  indentLevel = 0;
  loopLevel = 0;
  code: string[] = [];
  hasRoot = false;
  hasCache = false;

  constructor(name: string) {
    this.name = name;
  }

  addLine(line: string, idx?: number) {
    const prefix = new Array(this.indentLevel + 2).join("  ");
    if (idx === undefined) {
      this.code.push(prefix + line);
    } else {
      this.code.splice(idx, 0, prefix + line);
    }
  }
}

export const TRANSLATABLE_ATTRS = ["label", "title", "placeholder", "alt"];
const translationRE = /^(\s*)([\s\S]+?)(\s*)$/;

export class QWebCompiler {
  blocks: BlockDescription[] = [];
  nextId = 1;
  nextBlockId = 1;
  shouldProtectScope: boolean = false;
  shouldDefineAssign: boolean = false;
  shouldDefineKey0: boolean = false;
  hasSafeContext: boolean | null = null;
  hasRef: boolean = false;
  // hasTCall: boolean = false;
  isDebug: boolean = false;
  functions: CodeTarget[] = [];
  target = new CodeTarget("main");
  templateName: string;
  template: string;
  translateFn: (s: string) => string;
  translatableAttributes: string[];
  ast: AST;
  staticCalls: { id: string; template: string }[] = [];

  constructor(template: string, options: CompileOptions = {}) {
    this.template = template;
    this.translateFn = options.translateFn || ((s: string) => s);
    this.translatableAttributes = options.translatableAttributes || TRANSLATABLE_ATTRS;
    this.ast = parse(template);
    if (options.name) {
      this.templateName = options.name;
    } else {
      if (template.length > 250) {
        this.templateName = template.slice(0, 250) + "...";
      } else {
        this.templateName = template;
      }
    }
  }

  compile(): TemplateFunction {
    const ast = this.ast;
    this.isDebug = ast.type === ASTType.TDebug;
    BlockDescription.nextBlockId = 1;
    BlockDescription.nextDataId = 1;
    this.compileAST(ast, {
      block: null,
      index: 0,
      forceNewBlock: false,
      isLast: true,
      translate: true,
    });
    const code = this.generateCode();
    return new Function("bdom, helpers", code) as TemplateFunction;
  }

  addLine(line: string) {
    this.target.addLine(line);
  }

  generateId(prefix: string = ""): string {
    return `${prefix}${this.nextId++}`;
  }

  generateBlockName(): string {
    return `block${this.blocks.length + 1}`;
  }

  insertAnchor(block: BlockDescription) {
    const tag = `block-child-${block.children.length}`;
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
        block.parentVar = `c${parentBlock.id}`;
      }
    }
    return block;
  }

  insertBlock(expression: string, block: BlockDescription, ctx: Context): string | null {
    let id: string | null = null;
    const blockExpr = block.generateExpr(expression);
    if (block.parentVar) {
      this.addLine(
        `${block.parentVar}[${ctx.index}] = withKey(${blockExpr}, key${this.target.loopLevel});`
      );
    } else if (block.isRoot && !ctx.preventRoot) {
      this.addLine(`return ${blockExpr};`);
    } else {
      this.addLine(`let ${block.varName} = ${blockExpr};`);
    }
    return id;
  }

  generateCode(): string {
    let mainCode = this.target.code;
    this.target.code = [];
    this.target.indentLevel = 0;
    // define blocks and utility functions
    this.addLine(`let { text, createBlock, list, multi, html, toggler, component } = bdom;`);
    this.addLine(
      `let { withDefault, getTemplate, prepareList, withKey, zero, call, callSlot, capture, shallowEqual } = helpers;`
    );
    if (this.shouldDefineAssign) {
      this.addLine(`let assign = Object.assign;`);
    }

    for (let { id, template } of this.staticCalls) {
      this.addLine(`const ${id} = getTemplate(${template});`);
    }

    // define all blocks
    if (this.blocks.length) {
      this.addLine(``);
      for (let block of this.blocks) {
        if (block.dom) {
          this.addLine(`let ${block.blockName} = createBlock(\`${block.asXmlString()}\`);`);
        }
      }
    }

    // define all slots
    for (let fn of this.functions) {
      this.generateFunctions(fn);
    }

    // // generate main code
    this.target.indentLevel = 0;
    this.addLine(``);
    this.addLine(`return function template(ctx, node, key = "") {`);
    if (this.hasRef) {
      this.addLine(`  const refs = ctx.__owl__.refs;`);
    }
    if (this.shouldProtectScope) {
      this.addLine(`  ctx = Object.create(ctx);`);
    }
    if (this.target.hasCache) {
      this.addLine(`  let cache = ctx.cache || {};`);
      this.addLine(`  let nextCache = ctx.cache = {};`);
    }
    for (let line of mainCode) {
      this.addLine(line);
    }
    if (!this.target.hasRoot) {
      throw new Error("missing root block");
    }
    this.addLine("}");
    const code = this.target.code.join("\n");

    if (this.isDebug) {
      const msg = `[Owl Debug]\n${code}`;
      console.log(msg);
    }
    return code;
  }

  generateFunctions(fn: CodeTarget) {
    this.addLine("");
    this.addLine(`const ${fn.name} = ${fn.signature}`);
    if (fn.hasCache) {
      this.addLine(`let cache = ctx.cache || {};`);
      this.addLine(`let nextCache = ctx.cache = {};`);
    }
    for (let line of fn.code) {
      this.addLine(line);
    }
    this.addLine(`}`);
  }

  captureExpression(expr: string): string {
    const tokens = compileExprToArray(expr);
    const mapping = new Map<string, string>();
    return tokens
      .map((tok) => {
        if (tok.varName) {
          if (!mapping.has(tok.varName)) {
            const varId = this.generateId("v");
            mapping.set(tok.varName, varId);
            this.addLine(`const ${varId} = ${tok.value};`);
          }
          tok.value = mapping.get(tok.varName)!;
        }
        return tok.value;
      })
      .join("");
  }

  compileAST(ast: AST, ctx: Context) {
    switch (ast.type) {
      case ASTType.Comment:
        this.compileComment(ast, ctx);
        break;
      case ASTType.Text:
        this.compileText(ast, ctx);
        break;
      case ASTType.DomNode:
        this.compileTDomNode(ast, ctx);
        break;
      case ASTType.TEsc:
        this.compileTEsc(ast, ctx);
        break;
      case ASTType.TRaw:
        this.compileTRaw(ast, ctx);
        break;
      case ASTType.TIf:
        this.compileTIf(ast, ctx);
        break;
      case ASTType.TForEach:
        this.compileTForeach(ast, ctx);
        break;
      case ASTType.TKey:
        this.compileTKey(ast, ctx);
        break;
      case ASTType.Multi:
        this.compileMulti(ast, ctx);
        break;
      case ASTType.TCall:
        this.compileTCall(ast, ctx);
        break;
      case ASTType.TCallBlock:
        this.compileTCallBlock(ast, ctx);
        break;
      case ASTType.TSet:
        this.compileTSet(ast, ctx);
        break;
      case ASTType.TComponent:
        this.compileComponent(ast, ctx);
        break;
      case ASTType.TDebug:
        this.compileDebug(ast, ctx);
        break;
      case ASTType.TLog:
        this.compileLog(ast, ctx);
        break;
      case ASTType.TSlot:
        this.compileTSlot(ast, ctx);
        break;
      case ASTType.TTranslation:
        this.compileTTranslation(ast, ctx);
        break;
    }
  }

  compileDebug(ast: ASTDebug, ctx: Context) {
    this.addLine(`debugger;`);
    if (ast.content) {
      this.compileAST(ast.content, ctx);
    }
  }

  compileLog(ast: ASTLog, ctx: Context) {
    this.addLine(`console.log(${compileExpr(ast.expr)});`);
    if (ast.content) {
      this.compileAST(ast.content, ctx);
    }
  }
  compileComment(ast: ASTComment, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    const isNewBlock = !block || forceNewBlock;
    if (isNewBlock) {
      block = this.createBlock(block, "block", ctx);
      this.blocks.push(block);
    }
    const text = xmlDoc.createComment(ast.value);
    block!.insert(text);
    if (isNewBlock) {
      this.insertBlock("", block!, ctx);
    }
  }

  compileText(ast: ASTText, ctx: Context) {
    let { block, forceNewBlock } = ctx;

    let value = ast.value;
    if (value && ctx.translate !== false) {
      const match = translationRE.exec(value) as any;
      value = match[1] + this.translateFn(match[2]) + match[3];
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
  }

  generateHandlerCode(handler: string, event: string = ""): string {
    let args: string = "";
    const name: string = handler.replace(/\(.*\)/, function (_args) {
      args = _args.slice(1, -1);
      return "";
    });
    const isMethodCall = name.match(FNAMEREGEXP);
    if (isMethodCall) {
      let handlerFn: string;
      if (args) {
        const argId = this.generateId("arg");
        this.addLine(`const ${argId} = [${compileExpr(args)}];`);
        handlerFn = `'${name}', ${argId}`;
      } else {
        handlerFn = `'${name}'`;
      }
      return `[${event ? `\`${event}\`` + ", " : ""}ctx, ${handlerFn!}]`;
    } else {
      let code = this.captureExpression(handler);
      code = `{const res = (() => { return ${code} })(); if (typeof res === 'function') { res(e) }}`;
      let handlerFn = `(e) => ${code}`;
      if (event) {
        handlerFn = `[\`${event}\`, ${handlerFn}]`;
      }
      return handlerFn;
    }
  }

  compileTDomNode(ast: ASTDomNode, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    const isNewBlock = !block || forceNewBlock;
    let codeIdx = this.target.code.length;
    if (isNewBlock) {
      block = this.createBlock(block, "block", ctx);
      this.blocks.push(block);
    }
    // attributes
    const attrs: { [key: string]: string } = {};
    for (let key in ast.attrs) {
      if (key.startsWith("t-attf")) {
        let expr = interpolate(ast.attrs[key]);
        const idx = block!.insertData(expr);
        attrs["block-attribute-" + idx] = key.slice(7);
      } else if (key.startsWith("t-att")) {
        let expr = compileExpr(ast.attrs[key]);
        const idx = block!.insertData(expr);
        if (key === "t-att") {
          attrs[`block-attributes`] = String(idx);
        } else {
          attrs[`block-attribute-${idx}`] = key.slice(6);
        }
      } else if (this.translatableAttributes.includes(key)) {
        attrs[key] = this.translateFn(ast.attrs[key]);
      } else {
        attrs[key] = ast.attrs[key];
      }
    }

    // event handlers
    for (let ev in ast.on) {
      const name = this.generateHandlerCode(ast.on[ev]);
      const idx = block!.insertData(name);
      attrs[`block-handler-${idx}`] = ev;
    }

    // t-ref
    if (ast.ref) {
      this.hasRef = true;
      const isDynamic = INTERP_REGEXP.test(ast.ref);
      if (isDynamic) {
        const str = ast.ref.replace(
          INTERP_REGEXP,
          (expr) => "${" + this.captureExpression(expr.slice(2, -2)) + "}"
        );
        const idx = block!.insertData(`(el) => refs[\`${str}\`] = el`);
        attrs["block-ref"] = String(idx);
      } else {
        const idx = block!.insertData(`(el) => refs[\`${ast.ref}\`] = el`);
        attrs["block-ref"] = String(idx);
      }
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
        const subCtx: Context = createContext(ctx, {
          block,
          index: block!.childNumber,
          forceNewBlock: false,
          isLast: ctx.isLast && i === children.length - 1,
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
          if (code[i].trimStart().startsWith(`let ${current!.varName}`)) {
            code[i] = code[i].replace(`let ${current!.varName}`, current!.varName);
            current = children.shift();
            if (!current) break;
          }
        }
        this.target.addLine(`let ${block!.children.map((c) => c.varName)};`, codeIdx);
      }
    }
  }

  compileTEsc(ast: ASTTEsc, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    let expr: string;
    if (ast.expr === "0") {
      expr = `ctx[zero]`;
    } else {
      expr = compileExpr(ast.expr);
      if (ast.defaultValue) {
        expr = `withDefault(${expr}, \`${ast.defaultValue}\`)`;
      }
    }
    if (!block || forceNewBlock) {
      block = this.createBlock(block, "text", ctx);
      this.insertBlock(`text(${expr})`, block, { ...ctx, forceNewBlock: forceNewBlock && !block });
    } else {
      const idx = block.insertData(expr);
      const text = xmlDoc.createElement(`block-text-${idx}`);
      block.insert(text);
    }
  }

  compileTRaw(ast: ASTTRaw, ctx: Context) {
    let { block } = ctx;
    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "html", ctx);
    let expr = ast.expr === "0" ? "ctx[zero]" : compileExpr(ast.expr);
    if (ast.body) {
      const nextId = BlockDescription.nextBlockId;
      const subCtx: Context = createContext(ctx);
      this.compileAST({ type: ASTType.Multi, content: ast.body }, subCtx);
      expr = `withDefault(${expr}, b${nextId})`;
    }
    this.insertBlock(`html(${expr})`, block, ctx);
  }

  compileTIf(ast: ASTTif, ctx: Context, nextNode?: ASTDomNode) {
    let { block, forceNewBlock, index } = ctx;
    let currentIndex = index;
    const codeIdx = this.target.code.length;
    const isNewBlock = !block || (block.type !== "multi" && forceNewBlock);
    if (block) {
      block.hasDynamicChildren = true;
    }
    if (!block || (block.type !== "multi" && forceNewBlock)) {
      block = this.createBlock(block, "multi", ctx);
    }
    this.addLine(`if (${compileExpr(ast.condition)}) {`);
    this.target.indentLevel++;
    this.insertAnchor(block!);
    const subCtx: Context = createContext(ctx, { block, index: currentIndex });
    this.compileAST(ast.content, subCtx);
    this.target.indentLevel--;
    if (ast.tElif) {
      for (let clause of ast.tElif) {
        this.addLine(`} else if (${compileExpr(clause.condition)}) {`);
        this.target.indentLevel++;
        this.insertAnchor(block);
        const subCtx: Context = createContext(ctx, { block, index: currentIndex });
        this.compileAST(clause.content, subCtx);
        this.target.indentLevel--;
      }
    }
    if (ast.tElse) {
      this.addLine(`} else {`);
      this.target.indentLevel++;
      this.insertAnchor(block);
      const subCtx: Context = createContext(ctx, { block, index: currentIndex });
      this.compileAST(ast.tElse, subCtx);
      this.target.indentLevel--;
    }
    this.addLine("}");
    if (isNewBlock) {
      // note: this part is duplicated from end of compiledomnode:
      if (block!.children.length) {
        const code = this.target.code;
        const children = block!.children.slice();
        let current = children.shift();
        for (let i = codeIdx; i < code.length; i++) {
          if (code[i].trimStart().startsWith(`let ${current!.varName}`)) {
            code[i] = code[i].replace(`let ${current!.varName}`, current!.varName);
            current = children.shift();
            if (!current) break;
          }
        }
        this.target.addLine(`let ${block!.children.map((c) => c.varName)};`, codeIdx);
      }

      // note: this part is duplicated from end of compilemulti:
      const args = block!.children.map((c) => c.varName).join(", ");
      this.insertBlock(`multi([${args}])`, block!, ctx)!;
    }
  }

  compileTForeach(ast: ASTTForEach, ctx: Context) {
    let { block } = ctx;
    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "list", ctx);
    this.target.loopLevel++;
    const loopVar = `i${this.target.loopLevel}`;
    this.addLine(`ctx = Object.create(ctx);`);
    // const cId = this.generateId();
    const vals = `v${block.id}`;
    const keys = `k${block.id}`;
    const l = `l${block.id}`;
    const c = `c${block.id}`;
    this.addLine(
      `const [${keys}, ${vals}, ${l}, ${c}] = prepareList(${compileExpr(ast.collection)});`
    );
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
    this.addLine(`let key${this.target.loopLevel} = ${ast.key ? compileExpr(ast.key) : loopVar};`);
    let id: string;
    if (ast.memo) {
      this.target.hasCache = true;
      this.shouldDefineAssign = true;
      id = this.generateId();
      this.addLine(`let memo${id} = ${compileExpr(ast.memo)}`);
      this.addLine(`let vnode${id} = cache[key${this.target.loopLevel}];`);
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

    const subCtx: Context = createContext(ctx, { block, index: loopVar });
    this.compileAST(ast.body, subCtx);
    if (!ast.key) {
      console.warn(
        `"Directive t-foreach should always be used with a t-key! (in template: '${this.templateName}')"`
      );
    }
    if (ast.memo) {
      this.addLine(
        `nextCache[key${this.target.loopLevel}] = assign(${c}[${loopVar}], {memo: memo${id!}});`
      );
    }
    this.target.indentLevel--;
    this.target.loopLevel--;
    this.addLine(`}`);
    if (!ctx.isLast) {
      this.addLine(`ctx = ctx.__proto__;`);
    }
    this.insertBlock("l", block, ctx);
  }

  compileTKey(ast: ASTTKey, ctx: Context) {
    this.compileAST(ast.content, ctx);
  }

  compileMulti(ast: ASTMulti, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    const isNewBlock = !block || forceNewBlock;
    let codeIdx = this.target.code.length;
    if (isNewBlock) {
      const n = ast.content.filter((c) => c.type !== ASTType.TSet).length;
      if (n <= 1) {
        for (let child of ast.content) {
          this.compileAST(child, ctx);
        }
        return;
      }
      block = this.createBlock(block, "multi", ctx);
    }
    let index = 0;
    for (let i = 0, l = ast.content.length; i < l; i++) {
      const child = ast.content[i];
      const isTSet = child.type === ASTType.TSet;
      const subCtx: Context = createContext(ctx, {
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
            if (code[i].trimStart().startsWith(`let ${current!.varName}`)) {
              code[i] = code[i].replace(`let ${current!.varName}`, current!.varName);
              current = children.shift();
              if (!current) break;
            }
          }
          this.target.addLine(`let ${block!.children.map((c) => c.varName)};`, codeIdx);
        }
      }

      const args = block!.children.map((c) => c.varName).join(", ");
      this.insertBlock(`multi([${args}])`, block!, ctx)!;
    }
  }

  compileTCall(ast: ASTTCall, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    // this.hasTCall = true;
    if (ast.body) {
      this.addLine(`ctx = Object.create(ctx);`);
      const nextId = BlockDescription.nextBlockId;
      const subCtx: Context = createContext(ctx, { preventRoot: true });
      this.compileAST({ type: ASTType.Multi, content: ast.body }, subCtx);
      if (nextId !== BlockDescription.nextBlockId) {
        this.addLine(`ctx[zero] = b${nextId};`);
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
      const templateVar = this.generateId("template");
      this.addLine(`const ${templateVar} = ${subTemplate};`);
      block = this.createBlock(block, "multi", ctx);
      this.insertBlock(`call(${templateVar}, ctx, node, ${key})`, block!, {
        ...ctx,
        forceNewBlock: !block,
      });
    } else {
      const id = this.generateId(`callTemplate_`);
      this.staticCalls.push({ id, template: subTemplate });
      block = this.createBlock(block, "multi", ctx);
      this.insertBlock(`${id}(ctx, node, ${key})`, block!, { ...ctx, forceNewBlock: !block });
    }
    if (ast.body && !ctx.isLast) {
      this.addLine(`ctx = ctx.__proto__;`);
    }
  }

  compileTCallBlock(ast: ASTTCallBlock, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    if (block) {
      if (!forceNewBlock) {
        this.insertAnchor(block);
      }
    }
    block = this.createBlock(block, "multi", ctx);
    this.insertBlock(compileExpr(ast.name), block, { ...ctx, forceNewBlock: !block });
  }

  compileTSet(ast: ASTTSet, ctx: Context) {
    this.shouldProtectScope = true;
    const expr = ast.value ? compileExpr(ast.value || "") : "null";
    if (ast.body) {
      const subCtx: Context = createContext(ctx);
      const nextId = `b${BlockDescription.nextBlockId}`;
      this.compileAST({ type: ASTType.Multi, content: ast.body }, subCtx);
      const value = ast.value ? (nextId ? `withDefault(${expr}, ${nextId})` : expr) : nextId;
      this.addLine(`ctx[\`${ast.name}\`] = ${value};`);
    } else {
      let value: string;
      if (ast.defaultValue) {
        if (ast.value) {
          value = `withDefault(${expr}, \`${ast.defaultValue}\`)`;
        } else {
          value = `\`${ast.defaultValue}\``;
        }
      } else {
        value = expr;
      }
      this.addLine(`ctx[\`${ast.name}\`] = ${value};`);
    }
  }

  generateComponentKey() {
    const parts = [this.generateId("__")];
    for (let i = 0; i < this.target.loopLevel; i++) {
      parts.push(`\${key${i + 1}}`);
    }
    return parts.join("__");
  }

  compileComponent(ast: ASTComponent, ctx: Context) {
    let { block } = ctx;
    let extraArgs: { [key: string]: string } = {};

    // props
    const props: string[] = [];
    for (let p in ast.props) {
      props.push(`${p}: ${compileExpr(ast.props[p]) || undefined}`);
    }
    const propString = `{${props.join(",")}}`;

    // cmap key
    const key = this.generateComponentKey();
    let expr: string;
    if (ast.isDynamic) {
      expr = this.generateId("Comp");
      this.addLine(`let ${expr} = ${compileExpr(ast.name)};`);
    } else {
      expr = `\`${ast.name}\``;
    }
    let blockArgs = `${expr}, ${propString}, key + \`${key}\`, node, ctx`;

    // slots
    const hasSlot = !!Object.keys(ast.slots).length;
    let slotDef: string;
    if (hasSlot) {
      if (this.hasSafeContext === null) {
        this.hasSafeContext = !this.template.includes("t-set") && !this.template.includes("t-call");
      }
      let ctxStr = "ctx";
      if (this.target.loopLevel || !this.hasSafeContext) {
        ctxStr = this.generateId("ctx");
        this.addLine(`const ${ctxStr} = capture(ctx);`);
      }
      let slotStr: string[] = [];
      const initialTarget = this.target;
      for (let slotName in ast.slots) {
        let name = this.generateId("slot");
        const slot = new CodeTarget(name);
        slot.signature = "ctx => (node, key) => {";
        this.functions.push(slot);
        this.target = slot;
        const subCtx: Context = createContext(ctx);
        this.compileAST(ast.slots[slotName], subCtx);
        if (this.hasRef) {
          slot.signature = "ctx => node => {";
          slot.code.unshift(`  const refs = ctx.__owl__.refs`);
          slotStr.push(`'${slotName}': ${name}(${ctxStr})`);
        } else {
          slotStr.push(`'${slotName}': ${name}(${ctxStr})`);
        }
      }
      this.target = initialTarget;
      slotDef = `{${slotStr.join(", ")}}`;
      extraArgs.slots = slotDef;
    }

    // handlers
    const hasHandlers = Object.keys(ast.handlers).length;
    if (hasHandlers) {
      const vars = Object.keys(ast.handlers).map((ev) => {
        let id = this.generateId("h");
        this.addLine(`let ${id} = ${this.generateHandlerCode(ast.handlers[ev], ev)};`);
        return id;
      });
      extraArgs.handlers = `[${vars}]`;
    }

    if (block && ctx.forceNewBlock === false) {
      // todo: check the forcenewblock condition
      this.insertAnchor(block);
    }
    let blockExpr = `component(${blockArgs})`;
    if (Object.keys(extraArgs).length) {
      this.shouldDefineAssign = true;
      const content = Object.keys(extraArgs).map((k) => `${k}: ${extraArgs[k]}`);
      blockExpr = `assign(${blockExpr}, {${content.join(", ")}})`;
    }
    if (ast.isDynamic) {
      blockExpr = `toggler(${expr}, ${blockExpr})`;
    }
    block = this.createBlock(block, "multi", ctx);
    this.insertBlock(blockExpr, block, ctx);
  }

  compileTSlot(ast: ASTSlot, ctx: Context) {
    let { block } = ctx;
    let blockString: string;
    let slotName;
    let dynamic = false;
    if (ast.name.match(INTERP_REGEXP)) {
      dynamic = true;
      slotName = interpolate(ast.name);
    } else {
      slotName = "'" + ast.name + "'";
    }
    if (ast.defaultContent) {
      let name = this.generateId("defaultSlot");
      const slot = new CodeTarget(name);
      slot.signature = "ctx => {";
      this.functions.push(slot);
      const initialTarget = this.target;
      const subCtx: Context = createContext(ctx);
      this.target = slot;
      this.compileAST(ast.defaultContent, subCtx);
      this.target = initialTarget;
      blockString = `callSlot(ctx, node, key, ${slotName}, ${name}, ${dynamic})`;
    } else {
      if (dynamic) {
        let name = this.generateId("slot");
        this.addLine(`const ${name} = ${slotName};`);
        blockString = `toggler(${name}, callSlot(ctx, node, key, ${name}))`;
      } else {
        blockString = `callSlot(ctx, node, key, ${slotName})`;
      }
    }
    if (block) {
      this.insertAnchor(block);
    }
    block = this.createBlock(block, "multi", ctx);
    this.insertBlock(blockString, block, { ...ctx, forceNewBlock: false });
  }

  compileTTranslation(ast: ASTTranslation, ctx: Context) {
    if (ast.content) {
      this.compileAST(ast.content, Object.assign({}, ctx, { translate: false }));
    }
  }
}
