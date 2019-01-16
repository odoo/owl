import { escape } from "./utils";
import directives from "./qweb_directives";
import { Directive } from "./qweb_directives";

type RawTemplate = string;
type Template = (context: any) => DocumentFragment;

// Evaluation Context
export type EvalContext = { [key: string]: any };

const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(
  ","
);

// Compilation Context
export class Context {
  nextID: number = 1;
  code: string[] = [];
  variables: { [key: string]: any } = {};
  escaping: boolean = false;
  parentNode: string | undefined;
  indentLevel: number = 0;
  rootContext: Context;
  caller: Element | undefined;
  fragmentID: string;

  constructor() {
    this.rootContext = this;
    this.fragmentID = this.generateID();
  }

  generateID(): string {
    const id = `_${this.rootContext.nextID}`;
    this.rootContext.nextID++;
    return id;
  }

  withParent(node: string): Context {
    const newContext = Object.create(this);
    newContext.parentNode = node;
    return newContext;
  }

  withVariables(variables: { [key: string]: any }) {
    const newContext = Object.create(this);
    newContext.variables = Object.create(variables);
    return newContext;
  }

  withCaller(node: Element): Context {
    const newContext = Object.create(this);
    newContext.caller = node;
    return newContext;
  }

  withEscaping(): Context {
    const newContext = Object.create(this);
    newContext.escaping = true;
    return newContext;
  }

  indent() {
    this.indentLevel++;
  }

  dedent() {
    this.indentLevel--;
  }

  addNode(nodeID: string) {
    if (this.parentNode) {
      this.addLine(`${this.parentNode}.appendChild(${nodeID})`);
    } else {
      this.addLine(`${this.fragmentID}.appendChild(${nodeID})`);
    }
  }
  addLine(line: string) {
    const prefix = new Array(this.indentLevel).join("\t");
    const lastChar = line[line.length - 1];
    const suffix = lastChar !== "}" && lastChar !== "{" ? ";" : "";
    this.code.push(prefix + line + suffix);
  }
}

/**
 * Template rendering engine
 */
export default class QWeb {
  rawTemplates: { [name: string]: RawTemplate } = {};
  nodeTemplates: { [name: string]: Document } = {};
  templates: { [name: string]: Template } = {};
  escape: ((str: string) => string) = escape;
  exprCache: { [key: string]: string } = {};
  directives: Directive[] = [];

  constructor() {
    directives.forEach(d => this.addDirective(d));
  }

  addDirective(dir: Directive) {
    this.directives.push(dir);
    this.directives.sort((d1, d2) => d1.priority - d2.priority);
  }
  /**
   * Add a template to the internal template map.  Note that it is not
   * immediately compiled.
   */
  addTemplate(name: string, template: RawTemplate) {
    if (name in this.rawTemplates) {
      return;
    }
    this.rawTemplates[name] = template;
    const parser = new DOMParser();
    const doc = parser.parseFromString(template, "text/xml");
    if (!doc.firstChild) {
      throw new Error("Invalid template (should not be empty)");
    }
    if (doc.firstChild.nodeName === "parsererror") {
      throw new Error("Invalid XML in template");
    }
    let tbranch = doc.querySelectorAll("[t-elif], [t-else]");
    for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
      let node = tbranch[i];
      let prevElem = node.previousElementSibling!;
      let pattr = function(name) {
        return prevElem.getAttribute(name);
      };
      let nattr = function(name) {
        return +!!node.getAttribute(name);
      };
      if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
        if (pattr("t-foreach")) {
          throw new Error(
            "t-if cannot stay at the same level as t-foreach when using t-elif or t-else"
          );
        }
        if (
          ["t-if", "t-elif", "t-else"].map(nattr).reduce(function(a, b) {
            return a + b;
          }) > 1
        ) {
          throw new Error(
            "Only one conditional branching directive is allowed per node"
          );
        }
        // All text nodes between branch nodes are removed
        let textNode;
        while ((textNode = node.previousSibling) !== prevElem) {
          if (textNode.nodeValue.trim().length) {
            throw new Error("text is not allowed between branching directives");
          }
          textNode.remove();
        }
      } else {
        throw new Error(
          "t-elif and t-else directives must be preceded by a t-if or t-elif directive"
        );
      }
    }

    this.nodeTemplates[name] = doc;
  }

  /**
   * Render a template
   *
   * @param {string} name the template should already have been added
   */
  render(name: string, context: any = {}): DocumentFragment {
    const template = this.templates[name] || this._compile(name);
    return template(context);
  }

  renderToString(name: string, context: EvalContext = {}): string {
    const node = this.render(name, context);
    return this._renderNodeToString(node);
  }

  _renderNodeToString(node: Node): string {
    switch (node.nodeType) {
      case 3: // text node
        return node.textContent!;
      case 11: // document.fragment
        const children = Array.from((<DocumentFragment>node).childNodes);
        return children.map(this._renderNodeToString).join("");
      default:
        return (<HTMLElement>node).outerHTML;
    }
  }

  _compile(name: string): Template {
    if (name in this.templates) {
      return this.templates[name];
    }
    const doc = this.nodeTemplates[name];

    let ctx = new Context();

    const mainNode = doc.firstChild!;
    ctx.addLine(`let ${ctx.fragmentID} = document.createDocumentFragment()`);
    this._compileNode(mainNode, ctx);

    ctx.addLine(`return ${ctx.fragmentID}`);
    const functionCode = ctx.code.join("\n");
    if ((<Element>mainNode).attributes.hasOwnProperty("t-debug")) {
      console.log(
        `Template: ${this.rawTemplates[name]}\nCompiled code:\n` + functionCode
      );
    }
    const template: Template = (new Function(
      "context",
      functionCode
    ) as Template).bind(this);
    this.templates[name] = template;
    return template;
  }

  /**
   * Generate code from an xml node
   *
   */
  _compileNode(node: ChildNode, ctx: Context) {
    if (!(node instanceof Element)) {
      // this is a text node, there are no directive to apply
      let text = node.textContent!;
      let nodeID = ctx.generateID();
      ctx.addLine(`let ${nodeID} = document.createTextNode(\`${text}\`)`);
      ctx.addNode(nodeID);
      return;
    }

    const attributes = (<Element>node).attributes;

    const validDirectives: {
      directive: Directive;
      value: string;
      fullName: string;
    }[] = [];

    for (let directive of this.directives) {
      // const value = attributes[i].textContent!;
      let fullName;
      let value;
      for (let i = 0; i < attributes.length; i++) {
        const name = attributes[i].name;
        if (
          name === "t-" + directive.name ||
          name.startsWith("t-" + directive.name + "-")
        ) {
          fullName = name;
          value = attributes[i].textContent;
        }
      }
      if (fullName) {
        validDirectives.push({ directive, value, fullName });
      }
    }

    for (let { directive, value, fullName } of validDirectives) {
      if (directive.atNodeEncounter) {
        const isDone = directive.atNodeEncounter({
          node,
          qweb: this,
          ctx,
          fullName,
          value
        });
        if (isDone) {
          return;
        }
      }
    }

    if (node.nodeName !== "t") {
      let nodeID = this._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);

      for (let { directive, value, fullName } of validDirectives) {
        if (directive.atNodeCreation) {
          directive.atNodeCreation({
            node,
            qweb: this,
            ctx,
            fullName,
            value,
            nodeID
          });
        }
      }
    }

    this._compileChildren(node, ctx);

    for (let { directive, value, fullName } of validDirectives) {
      if (directive.finalize) {
        directive.finalize({ node, qweb: this, ctx, fullName, value });
      }
    }
  }

  _getValue(val: any, ctx: Context): any {
    if (val in ctx.variables) {
      return this._getValue(ctx.variables[val], ctx);
    }
    return val;
  }
  _compileChildren(node: ChildNode, ctx: Context) {
    if (node.childNodes.length > 0) {
      for (let child of Array.from(node.childNodes)) {
        this._compileNode(child, ctx);
      }
    }
  }
  _compileGenericNode(node: ChildNode, ctx: Context): string {
    let nodeID: string | undefined;
    switch (node.nodeType) {
      case 1: // generic tag;
        nodeID = ctx.generateID();
        ctx.addLine(
          `let ${nodeID} = document.createElement('${node.nodeName}')`
        );

        const attributes = (<Element>node).attributes;
        for (let i = 0; i < attributes.length; i++) {
          const name = attributes[i].name;
          const value = attributes[i].textContent!;
          if (!name.startsWith("t-")) {
            ctx.addLine(
              `${nodeID}.setAttribute('${name}', '${escape(value)}')`
            );
          }
          if (name.startsWith("t-att-")) {
            const attName = name.slice(6);
            const formattedValue = this._formatExpression(value!);
            const attID = ctx.generateID();
            ctx.addLine(`let ${attID} = ${formattedValue}`);
            ctx.addLine(
              `if (${attID}) {${nodeID}.setAttribute('${attName}', ${attID})}`
            );
          }
          if (name.startsWith("t-attf-")) {
            const exprName = name.slice(7);
            const formattedExpr = value!.replace(
              /\{\{.*?\}\}/g,
              s => "${" + this._formatExpression(s.slice(2, -2)) + "}"
            );
            ctx.addLine(
              `${nodeID}.setAttribute('${exprName}', \`${formattedExpr}\`)`
            );
          }
          if (name === "t-att") {
            const id = ctx.generateID();
            ctx.addLine(`let ${id} = ${this._formatExpression(value!)}`);
            ctx.addLine(`if (${id} instanceof Array) {`);
            ctx.indent();
            ctx.addLine(`${nodeID}.setAttribute(${id}[0], ${id}[1])`);
            ctx.dedent();
            ctx.addLine(`} else {`);
            ctx.indent();
            ctx.addLine(`for (let key in ${id}) {`);
            ctx.indent();
            ctx.addLine(`${nodeID}.setAttribute(key, ${id}[key])`);
            ctx.dedent();
            ctx.addLine(`}`);
            ctx.dedent();
            ctx.addLine(`}`);
          }
        }
        break;
      default:
        throw new Error("unknown node type");
    }

    ctx.addNode(nodeID);
    return nodeID;
  }

  _formatExpression(e: string): string {
    if (e in this.exprCache) {
      return this.exprCache[e];
    }
    // Thanks CHM for this code...
    const chars = e.split("");
    let instring = "";
    let invar = "";
    let invarPos = 0;
    let r = "";
    chars.push(" ");
    for (var i = 0, ilen = chars.length; i < ilen; i++) {
      var c = chars[i];
      if (instring.length) {
        if (c === instring && chars[i - 1] !== "\\") {
          instring = "";
        }
      } else if (c === '"' || c === "'") {
        instring = c;
      } else if (c.match(/[a-zA-Z_\$]/) && !invar.length) {
        invar = c;
        invarPos = i;
        continue;
      } else if (c.match(/\W/) && invar.length) {
        // TODO: Should check for possible spaces before dot
        if (chars[invarPos - 1] !== "." && RESERVED_WORDS.indexOf(invar) < 0) {
          invar = "context['" + invar + "']";
        }
        r += invar;
        invar = "";
      } else if (invar.length) {
        invar += c;
        continue;
      }
      r += c;
    }
    const result = r.slice(0, -1);
    this.exprCache[e] = result;
    return result;
  }
}
