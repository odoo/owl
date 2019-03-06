import h from "../../../libs/snabbdom/src/h";
import { VNode } from "../../../libs/snabbdom/src/vnode";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export type EvalContext = { [key: string]: any };
export type RawTemplate = string;
export type CompiledTemplate<T> = (context: EvalContext, extra: any) => T;
type ProcessedTemplate = Element;

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
  inLoop: boolean = false;

  constructor() {
    this.rootContext = this;
    this.addLine("let h = this.utils.h;");
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

  withInLoop(): Context {
    const newContext = Object.create(this);
    newContext.inLoop = true;
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
    const prefix = new Array(this.indentLevel + 2).join("    ");
    this.code.push(prefix + line);
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
}

//------------------------------------------------------------------------------
// QWeb rendering engine
//------------------------------------------------------------------------------

export class QWeb {
  processedTemplates: { [name: string]: ProcessedTemplate } = {};
  templates: { [name: string]: CompiledTemplate<VNode> } = {};
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

  utils = {
    h: h,
    getFragment(str: string): DocumentFragment {
      const temp = document.createElement("template");
      temp.innerHTML = str;
      return temp.content;
    }
  };

  addDirective(dir: Directive) {
    this.directives.push(dir);
    this.directives.sort((d1, d2) => d1.priority - d2.priority);
  }

  /**
   * Add a template to the internal template map.  Note that it is not
   * immediately compiled.
   */
  addTemplate(
    name: string,
    template: RawTemplate,
    allowDuplicates: boolean = false
  ) {
    if (name in this.processedTemplates) {
      if (allowDuplicates) {
        return;
      } else {
        throw new Error(`Template ${name} already defined`);
      }
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(template, "text/xml");
    if (!doc.firstChild) {
      throw new Error("Invalid template (should not be empty)");
    }
    if (doc.getElementsByTagName("parsererror").length) {
      throw new Error("Invalid XML in template");
    }
    let elem = doc.firstChild as Element;
    this._processTemplate(elem);

    this.processedTemplates[name] = elem;
  }

  _processTemplate(elem: Element) {
    let tbranch = elem.querySelectorAll("[t-elif], [t-else]");
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
  }
  /**
   * Load templates from a xml (as a string).  This will look up for the first
   * <templates> tag, and will consider each child of this as a template, with
   * the name given by the t-name attribute.
   */
  loadTemplates(xmlstr: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlstr, "text/xml");
    const templates = doc.getElementsByTagName("templates")[0];
    if (!templates) {
      return;
    }
    for (let elem of <any>templates.children) {
      const name = elem.getAttribute("t-name");
      this._processTemplate(elem);
      this.processedTemplates[name] = elem;
    }
  }
  /**
   * Render a template
   *
   * @param {string} name the template should already have been added
   */
  render(name: string, context: EvalContext = {}, extra: any = null): VNode {
    if (!(name in this.processedTemplates)) {
      throw new Error(`Template ${name} does not exist`);
    }
    const template = this.templates[name] || this._compile(name);
    return template.call(this, context, extra);
  }

  _compile(name: string): CompiledTemplate<VNode> {
    if (name in this.templates) {
      return this.templates[name];
    }

    const mainNode = this.processedTemplates[name];
    const isDebug = (<Element>mainNode).attributes.hasOwnProperty("t-debug");
    const ctx = new Context();
    this._compileNode(mainNode, ctx);

    if (ctx.shouldProtectContext) {
      ctx.code.unshift("    context = Object.create(context);");
    }
    if (ctx.shouldDefineOwner) {
      // this is necessary to prevent some directives (t-forach for ex) to
      // pollute the rendering context by adding some keys in it.
      ctx.code.unshift("    let owner = context;");
    }

    if (!ctx.rootNode) {
      throw new Error("A template should have one root node");
    }
    ctx.addLine(`return vn${ctx.rootNode};`);
    if (isDebug) {
      ctx.code.unshift("    debugger");
    }
    let template;
    try {
      template = new Function(
        "context",
        "extra",
        ctx.code.join("\n")
      ) as CompiledTemplate<VNode>;
    } catch (e) {
      throw new Error(`Invalid template (or compiled code): ${e.message}`);
    }
    if (isDebug) {
      console.log(
        `Template: ${
          this.processedTemplates[name].outerHTML
        }\nCompiled code:\n` + template.toString()
      );
    }
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
      let name = attributes[i].name;
      const value = attributes[i].textContent!;

      // regular attributes
      if (!name.startsWith("t-")) {
        const attID = ctx.generateID();
        ctx.addLine(`let _${attID} = '${value}';`);
        if (!name.match(/^[a-zA-Z]+$/)) {
          // attribute contains 'non letters' => we want to quote it
          name = '"' + name + '"';
        }
        attrs.push(`${name}: _${attID}`);
      }

      // dynamic attributes
      if (name.startsWith("t-att-")) {
        let attName = name.slice(6);
        let formattedValue = this._formatExpression(ctx.getValue(value!));
        const attID = ctx.generateID();
        if (!attName.match(/^[a-zA-Z]+$/)) {
          // attribute contains 'non letters' => we want to quote it
          attName = '"' + attName + '"';
        }
        // we need to combine dynamic with non dynamic attributes:
        // class="a" t-att-class="'yop'" should be rendered as class="a yop"
        const attValue = (<Element>node).getAttribute(attName);
        if (attValue) {
          const attValueID = ctx.generateID();
          ctx.addLine(`let _${attValueID} = ${formattedValue};`);
          formattedValue = `'${attValue}' + (_${attValueID} ? ' ' + _${attValueID} : '')`;
        }
        ctx.addLine(`let _${attID} = ${formattedValue};`);
        attrs.push(`${attName}: _${attID}`);
      }

      if (name.startsWith("t-attf-")) {
        let attName = name.slice(7);
        if (!attName.match(/^[a-zA-Z]+$/)) {
          // attribute contains 'non letters' => we want to quote it
          attName = '"' + attName + '"';
        }
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
      attrs.length + tattrs.length > 0
        ? `{key:${nodeID},attrs:{${attrs.join(",")}}}`
        : `{key:${nodeID}}`;
    ctx.addLine(`let c${nodeID} = [], p${nodeID} = ${p};`);
    for (let id of tattrs) {
      ctx.addIf(`_${id} instanceof Array`);
      ctx.addLine(`p${nodeID}.attrs[_${id}[0]] = _${id}[1];`);
      ctx.addElse();
      ctx.addLine(`for (let key in _${id}) {`);
      ctx.indent();
      ctx.addLine(`p${nodeID}.attrs[key] = _${id}[key];`);
      ctx.dedent();
      ctx.addLine(`}`);
      ctx.closeIf();
    }
    ctx.addLine(
      `let vn${nodeID} = h('${node.nodeName}', p${nodeID}, c${nodeID});`
    );
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
    ctx.addIf(`e${exprID} || e${exprID} === 0`);
    let text = `e${exprID}`;

    if (!ctx.parentNode) {
      throw new Error("Should not have a text node without a parent");
    }
    if (ctx.escaping) {
      ctx.addLine(`c${ctx.parentNode}.push({text: ${text}});`);
    } else {
      let fragID = ctx.generateID();
      ctx.addLine(`let frag${fragID} = this.utils.getFragment(e${exprID})`);
      let tempNodeID = ctx.generateID();
      ctx.addLine(`let p${tempNodeID} = {hook: {`);
      ctx.addLine(
        `  insert: n => n.elm.parentNode.replaceChild(frag${fragID}, n.elm),`
      );
      ctx.addLine(`}};`);
      ctx.addLine(`let vn${tempNodeID} = h('div', p${tempNodeID})`);
      ctx.addLine(`c${ctx.parentNode}.push(vn${tempNodeID});`);
    }
    if (node.childNodes.length) {
      ctx.addElse();
      qweb._compileChildren(node, ctx);
    }
    ctx.closeIf();
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
    ctx.addIf(`${qweb._formatExpression(cond)}`);
    return false;
  },
  finalize({ ctx }) {
    ctx.closeIf();
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
    ctx.closeIf();
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
    ctx.closeIf();
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
    const nodeTemplate = qweb.processedTemplates[subTemplate];
    if (!nodeTemplate) {
      throw new Error(`Cannot find template "${subTemplate}" (t-call)`);
    }
    const nodeCopy = node.cloneNode(true) as Element;
    nodeCopy.removeAttribute("t-call");

    // extract variables from nodecopy
    const tempCtx = new Context();
    qweb._compileNode(nodeCopy, tempCtx);
    const vars = Object.assign({}, ctx.variables, tempCtx.variables);
    const subCtx = ctx.withCaller(nodeCopy).withVariables(vars);

    qweb._compileNode(nodeTemplate, subCtx);
    return true;
  }
};

const forEachDirective: Directive = {
  name: "foreach",
  priority: 10,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    ctx.rootContext.shouldProtectContext = true;
    ctx = ctx.withInLoop();
    const elems = node.getAttribute("t-foreach")!;
    const name = node.getAttribute("t-as")!;
    let arrayID = ctx.generateID();
    ctx.addLine(`let _${arrayID} = ${qweb._formatExpression(elems)};`);
    ctx.addLine(
      `if (!_${arrayID}) { throw new Error('QWeb error: Invalid loop expression')}`
    );
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
    if (extraArgs) {
      ctx.addLine(
        `p${nodeID}.on = {${eventName}: context['${handler}'].bind(owner, ${qweb._formatExpression(
          extraArgs
        )})};`
      );
    } else {
      ctx.addLine(
        `extra.handlers[${nodeID}] = extra.handlers[${nodeID}] || context['${handler}'].bind(owner);`
      );
      ctx.addLine(`p${nodeID}.on = {${eventName}: extra.handlers[${nodeID}]};`);
    }
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
  atNodeEncounter({ ctx, value, node, qweb }): boolean {
    ctx.addLine("//WIDGET");
    ctx.rootContext.shouldDefineOwner = true;
    let props = node.getAttribute("t-props");
    let keepAlive = node.getAttribute("t-keep-alive") ? true : false;

    // t-on- events...
    const events: [string, string][] = [];
    const attributes = (<Element>node).attributes;
    for (let i = 0; i < attributes.length; i++) {
      const name = attributes[i].name;
      if (name.startsWith("t-on-")) {
        events.push([name.slice(5), attributes[i].textContent!]);
      }
    }

    let key = node.getAttribute("t-key");
    if (key) {
      key = qweb._formatExpression(key);
    }
    if (props) {
      props = props.trim();
      if (props[0] === "{" && props[props.length - 1] === "}") {
        const innerProp = props
          .slice(1, -1)
          .split(",")
          .map(p => {
            let [key, val] = p.split(":");
            return `${key}: ${qweb._formatExpression(val)}`;
          })
          .join(",");
        props = "{" + innerProp + "}";
      } else {
        props = qweb._formatExpression(props);
      }
    }
    let dummyID = ctx.generateID();
    let defID = ctx.generateID();
    let widgetID = ctx.generateID();
    let keyID = key && ctx.generateID();
    if (key) {
      // we bind a variable to the key (could be a complex expression, so we
      // want to evaluate it only once)
      ctx.addLine(`let key${keyID} = ${key};`);
    }
    ctx.addLine(`let _${dummyID}_index = c${ctx.parentNode}.length;`);
    ctx.addLine(`c${ctx.parentNode}.push(null);`);
    ctx.addLine(`let def${defID};`);
    let templateID = key
      ? `key${keyID}`
      : ctx.inLoop
      ? `String(-${widgetID} - i)`
      : String(widgetID);
    ctx.addLine(
      `let w${widgetID} = ${templateID} in context.__widget__.cmap ? context.__widget__.children[context.__widget__.cmap[${templateID}]] : false;`
    );
    ctx.addLine(`let props${widgetID} = ${props};`);
    ctx.addLine(`let isNew${widgetID} = !w${widgetID};`);

    // check if we can reuse current rendering promise
    ctx.addIf(`w${widgetID} && w${widgetID}.__widget__.renderPromise`);
    ctx.addIf(`w${widgetID}.__widget__.isStarted`);
    ctx.addIf(`props${widgetID} === w${widgetID}.__widget__.renderProps`);
    ctx.addLine(`def${defID} = w${widgetID}.__widget__.renderPromise;`);
    ctx.addElse();
    ctx.addLine(`def${defID} = w${widgetID}.updateProps(props${widgetID});`);
    ctx.closeIf();
    ctx.addElse();
    ctx.addLine(`isNew${widgetID} = true`);
    ctx.addIf(`props${widgetID} === w${widgetID}.__widget__.renderProps`);
    ctx.addLine(`def${defID} = w${widgetID}.__widget__.renderPromise;`);
    ctx.addElse();
    ctx.addLine(`w${widgetID}.destroy();`);
    ctx.addLine(`w${widgetID} = false`);
    ctx.closeIf();
    ctx.closeIf();
    ctx.closeIf();

    ctx.addIf(`!def${defID}`);
    ctx.addIf(`w${widgetID}`);
    ctx.addLine(`def${defID} = w${widgetID}.updateProps(props${widgetID});`);
    ctx.addElse();
    ctx.addLine(
      `w${widgetID} = new context.widgets['${value}'](owner, props${widgetID});`
    );
    ctx.addLine(
      `context.__widget__.cmap[${templateID}] = w${widgetID}.__widget__.id;`
    );
    for (let [event, method] of events) {
      ctx.addLine(`w${widgetID}.on('${event}', owner, owner['${method}'])`);
    }
    let ref = node.getAttribute("t-ref");
    if (ref) {
      ctx.addLine(`context.refs['${ref}'] = w${widgetID};`);
    }

    ctx.addLine(`def${defID} = w${widgetID}._start();`);
    ctx.closeIf();
    ctx.closeIf();

    ctx.addIf(`isNew${widgetID}`);
    ctx.addLine(
      `def${defID} = def${defID}.then(vnode=>{let pvnode=h(vnode.sel, {key: ${templateID}});c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;pvnode.data.hook = {insert(vn){let nvn=w${widgetID}._mount(vnode, vn.elm);pvnode.elm=nvn.elm},remove(){w${widgetID}.${
        keepAlive ? "detach" : "destroy"
      }()}}; w${widgetID}.__widget__.pvnode = pvnode;});`
    );
    ctx.addElse();
    ctx.addLine(
      `def${defID} = def${defID}.then(()=>{if (w${widgetID}.__widget__.isDestroyed) {return};let vnode;if (!w${widgetID}.__widget__.vnode){vnode=w${widgetID}.__widget__.pvnode} else { vnode=h(w${widgetID}.__widget__.vnode.sel, {key: ${templateID}});vnode.elm=w${widgetID}.el;vnode.data.hook = {insert(a){a.elm.parentNode.replaceChild(w${widgetID}.el,a.elm);a.elm=w${widgetID}.el;w${widgetID}.__mount();},remove(){w${widgetID}.${
        keepAlive ? "detach" : "destroy"
      }()}}}c${ctx.parentNode}[_${dummyID}_index]=vnode;});`
    );
    ctx.closeIf();

    ctx.addLine(`extra.promises.push(def${defID});`);

    if (node.getAttribute("t-if")) {
      ctx.closeIf();
    }

    return true;
  }
};
