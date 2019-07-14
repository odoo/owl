import { compileExpr, QWebVar } from "./expression_parser";

//------------------------------------------------------------------------------
// Compilation Context
//------------------------------------------------------------------------------

export class Context {
  nextID: number = 1;
  code: string[] = [];
  variables: { [key: string]: QWebVar } = {};
  escaping: boolean = false;
  parentNode: number | null = null;
  parentTextNode: number | null = null;
  rootNode: number | null = null;
  indentLevel: number = 0;
  rootContext: Context;
  caller: Element | undefined;
  shouldDefineOwner: boolean = false;
  shouldDefineParent: boolean = false;
  shouldDefineQWeb: boolean = false;
  shouldDefineUtils: boolean = false;
  shouldDefineResult: boolean = false;
  shouldProtectContext: boolean = false;
  shouldTrackScope: boolean = false;
  inLoop: boolean = false;
  inPreTag: boolean = false;
  templateName: string;
  allowMultipleRoots: boolean = false;
  hasParentWidget: boolean = false;
  scopeVars: any[] = [];

  constructor(name?: string) {
    this.rootContext = this;
    this.templateName = name || "noname";
    this.addLine("var h = this.h;");
  }

  generateID(): number {
    const id = this.rootContext.nextID++;
    return id;
  }

  generateCode(): string[] {
    const shouldTrackScope = this.shouldTrackScope && this.scopeVars.length;
    if (shouldTrackScope) {
      // add some vars to scope if needed
      for (let scopeVar of this.scopeVars.reverse()) {
        let { index, key, indent } = scopeVar;
        const prefix = new Array(indent + 2).join("    ");
        this.code.splice(index + 1, 0, prefix + `scope.${key} = context.${key};`);
      }
      this.code.unshift("    const scope = Object.create(null);");
    }
    if (this.shouldProtectContext) {
      this.code.unshift("    context = Object.create(context);");
    }
    if (this.shouldDefineResult) {
      this.code.unshift("    let result;");
    }
    if (this.shouldDefineOwner) {
      // this is necessary to prevent some directives (t-forach for ex) to
      // pollute the rendering context by adding some keys in it.
      this.code.unshift("    let owner = context;");
    }
    if (this.shouldDefineParent) {
      if (this.hasParentWidget) {
        this.code.unshift("    let parent = extra.parent;");
      } else {
        this.code.unshift("    let parent = context;");
      }
    }
    if (this.shouldDefineQWeb) {
      this.code.unshift("    let QWeb = this.constructor;");
    }
    if (this.shouldDefineUtils) {
      this.code.unshift("    let utils = this.constructor.utils;");
    }
    return this.code;
  }

  withParent(node: number): Context {
    if (
      !this.allowMultipleRoots &&
      this === this.rootContext &&
      (this.parentNode || this.parentTextNode)
    ) {
      throw new Error("A template should not have more than one root node");
    }
    if (!this.rootContext.rootNode) {
      this.rootContext.rootNode = node;
    }
    return this.subContext("parentNode", node);
  }

  subContext(key: keyof Context, value: any): Context {
    const newContext = Object.create(this);
    newContext[key] = value;
    return newContext;
  }

  indent() {
    this.indentLevel++;
  }

  dedent() {
    this.indentLevel--;
  }

  addLine(line: string): number {
    const prefix = new Array(this.indentLevel + 2).join("    ");
    this.code.push(prefix + line);
    return this.code.length - 1;
  }

  addToScope(key: string, expr: string) {
    const index = this.addLine(`context.${key} = ${expr};`);
    this.rootContext.scopeVars.push({ index, key, indent: this.indentLevel });
  }

  addIf(condition: string) {
    this.addLine(`if (${condition}) {`);
    this.indent();
  }

  addElse() {
    this.dedent();
    this.addLine("} else {");
    this.indent();
  }

  closeIf() {
    this.dedent();
    this.addLine("}");
  }

  getValue(val: any): any {
    return val in this.variables ? this.getValue(this.variables[val]) : val;
  }

  /**
   * Prepare an expression for being consumed at render time.  Its main job
   * is to
   * - replace unknown variables by a lookup in the context
   * - replace already defined variables by their internal name
   */
  formatExpression(expr: string): string {
    return compileExpr(expr, this.variables);
  }

  /**
   * Perform string interpolation on the given string. Note that if the whole
   * string is an expression, it simply returns it (formatted and enclosed in
   * parentheses).
   * For instance:
   *   'Hello {{x}}!' -> `Hello ${x}`
   *   '{{x ? 'a': 'b'}}' -> (x ? 'a' : 'b')
   */
  interpolate(s: string): string {
    let matches = s.match(/\{\{.*?\}\}/g);
    if (matches && matches[0].length === s.length) {
      return `(${this.formatExpression(s.slice(2, -2))})`;
    }

    let r = s.replace(/\{\{.*?\}\}/g, s => "${" + this.formatExpression(s.slice(2, -2)) + "}");
    return "`" + r + "`";
  }
}
