import h from "../../../libs/snabbdom/src/h";
import { VNode } from "../../../libs/snabbdom/src/vnode";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export type EvalContext = { [key: string]: any };
export type RawTemplate = string;
export type CompiledTemplate<T> = (context: EvalContext, extra: any) => T;
type ParsedTemplate = Document;

const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(
  ","
);

//------------------------------------------------------------------------------
// Compilation Context
//------------------------------------------------------------------------------
export class Context {
  nextID: number = 1;
  code: string[] = [];
  variables: { [key: string]: any } = {};
  escaping: boolean = false;
  parentNode: number | null = null;
  rootNode: number | null = null;
  indentLevel: number = 0;
  rootContext: Context;
  caller: Element | undefined;
  shouldDefineOwner: boolean = false;
  shouldProtectContext: boolean = false;

  constructor() {
    this.rootContext = this;
    this.addLine("let h = this.h;");
  }

  generateID(): number {
    const id = this.rootContext.nextID++;
    return id;
  }

  withParent(node: number): Context {
    const newContext: Context = Object.create(this);
    if (this === this.rootContext && this.parentNode) {
      throw new Error("A template should not have more than one root node");
    }
    newContext.parentNode = node;
    if (!this.rootContext.rootNode) {
      this.rootContext.rootNode = node;
    }
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

  addLine(line: string) {
    const prefix = new Array(this.indentLevel).join("\t");
    this.code.push(prefix + line);
  }

  getValue(val: any): any {
    return val in this.variables ? this.getValue(this.variables[val]) : val;
  }
}

//------------------------------------------------------------------------------
// QWeb rendering engine
//------------------------------------------------------------------------------
export class QWeb {
  rawTemplates: { [name: string]: RawTemplate } = {};
  parsedTemplates: { [name: string]: ParsedTemplate } = {};
  templates: { [name: string]: CompiledTemplate<VNode> } = {};
  h = h;
  exprCache: { [key: string]: string } = {};
  directives: Directive[] = [];

  constructor() {
    [
      forEachDirective,
      escDirective,
      rawDirective,
      setDirective,
      elseDirective,
      elifDirective,
      ifDirective,
      callDirective,
      onDirective,
      refDirective,
      widgetDirective
    ].forEach(d => this.addDirective(d));
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

    this.parsedTemplates[name] = doc;
  }

  /**
   * Render a template
   *
   * @param {string} name the template should already have been added
   */
  render(name: string, context: EvalContext = {}, extra: any = null): VNode {
    if (!(name in this.rawTemplates)) {
      throw new Error(`Template ${name} does not exist`);
    }
    const template = this.templates[name] || this._compile(name);
    return template(context, extra);
  }

  _compile(name: string): CompiledTemplate<VNode> {
    if (name in this.templates) {
      return this.templates[name];
    }

    const doc = this.parsedTemplates[name];
    const ctx = new Context();
    const mainNode = doc.firstChild!;
    this._compileNode(mainNode, ctx);

    if (ctx.shouldDefineOwner) {
      // this is necessary to prevent some directives (t-forach for ex) to
      // pollute the rendering context by adding some keys in it.
      ctx.code.unshift("let owner = context;");
    }
    if (ctx.shouldProtectContext) {
      ctx.code.unshift("context = Object.create(context);");
    }

    if (!ctx.rootNode) {
      throw new Error("A template should have one root node");
    }
    ctx.addLine(`return vn${ctx.rootNode};`);
    let template = new Function(
      "context",
      "extra",
      ctx.code.join("\n")
    ) as CompiledTemplate<VNode>;
    if ((<Element>mainNode).attributes.hasOwnProperty("t-debug")) {
      console.log(
        `Template: ${this.rawTemplates[name]}\nCompiled code:\n` +
          template.toString()
      );
    }
    template = template.bind(this);
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
      if (ctx.parentNode) {
        ctx.addLine(`c${ctx.parentNode}.push({text: \`${text}\`});`);
      } else {
        // this is an unusual situation: this text node is the result of the
        // template rendering.
        let nodeID = ctx.generateID();
        ctx.addLine(`let vn${nodeID} = {text: \`${text}\`};`);
        ctx.rootContext.rootNode = nodeID;
        ctx.rootContext.parentNode = nodeID;
      }
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

  _compileGenericNode(node: ChildNode, ctx: Context): number {
    // nodeType 1 is generic tag
    if (node.nodeType !== 1) {
      throw new Error("unsupported node type");
    }
    const attributes = (<Element>node).attributes;
    const attrs: string[] = [];
    const tattrs: number[] = [];
    for (let i = 0; i < attributes.length; i++) {
      const name = attributes[i].name;
      const value = attributes[i].textContent!;

      // regular attributes
      if (!name.startsWith("t-")) {
        const attID = ctx.generateID();
        ctx.addLine(`let _${attID} = '${value}';`);
        attrs.push(`${name}: _${attID}`);
      }

      // dynamic attributes
      if (name.startsWith("t-att-")) {
        const attName = name.slice(6);
        const formattedValue = this._formatExpression(value!);
        const attID = ctx.generateID();
        ctx.addLine(`let _${attID} = ${formattedValue};`);
        attrs.push(`${attName}: _${attID}`);
      }

      if (name.startsWith("t-attf-")) {
        const attName = name.slice(7);
        const formattedExpr = value!.replace(
          /\{\{.*?\}\}/g,
          s => "${" + this._formatExpression(s.slice(2, -2)) + "}"
        );
        const attID = ctx.generateID();
        ctx.addLine(`let _${attID} = \`${formattedExpr}\`;`);
        attrs.push(`${attName}: _${attID}`);
      }

      // t-att= attributes
      if (name === "t-att") {
        let id = ctx.generateID();
        ctx.addLine(`let _${id} = ${this._formatExpression(value!)};`);
        tattrs.push(id);
      }
    }
    let nodeID = ctx.generateID();
    let p =
      attrs.length + tattrs.length > 0 ? `{attrs:{${attrs.join(",")}}}` : "{}";
    ctx.addLine(`let c${nodeID} = [], p${nodeID} = ${p};`);
    for (let id of tattrs) {
      ctx.addLine(`if (_${id} instanceof Array) {`);
      ctx.indent();
      ctx.addLine(`p${nodeID}.attrs[_${id}[0]] = _${id}[1];`);
      ctx.dedent();
      ctx.addLine(`} else {`);
      ctx.indent();
      ctx.addLine(`for (let key in _${id}) {`);
      ctx.indent();
      ctx.addLine(`p${nodeID}.attrs[key] = _${id}[key];`);
      ctx.dedent();
      ctx.addLine(`}`);
      ctx.dedent();
      ctx.addLine(`}`);
    }
    ctx.addLine(`
      let vn${nodeID} = h('${node.nodeName}', p${nodeID}, c${nodeID});`);
    if (ctx.parentNode) {
      ctx.addLine(`c${ctx.parentNode}.push(vn${nodeID});`);
    }

    return nodeID;
  }

  _compileChildren(node: ChildNode, ctx: Context) {
    if (node.childNodes.length > 0) {
      for (let child of Array.from(node.childNodes)) {
        this._compileNode(child, ctx);
      }
    }
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

//------------------------------------------------------------------------------
// QWeb Directives
//------------------------------------------------------------------------------
interface CompilationInfo {
  nodeID?: number;
  node: Element;
  qweb: QWeb;
  ctx: Context;
  fullName: string;
  value: string;
}

export interface Directive {
  name: string;
  priority: number;
  // if return true, then directive is fully applied and there is no need to
  // keep processing node. Otherwise, we keep going.
  atNodeEncounter?(info: CompilationInfo): boolean;
  atNodeCreation?(info: CompilationInfo): void;
  finalize?(info: CompilationInfo): void;
}

function compileValueNode(value: any, node: Element, qweb: QWeb, ctx: Context) {
  if (value === "0" && ctx.caller) {
    qweb._compileNode(ctx.caller, ctx);
    return;
  }

  if (typeof value === "string") {
    const exprID = ctx.generateID();
    ctx.addLine(`let e${exprID} = ${qweb._formatExpression(value)};`);
    ctx.addLine(`if (e${exprID} || e${exprID} === 0) {`);
    ctx.indent();
    let text = `e${exprID}`;

    if (!ctx.parentNode) {
      throw new Error("Should not have a text node without a parent");
    }
    if (ctx.escaping) {
      ctx.addLine(`c${ctx.parentNode}.push({text: ${text}});`);
    } else {
      ctx.addLine(`p${ctx.parentNode}.hook = {
            create: (_, n) => n.elm.innerHTML = e${exprID},
            update: (_, n) => n.elm.innerHTML = e${exprID},
        };`); // p${ctx.parentNode}.elm.innerHTML = e${exprID}
    }
    ctx.dedent();
    if (node.childNodes.length) {
      ctx.addLine("} else {");
      ctx.indent();
      qweb._compileChildren(node, ctx);
      ctx.dedent();
    }
    ctx.addLine("}");
    return;
  }
  if (value instanceof NodeList) {
    for (let node of Array.from(value)) {
      qweb._compileNode(<ChildNode>node, ctx);
    }
  }
}

const escDirective: Directive = {
  name: "esc",
  priority: 70,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      let nodeID = qweb._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);
    }
    let value = ctx.getValue(node.getAttribute("t-esc")!);
    compileValueNode(value, node, qweb, ctx.withEscaping());
    return true;
  }
};

const rawDirective: Directive = {
  name: "raw",
  priority: 80,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      let nodeID = qweb._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);
    }
    let value = ctx.getValue(node.getAttribute("t-raw")!);
    compileValueNode(value, node, qweb, ctx);
    return true;
  }
};

const setDirective: Directive = {
  name: "set",
  priority: 60,
  atNodeEncounter({ node, ctx }): boolean {
    const variable = node.getAttribute("t-set")!;
    let value = node.getAttribute("t-value")!;
    if (value) {
      ctx.variables[variable] = value;
    } else {
      ctx.variables[variable] = node.childNodes;
    }
    return true;
  }
};

const ifDirective: Directive = {
  name: "if",
  priority: 20,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    let cond = ctx.getValue(node.getAttribute("t-if")!);
    ctx.addLine(`if (${qweb._formatExpression(cond)}) {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.dedent();
    ctx.addLine(`}`);
  }
};

const elifDirective: Directive = {
  name: "elif",
  priority: 30,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    let cond = ctx.getValue(node.getAttribute("t-elif")!);
    ctx.addLine(`else if (${qweb._formatExpression(cond)}) {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.dedent();
    ctx.addLine(`}`);
  }
};

const elseDirective: Directive = {
  name: "else",
  priority: 40,
  atNodeEncounter({ ctx }): boolean {
    ctx.addLine(`else {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.dedent();
    ctx.addLine(`}`);
  }
};

const callDirective: Directive = {
  name: "call",
  priority: 50,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      throw new Error("Invalid tag for t-call directive (should be 't')");
    }
    const subTemplate = node.getAttribute("t-call")!;
    const nodeTemplate = qweb.parsedTemplates[subTemplate];
    const nodeCopy = <Element>node.cloneNode(true);
    nodeCopy.removeAttribute("t-call");

    // extract variables from nodecopy
    const tempCtx = new Context();
    qweb._compileNode(nodeCopy, tempCtx);
    const vars = Object.assign({}, ctx.variables, tempCtx.variables);
    const subCtx = ctx.withCaller(nodeCopy).withVariables(vars);

    qweb._compileNode(nodeTemplate.firstChild!, subCtx);
    return true;
  }
};

const forEachDirective: Directive = {
  name: "foreach",
  priority: 10,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    ctx.rootContext.shouldProtectContext = true;
    const elems = node.getAttribute("t-foreach")!;
    const name = node.getAttribute("t-as")!;
    let arrayID = ctx.generateID();
    ctx.addLine(`let _${arrayID} = ${qweb._formatExpression(elems)};`);
    ctx.addLine(
      `if (typeof _${arrayID} === 'number') { _${arrayID} = Array.from(Array(_${arrayID}).keys())}`
    );
    let keysID = ctx.generateID();
    ctx.addLine(
      `let _${keysID} = _${arrayID} instanceof Array ? _${arrayID} : Object.keys(_${arrayID});`
    );
    let valuesID = ctx.generateID();
    ctx.addLine(
      `let _${valuesID} = _${arrayID} instanceof Array ? _${arrayID} : Object.values(_${arrayID});`
    );
    ctx.addLine(`for (let i = 0; i < _${keysID}.length; i++) {`);
    ctx.indent();
    ctx.addLine(`context.${name}_first = i === 0;`);
    ctx.addLine(`context.${name}_last = i === _${keysID}.length - 1;`);
    ctx.addLine(`context.${name}_parity = i % 2 === 0 ? 'even' : 'odd';`);
    ctx.addLine(`context.${name}_index = i;`);
    ctx.addLine(`context.${name} = _${keysID}[i];`);
    ctx.addLine(`context.${name}_value = _${valuesID}[i];`);
    const nodeCopy = <Element>node.cloneNode(true);
    nodeCopy.removeAttribute("t-foreach");
    qweb._compileNode(nodeCopy, ctx);
    ctx.dedent();
    ctx.addLine("}");
    return true;
  }
};

const onDirective: Directive = {
  name: "on",
  priority: 90,
  atNodeCreation({ ctx, fullName, value, nodeID, qweb }) {
    ctx.rootContext.shouldDefineOwner = true;
    const eventName = fullName.slice(5);
    let extraArgs;
    let handler = value.replace(/\(.*\)/, function(args) {
      extraArgs = args.slice(1, -1);
      return "";
    });
    ctx.addLine(
      `p${nodeID}.on = {${eventName}: context['${handler}'].bind(owner${
        extraArgs ? ", " + qweb._formatExpression(extraArgs) : ""
      })};`
    );
  }
};

const refDirective: Directive = {
  name: "ref",
  priority: 95,
  atNodeCreation({ ctx, node, nodeID }) {
    let ref = node.getAttribute("t-ref");
    ctx.addLine(`p${ctx.parentNode}.hook = {
            create: (_, n) => context.refs['${ref}'] = n.elm,
        };`);
  }
};

const widgetDirective: Directive = {
  name: "widget",
  priority: 100,
  atNodeEncounter({ ctx, value, node }): boolean {
    ctx.rootContext.shouldDefineOwner = true;
    let dummyID = ctx.generateID();
    let defID = ctx.generateID();
    ctx.addLine(`let _${dummyID} = {}; // DUMMY`);
    ctx.addLine(`let _${dummyID}_index = c${ctx.parentNode}.length;`);
    ctx.addLine(`c${ctx.parentNode}.push(_${dummyID});`);
    let props = node.getAttribute("t-props");
    let widgetID = ctx.generateID();
    ctx.addLine(
      `let _${widgetID} = new context.widgets['${value}'](owner, ${props});`
    );
    ctx.addLine(
      `let def${defID} = _${widgetID}._start().then(() => _${widgetID}._render()).then(vnode=>{c${
        ctx.parentNode
      }[_${dummyID}_index]=vnode;vnode.data.hook = {create(_,vn){_${widgetID}._mount(vn)},remove(){_${widgetID}.destroy()}}});`
    );
    ctx.addLine(`extra.promises.push(def${defID});`);

    let ref = node.getAttribute("t-ref");
    if (ref) {
      ctx.addLine(`context.refs['${ref}'] = _${widgetID};`);
    }
    return true;
  }
};
