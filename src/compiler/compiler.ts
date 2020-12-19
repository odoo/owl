import type { BDom } from "../bdom";
import {
  compileExpr,
  compileExprToArray,
  interpolate,
  INTERP_GROUP_REGEXP,
  INTERP_REGEXP,
} from "./expressions";
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
  ASTType,
  parse,
} from "./parser";

import { isProp, domToString, DomType, Dom, DomNode } from "./utils";

export type Template = (context: any, refs?: any) => BDom;
export type TemplateFunction = (blocks: any, utils: any) => Template;

// export function compile(template: string, utils: typeof UTILS = UTILS): RenderFunction {
//   const templateFunction = compileTemplate(template);
//   return templateFunction(Blocks, utils);
// }

// -----------------------------------------------------------------------------
// BlockDescription
// -----------------------------------------------------------------------------

interface FunctionLine {
  path: string[];
  elemDefs: string[];
  inserter(el: string): string;
}

class BlockDescription {
  varName: string;
  blockName: string;
  buildFn: FunctionLine[] = [];
  updateFn: FunctionLine[] = [];
  currentPath: string[] = ["el"];
  dataNumber: number = 0;
  handlerNumber: number = 0;
  dom?: Dom;
  currentDom?: DomNode;
  childNumber: number = 0;
  baseClass: string = "BNode";

  constructor(varName: string, blockName: string) {
    this.varName = varName;
    this.blockName = blockName;
  }

  insert(dom: Dom) {
    if (this.currentDom) {
      this.currentDom.content.push(dom);
    } else {
      this.dom = dom;
    }
  }

  insertUpdate(inserter: (target: string) => string) {
    this.updateFn.push({ path: this.currentPath.slice(), inserter, elemDefs: [] });
  }

  insertBuild(inserter: (target: string) => string) {
    this.buildFn.push({ path: this.currentPath.slice(), inserter, elemDefs: [] });
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
}

interface CodeGroup {
  name: string;
  signature: string;
  indentLevel: number;
  code: string[];
  rootBlock: string | null;
}

export class QWebCompiler {
  blocks: BlockDescription[] = [];
  nextId = 1;
  nextBlockId = 1;
  shouldProtectScope: boolean = false;
  shouldDefineOwner: boolean = false;
  shouldDefineKey0: boolean = false;
  hasSafeContext: boolean | null = null;
  hasDefinedKey: boolean = false;
  hasRef: boolean = false;
  hasTCall: boolean = false;
  refBlocks: string[] = [];
  loopLevel: number = 0;
  isDebug: boolean = false;
  functions: CodeGroup[] = [];
  target: CodeGroup = { name: "main", signature: "", indentLevel: 0, code: [], rootBlock: null };
  templateName: string;
  template: string;
  ast: AST;

  constructor(template: string, name?: string) {
    this.template = template;
    this.ast = parse(template);
    // console.warn(this.ast);
    if (name) {
      this.templateName = name;
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
    this.compileAST(ast, { block: null, index: 0, forceNewBlock: false });
    const code = this.generateCode();
    // console.warn(code);
    return new Function("Blocks, utils", code) as TemplateFunction;
  }

  addLine(line: string) {
    const prefix = new Array(this.target.indentLevel + 2).join("  ");
    this.target.code.push(prefix + line);
  }

  generateId(prefix: string = ""): string {
    return `${prefix}${this.nextId++}`;
  }

  generateBlockName(): string {
    return `Block${this.blocks.length + 1}`;
  }

  generateSafeCtx(): string {
    return `Object.assign(Object.create(ctx), ctx)`;
  }

  getNextBlockId(): () => string | null {
    const id = this.nextBlockId;
    return () => {
      return this.nextBlockId !== id ? `b${id}` : null;
    };
  }

  insertAnchor(block: BlockDescription) {
    const index = block.childNumber;
    const anchor: Dom = { type: DomType.Node, tag: "owl-anchor", attrs: {}, content: [] };
    block.insert(anchor);
    block.insertBuild((el) => `this.anchors[${index}] = ${el};`);
    block.currentPath = [`anchors[${block.childNumber}]`];
    block.childNumber++;
  }

  insertBlock(expression: string, ctx: Context): string | null {
    const { block, index, forceNewBlock } = ctx;
    const shouldBindVar = forceNewBlock || !this.target.rootBlock;
    let prefix = "";
    let parentStr = "";
    let id: string | null = null;
    if (shouldBindVar) {
      id = "b" + this.nextBlockId++;
      prefix = `const ${id} = `;
    }
    if (block) {
      parentStr = `${block.varName}.children[${index}] = `;
    }
    this.addLine(`${prefix}${parentStr}${expression};`);
    if (!this.target.rootBlock) {
      this.target.rootBlock = id;
    }
    return id;
  }

  generateCode(): string {
    let mainCode = this.target.code;
    this.target.code = [];
    this.target.indentLevel = 0;
    // define blocks and utility functions
    this.addLine(
      `let {BCollection, BComponent, BComponentH, BHtml, BMulti, BNode, BStatic, BText} = Blocks;`
    );
    this.addLine(
      `let {elem, toString, withDefault, call, zero, scope, getValues, owner, callSlot} = utils;`
    );

    // define all blocks
    for (let block of this.blocks) {
      this.generateBlockCode(block);
    }

    // define all slots
    for (let fn of this.functions) {
      this.generateFunctions(fn);
    }

    // micro optimization: remove trailing ctx = ctx.__proto__;
    if (mainCode[mainCode.length - 1] === `  ctx = ctx.__proto__;`) {
      mainCode = mainCode.slice(0, -1);
    }

    // generate main code
    this.target.indentLevel = 0;
    this.addLine(``);
    if (this.hasRef || this.hasTCall) {
      this.addLine(`return (ctx, refs = {}) => {`);
    } else {
      this.addLine(`return ctx => {`);
    }
    if (this.shouldProtectScope || this.shouldDefineOwner) {
      this.addLine(`  ctx = Object.create(ctx);`);
    }
    if (this.shouldDefineOwner) {
      this.addLine(`  ctx[scope] = 1;`);
    }
    if (this.shouldDefineKey0) {
      this.addLine(`  let key0;`);
    }
    for (let line of mainCode) {
      this.addLine(line);
    }
    if (!this.target.rootBlock) {
      throw new Error("missing root block");
    }
    if (this.hasRef || this.hasTCall) {
      this.addLine(`  ${this.target.rootBlock}.refs = refs;`);
    }
    this.addLine(`  return ${this.target.rootBlock};`);
    this.addLine("}");
    const code = this.target.code.join("\n");

    if (this.isDebug) {
      const msg = `[Owl Debug]\n${code}`;
      console.log(msg);
    }
    return code;
  }

  generateBlockCode(block: BlockDescription) {
    const isStatic =
      block.buildFn.length === 0 && block.updateFn.length === 0 && block.childNumber === 0;
    if (isStatic) {
      block.baseClass = "BStatic";
    }
    this.addLine(``);
    this.addLine(`class ${block.blockName} extends ${block.baseClass} {`);
    this.target.indentLevel++;
    if (block.dom) {
      this.addLine(`static el = elem(\`${domToString(block.dom)}\`);`);
    }
    if (block.childNumber) {
      this.addLine(`children = new Array(${block.childNumber});`);
      this.addLine(`anchors = new Array(${block.childNumber});`);
    }
    if (block.dataNumber) {
      this.addLine(`data = new Array(${block.dataNumber});`);
    }
    if (block.handlerNumber) {
      this.addLine(`handlers = new Array(${block.handlerNumber});`);
    }
    if (block.buildFn.length) {
      const updateInfo = block.buildFn;
      this.addLine(`build() {`);
      this.target.indentLevel++;
      if (updateInfo.length === 1) {
        const { path, inserter } = updateInfo[0];
        const target = `this.${path.join(".")}`;
        this.addLine(inserter(target));
      } else {
        this.generateFunctionCode(block.buildFn);
      }
      this.target.indentLevel--;
      this.addLine(`}`);
    }
    if (block.updateFn.length) {
      const updateInfo = block.updateFn;
      this.addLine(`update() {`);
      this.target.indentLevel++;
      if (updateInfo.length === 1) {
        const { path, inserter } = updateInfo[0];
        const target = `this.${path.join(".")}`;
        this.addLine(inserter(target));
      } else {
        this.generateFunctionCode(block.updateFn);
      }
      this.target.indentLevel--;
      this.addLine(`}`);
    }

    this.target.indentLevel--;
    this.addLine(`}`);
  }

  generateFunctions(fn: CodeGroup) {
    this.addLine("");
    this.addLine(`const ${fn.name} = ${fn.signature}`);
    for (let line of fn.code) {
      this.addLine(line);
    }
    this.addLine(`  return ${fn.rootBlock};`);
    this.addLine(`}`);
  }

  generateFunctionCode(lines: FunctionLine[]) {
    // build tree of paths
    const tree: any = {};
    let i = 1;
    // console.warn('lines before', lines)
    for (let line of lines) {
      let current: any = tree;
      let el: string = `this`;
      for (let p of line.path.slice()) {
        if (current[p]) {
        } else {
          current[p] = { firstChild: null, nextSibling: null, line };
        }
        if (current.firstChild && current.nextSibling && !current.name) {
          current.name = `el${i++}`;
          current.line.elemDefs.push(`const ${current.name} = ${el};`);
          // this.addLine(`const ${current.name} = ${el};`);
        }
        el = `${current.name ? current.name : el}.${p}`;
        current = current[p];
        if (current.target && !current.name) {
          current.name = `el${i++}`;
          current.line.elemDefs.push(`const ${current.name} = ${el};`);
          // this.addLine(`const ${current.name} = ${el};`);
        }
      }
      current.target = true;
    }
    // console.warn('lines after', lines)
    // console.warn(tree);
    for (let line of lines) {
      const { path, inserter, elemDefs } = line;
      for (let elem of elemDefs) {
        this.addLine(elem);
      }
      let current: any = tree;
      let el = `this`;
      for (let p of path.slice()) {
        current = current[p];
        if (current) {
          if (current.name) {
            el = current.name;
          } else {
            el = `${el}.${p}`;
          }
        } else {
          el = `${el}.${p}`;
        }
      }
      this.addLine(inserter(el));
    }
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

  compileAST(ast: AST, ctx: Context, nextNode?: ASTDomNode) {
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
        this.compileTIf(ast, ctx, nextNode);
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
        this.compileTSet(ast);
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
    if (!block || forceNewBlock) {
      const name = this.generateBlockName();
      const id = this.insertBlock(`new ${name}()`, ctx)!;
      block = new BlockDescription(id, name);
      this.blocks.push(block);
    }
    const text: Dom = { type: DomType.Comment, value: ast.value };
    block.insert(text);
  }

  compileText(ast: ASTText, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    if (!block || forceNewBlock) {
      this.insertBlock(`new BText(\`${ast.value}\`)`, {
        ...ctx,
        forceNewBlock: forceNewBlock && !block,
      });
    } else {
      const type = ast.type === ASTType.Text ? DomType.Text : DomType.Comment;
      const text: Dom = { type, value: ast.value };
      block.insert(text);
    }
  }

  generateHandlerCode(
    block: BlockDescription,
    handlers: { [key: string]: string },
    insert?: (index: number) => void
  ) {
    for (let event in handlers) {
      this.shouldDefineOwner = true;
      const index = block.handlerNumber;
      block.handlerNumber++;
      if (insert) {
        insert(index);
      }
      const value = handlers[event];
      let args: string = "";
      let code: string = "";
      const name: string = value.replace(/\(.*\)/, function (_args) {
        args = _args.slice(1, -1);
        return "";
      });
      const isMethodCall = name.match(FNAMEREGEXP);
      if (isMethodCall) {
        if (args) {
          const argId = this.generateId("arg");
          this.addLine(`const ${argId} = [${compileExpr(args)}];`);
          code = `owner(ctx)['${name}'](...${argId}, e)`;
        } else {
          code = `owner(ctx)['${name}'](e)`;
        }
      } else {
        code = this.captureExpression(value);
      }
      this.addLine(`${block.varName}.handlers[${index}] = [\`${event}\`, (e) => ${code}, ctx];`);
    }
  }

  compileTDomNode(ast: ASTDomNode, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    if (!block || forceNewBlock) {
      const name = this.generateBlockName();
      const id = this.insertBlock(`new ${name}()`, ctx)!;
      block = new BlockDescription(id, name);
      this.blocks.push(block);
    }

    // attributes
    const staticAttrs: { [key: string]: string } = {};
    const dynAttrs: { [key: string]: string } = {};
    for (let key in ast.attrs) {
      if (key.startsWith("t-attf")) {
        dynAttrs[key.slice(7)] = interpolate(ast.attrs[key]);
      } else if (key.startsWith("t-att")) {
        dynAttrs[key.slice(6)] = compileExpr(ast.attrs[key]);
      } else {
        staticAttrs[key] = ast.attrs[key];
      }
    }
    if (Object.keys(dynAttrs).length) {
      for (let key in dynAttrs) {
        const idx = block.dataNumber;
        block.dataNumber++;
        this.addLine(`${block.varName}.data[${idx}] = ${dynAttrs[key]};`);
        if (key === "class") {
          block.insertUpdate((el) => `this.updateClass(${el}, this.data[${idx}]);`);
        } else {
          if (key) {
            block.insertUpdate((el) => `this.updateAttr(${el}, \`${key}\`, this.data[${idx}]);`);
            if (isProp(ast.tag, key)) {
              block.insertUpdate((el) => `this.updateProp(${el}, \`${key}\`, this.data[${idx}]);`);
            }
          } else {
            block.insertUpdate((el) => `this.updateAttrs(${el}, this.data[${idx}]);`);
          }
        }
      }
    }

    // event handlers
    const insert = (index: number) =>
      block!.insertBuild((el) => `this.setupHandler(${el}, ${index});`);
    this.generateHandlerCode(block, ast.on, insert);

    // t-ref
    if (ast.ref) {
      this.hasRef = true;
      this.refBlocks.push(block.varName);
      if (this.target.rootBlock !== block.varName) {
        this.addLine(`${block.varName}.refs = refs;`);
      }
      const isDynamic = INTERP_REGEXP.test(ast.ref);
      if (isDynamic) {
        const str = ast.ref.replace(INTERP_REGEXP, (expr) => this.captureExpression(expr));
        const index = block.dataNumber;
        block.dataNumber++;
        const expr = str.replace(INTERP_GROUP_REGEXP, (s) => "${" + s.slice(2, -2) + "}");
        this.addLine(`${block.varName}.data[${index}] = \`${expr}\`;`);
        block.insertUpdate((el) => `this.refs[this.data[${index}]] = ${el};`);
      } else {
        block.insertUpdate((el) => `this.refs[\`${ast.ref}\`] = ${el};`);
      }
    }

    const dom: Dom = { type: DomType.Node, tag: ast.tag, attrs: staticAttrs, content: [] };
    block.insert(dom);
    if (ast.content.length) {
      const initialDom = block.currentDom;
      block.currentDom = dom;
      const path = block.currentPath.slice();
      block.currentPath.push("firstChild");
      const children = ast.content;
      for (let i = 0; i < children.length; i++) {
        const child = ast.content[i];
        const subCtx: Context = {
          block: block,
          index: block.childNumber,
          forceNewBlock: false,
        };
        const next =
          children[i + 1] && children[i + 1].type === ASTType.DomNode
            ? children[i + 1]
            : (undefined as any);
        this.compileAST(child, subCtx, next);
        if (child.type !== ASTType.TSet) {
          block.currentPath.push("nextSibling");
        }
      }
      block.currentPath = path;
      block.currentDom = initialDom;
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
      this.insertBlock(`new BText(${expr})`, { ...ctx, forceNewBlock: forceNewBlock && !block });
    } else {
      const text: Dom = { type: DomType.Node, tag: "owl-text", attrs: {}, content: [] };
      block.insert(text);
      const idx = block.dataNumber;
      block.dataNumber++;
      this.addLine(`${block.varName}.data[${idx}] = ${expr};`);
      if (ast.expr === "0") {
        block.insertUpdate((el) => `${el}.textContent = this.data[${idx}];`);
      } else {
        block.insertUpdate((el) => `${el}.textContent = toString(this.data[${idx}]);`);
      }
    }
  }

  compileTRaw(ast: ASTTRaw, ctx: Context) {
    let { block, index } = ctx;
    if (!block) {
      const id = this.insertBlock("new BMulti(1)", ctx)!;
      block = new BlockDescription(id, "BMulti");
    }
    this.insertAnchor(block);
    let expr = ast.expr === "0" ? "ctx[zero]" : compileExpr(ast.expr);
    if (ast.body) {
      const nextIdCb = this.getNextBlockId();
      const subCtx: Context = { block: null, index: 0, forceNewBlock: true };
      this.compileAST({ type: ASTType.Multi, content: ast.body }, subCtx);
      const nextId = nextIdCb();
      if (nextId) {
        expr = `withDefault(${expr}, ${nextId})`;
      }
    }
    this.addLine(`${block.varName}.children[${index}] = new BHtml(${expr});`);
  }

  compileTIf(ast: ASTTif, ctx: Context, nextNode?: ASTDomNode) {
    let { block, index, forceNewBlock } = ctx;
    if (!block || (block.blockName !== "BMulti" && forceNewBlock)) {
      const n = 1 + (ast.tElif ? ast.tElif.length : 0) + (ast.tElse ? 1 : 0);
      const id = this.insertBlock(`new BMulti(${n})`, ctx)!;
      block = new BlockDescription(id, "BMulti");
    }
    this.addLine(`if (${compileExpr(ast.condition)}) {`);
    this.target.indentLevel++;
    this.insertAnchor(block);
    const subCtx: Context = { block: block, index: index, forceNewBlock: true };

    this.compileAST(ast.content, subCtx);
    this.target.indentLevel--;
    if (ast.tElif) {
      for (let clause of ast.tElif) {
        this.addLine(`} else if (${compileExpr(clause.condition)}) {`);
        this.target.indentLevel++;
        block.currentPath.push("nextSibling");
        this.insertAnchor(block);
        const subCtx: Context = {
          block: block,
          index: block.childNumber - 1,
          forceNewBlock: true,
        };
        this.compileAST(clause.content, subCtx);
        this.target.indentLevel--;
      }
    }
    if (ast.tElse) {
      this.addLine(`} else {`);
      this.target.indentLevel++;
      block.currentPath.push("nextSibling");
      this.insertAnchor(block);
      const subCtx: Context = {
        block: block,
        index: block.childNumber - 1,
        forceNewBlock: true,
      };
      this.compileAST(ast.tElse, subCtx);

      this.target.indentLevel--;
    }
    this.addLine("}");
  }

  compileTForeach(ast: ASTTForEach, ctx: Context) {
    const { block } = ctx;
    const cId = this.generateId();
    const vals = `v${cId}`;
    const keys = `k${cId}`;
    const l = `l${cId}`;
    this.addLine(`const [${vals}, ${keys}, ${l}] = getValues(${compileExpr(ast.collection)});`);

    if (block) {
      this.insertAnchor(block);
    }
    const id = this.insertBlock(`new BCollection(${l})`, { ...ctx, forceNewBlock: true })!;
    this.loopLevel++;
    const loopVar = `i${this.loopLevel}`;
    this.addLine(`ctx = Object.create(ctx);`);
    this.addLine(`for (let ${loopVar} = 0; ${loopVar} < ${l}; ${loopVar}++) {`);
    this.target.indentLevel++;
    this.addLine(`ctx[\`${ast.elem}\`] = ${vals}[${loopVar}];`);
    this.addLine(`ctx[\`${ast.elem}_first\`] = ${loopVar} === 0;`);
    this.addLine(`ctx[\`${ast.elem}_last\`] = ${loopVar} === ${vals}.length - 1;`);
    this.addLine(`ctx[\`${ast.elem}_index\`] = ${loopVar};`);
    this.addLine(`ctx[\`${ast.elem}_value\`] = ${keys}[${loopVar}];`);
    this.addLine(`let key${this.loopLevel} = ${ast.key ? compileExpr(ast.key) : loopVar};`);
    const collectionBlock = new BlockDescription(id, "Collection");
    const subCtx: Context = {
      block: collectionBlock,
      index: loopVar,
      forceNewBlock: true,
    };
    const initialState = this.hasDefinedKey;
    this.hasDefinedKey = false;
    this.compileAST(ast.body, subCtx);
    // const key = this.key || loopVar;
    if (!ast.key && !this.hasDefinedKey) {
      console.warn(
        `"Directive t-foreach should always be used with a t-key! (in template: '${this.templateName}')"`
      );
    }
    this.addLine(`${id}.keys[${loopVar}] = key${this.loopLevel};`);
    this.hasDefinedKey = initialState;

    this.target.indentLevel--;
    this.addLine(`}`);
    this.loopLevel--;
    this.addLine(`ctx = ctx.__proto__;`);
  }

  compileTKey(ast: ASTTKey, ctx: Context) {
    if (this.loopLevel === 0) {
      this.shouldDefineKey0 = true;
    }
    this.addLine(`key${this.loopLevel} = ${compileExpr(ast.expr)};`);
    this.hasDefinedKey = true;
    this.compileAST(ast.content, ctx);
  }

  compileMulti(ast: ASTMulti, ctx: Context) {
    let { block, forceNewBlock } = ctx;
    if (!block || forceNewBlock) {
      const n = ast.content.filter((c) => c.type !== ASTType.TSet).length;
      if (n <= 1) {
        for (let child of ast.content) {
          this.compileAST(child, ctx);
        }
        return;
      }
      const id = this.insertBlock(`new BMulti(${n})`, ctx)!;
      block = new BlockDescription(id, "BMulti");
    }

    let index = 0;
    for (let i = 0; i < ast.content.length; i++) {
      const child = ast.content[i];
      const isTSet = child.type === ASTType.TSet;
      const subCtx: Context = { block: block, index: index, forceNewBlock: !isTSet };
      this.compileAST(child, subCtx);
      if (!isTSet) {
        index++;
      }
    }
  }

  compileTCall(ast: ASTTCall, ctx: Context) {
    const { block, forceNewBlock } = ctx;
    this.shouldDefineOwner = true;
    this.hasTCall = true;
    if (ast.body) {
      const targetRoot = this.target.rootBlock;
      this.addLine(`ctx = Object.create(ctx);`);
      const nextIdCb = this.getNextBlockId();
      const subCtx: Context = { block: null, index: 0, forceNewBlock: true };
      this.compileAST({ type: ASTType.Multi, content: ast.body }, subCtx);
      const nextId = nextIdCb();
      if (nextId) {
        this.addLine(`ctx[zero] = ${nextId};`);
      }
      this.target.rootBlock = targetRoot;
    }

    const isDynamic = INTERP_REGEXP.test(ast.name);
    const subTemplate = isDynamic ? interpolate(ast.name) : "`" + ast.name + "`";

    if (block) {
      if (!forceNewBlock) {
        this.insertAnchor(block);
      }
    }
    this.insertBlock(`call(${subTemplate}, ctx, refs)`, { ...ctx, forceNewBlock: !block });
    if (ast.body) {
      this.addLine(`ctx = ctx.__proto__;`);
    }
  }

  compileTCallBlock(ast: ASTTCallBlock, ctx: Context) {
    const { block, forceNewBlock } = ctx;
    if (block) {
      if (!forceNewBlock) {
        this.insertAnchor(block);
      }
    }
    this.insertBlock(compileExpr(ast.name), { ...ctx, forceNewBlock: !block });
  }

  compileTSet(ast: ASTTSet) {
    this.shouldProtectScope = true;
    const expr = ast.value ? compileExpr(ast.value || "") : "null";
    if (ast.body) {
      const nextIdCb = this.getNextBlockId();
      const subCtx: Context = { block: null, index: 0, forceNewBlock: true };
      this.compileAST({ type: ASTType.Multi, content: ast.body }, subCtx);
      const nextId = nextIdCb();
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

  compileComponent(ast: ASTComponent, ctx: Context) {
    const { block } = ctx;
    // props
    const props: string[] = [];
    for (let p in ast.props) {
      if (p !== "class") {
        props.push(`${p}: ${compileExpr(ast.props[p]) || undefined}`);
      }
    }
    const propString = `{${props.join(",")}}`;

    // cmap key
    const parts = [this.generateId("__")];
    for (let i = 0; i < this.loopLevel; i++) {
      parts.push(`\${key${i + 1}}`);
    }
    const key = parts.join("__");
    const blockArgs = `\`${ast.name}\`, ${propString}, \`${key}\`, ctx`;

    // slots
    const hasSlot = !!Object.keys(ast.slots).length;
    let slotId: string;
    if (hasSlot) {
      if (this.hasSafeContext === null) {
        this.hasSafeContext = !this.template.includes("t-set") && !this.template.includes("t-call");
      }
      let ctxStr = "ctx";
      if (this.loopLevel || !this.hasSafeContext) {
        ctxStr = this.generateId("ctx");
        this.addLine(`const ${ctxStr} = ${this.generateSafeCtx()};`);
      }
      slotId = this.generateId("slots");
      let slotStr: string[] = [];
      const initialTarget = this.target;
      for (let slotName in ast.slots) {
        let name = this.generateId("slot");
        const slot: CodeGroup = {
          name,
          signature: "ctx => () => {",
          indentLevel: 0,
          code: [],
          rootBlock: null,
        };
        this.functions.push(slot);
        this.target = slot;
        const subCtx: Context = { block: null, index: 0, forceNewBlock: true };
        const nextId = this.getNextBlockId();
        this.compileAST(ast.slots[slotName], subCtx);
        if (this.hasRef) {
          slot.signature = "(ctx, refs) => () => {";
          slotStr.push(`'${slotName}': ${name}(${ctxStr}, refs)`);
          const id = nextId();
          if (id) {
            this.addLine(`${id}.refs = refs;`);
          }
        } else {
          slotStr.push(`'${slotName}': ${name}(${ctxStr})`);
        }
      }
      this.target = initialTarget;
      this.addLine(`const ${slotId} = {${slotStr.join(", ")}};`);
    }

    if (block) {
      this.insertAnchor(block);
    }

    let id: string;
    const hasClass = "class" in ast.props;
    const shouldForce = hasSlot || hasClass;

    if (Object.keys(ast.handlers).length) {
      // event handlers
      const n = Object.keys(ast.handlers).length;
      id = this.insertBlock(`new BComponentH(${n}, ${blockArgs})`, {
        ...ctx,
        forceNewBlock: true,
      })!;
      const cblock = { varName: id, handlerNumber: 0 } as BlockDescription;
      this.generateHandlerCode(cblock, ast.handlers);
    } else {
      id = this.insertBlock(`new BComponent(${blockArgs})`, {
        ...ctx,
        forceNewBlock: shouldForce,
      })!;
    }

    // class and style
    if ("class" in ast.props) {
      this.addLine(`${id!}.parentClass = \`${ast.props.class}\`;`);
    }

    if (hasSlot) {
      this.addLine(`${id!}.component.__owl__.slots = ${slotId!};`);
    }
  }

  compileTSlot(ast: ASTSlot, ctx: Context) {
    const { block } = ctx;

    let blockString: string;
    if (ast.defaultContent) {
      let name = this.generateId("defaultSlot");
      const slot: CodeGroup = {
        name,
        signature: "ctx => {",
        indentLevel: 0,
        code: [],
        rootBlock: null,
      };
      this.functions.push(slot);
      const initialTarget = this.target;
      const subCtx: Context = { block: null, index: 0, forceNewBlock: true };
      this.target = slot;
      this.compileAST(ast.defaultContent, subCtx);
      this.target = initialTarget;
      blockString = `callSlot(ctx, '${ast.name}', ${name})`;
    } else {
      blockString = `callSlot(ctx, '${ast.name}')`;
    }

    if (block) {
      this.insertAnchor(block);
    }
    this.insertBlock(blockString, { ...ctx, forceNewBlock: false });
  }
}
