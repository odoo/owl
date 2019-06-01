import { VNode, h } from "./vdom";

/**
 * Owl QWeb Engine
 *
 * In this file, you will find a QWeb engine/template compiler.  It is the core
 * of how Owl component works.
 *
 * Briefly, Owl QWeb compiles XML templates into functions that output a virtual
 * DOM representation.
 *
 * We have here:
 * - a CompilationContext class, which is an internal object that contains all
 *   compilation specific information, while a template is being compiled.
 * - a QWeb class: this is the code of the QWeb compiler.
 *
 * Note that this file does not contain the implementation of the QWeb
 * directives (see qweb_directives.ts and qweb_extensions.ts).
 */

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------
export type EvalContext = { [key: string]: any };
export type CompiledTemplate = (context: EvalContext, extra: any) => VNode;

interface Template {
  elem: Element;
  fn: CompiledTemplate;
}

interface CompilationInfo {
  node: Element;
  qweb: QWeb;
  ctx: Context;
  fullName: string;
  value: string;
}

interface NodeCreationCompilationInfo extends CompilationInfo {
  nodeID: number;
  addNodeHook: Function;
}

export interface Directive {
  name: string;
  extraNames?: string[];
  priority: number;
  // if return true, then directive is fully applied and there is no need to
  // keep processing node. Otherwise, we keep going.
  atNodeEncounter?(info: CompilationInfo): boolean | void;
  atNodeCreation?(info: NodeCreationCompilationInfo): void;
  finalize?(info: CompilationInfo): void;
}

//------------------------------------------------------------------------------
// Const/global stuff/helpers
//------------------------------------------------------------------------------
const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(
  ","
);

const WORD_REPLACEMENT = {
  and: "&&",
  or: "||",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<="
};

const DISABLED_TAGS = [
  "input",
  "textarea",
  "button",
  "select",
  "option",
  "optgroup"
];

const lineBreakRE = /[\r\n]/;
const whitespaceRE = /\s+/g;

const DIRECTIVE_NAMES = {
  name: 1,
  att: 1,
  attf: 1,
  key: 1
};

const DIRECTIVES: Directive[] = [];

const NODE_HOOKS_PARAMS = {
  create: "(_, n)",
  insert: "vn",
  remove: "(vn, rm)"
};

interface Utils {
  h: typeof h;
  objectToAttrString(obj: Object): string;
  shallowEqual(p1: Object, p2: Object): boolean;
  [key: string]: any;
}

export const UTILS: Utils = {
  h: h,
  objectToAttrString(obj: Object): string {
    let classes: string[] = [];
    for (let k in obj) {
      if (obj[k]) {
        classes.push(k);
      }
    }
    return classes.join(" ");
  },
  shallowEqual(p1, p2) {
    for (let k in p1) {
      if (p1[k] !== p2[k]) {
        return false;
      }
    }
    return true;
  }
};

function parseXML(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Invalid XML in template");
  }
  return doc;
}

let nextID = 1;

//------------------------------------------------------------------------------
// QWeb rendering engine
//------------------------------------------------------------------------------
export class QWeb {
  templates: { [name: string]: Template } = {};
  utils = UTILS;
  static widgets = Object.create(null);

  // dev mode enables better error messages or more costly validations
  static dev: boolean = false;

  // the id field is useful to be able to hash qweb instances.  The current
  // use case is that component's templates are qweb dependant, and need to be
  // able to map a qweb instance to a template name.
  id = nextID++;

  constructor(data?: string) {
    if (data) {
      this.addTemplates(data);
    }
    this.addTemplate("default", "<div></div>");
  }

  static addDirective(directive: Directive) {
    DIRECTIVES.push(directive);
    DIRECTIVE_NAMES[directive.name] = 1;
    DIRECTIVES.sort((d1, d2) => d1.priority - d2.priority);
    if (directive.extraNames) {
      directive.extraNames.forEach(n => (DIRECTIVE_NAMES[n] = 1));
    }
  }

  static register(name: string, Component: any) {
    if (QWeb.widgets[name]) {
      throw new Error(`Component '${name}' has already been registered`);
    }
    QWeb.widgets[name] = Component;
  }

  /**
   * Add a template to the internal template map.  Note that it is not
   * immediately compiled.
   */
  addTemplate(name: string, xmlString: string) {
    const doc = parseXML(xmlString);
    if (!doc.firstChild) {
      throw new Error("Invalid template (should not be empty)");
    }
    this._addTemplate(name, <Element>doc.firstChild);
  }

  /**
   * Load templates from a xml (as a string).  This will look up for the first
   * <templates> tag, and will consider each child of this as a template, with
   * the name given by the t-name attribute.
   */
  addTemplates(xmlstr: string) {
    const doc = parseXML(xmlstr);
    const templates = doc.getElementsByTagName("templates")[0];
    if (!templates) {
      return;
    }
    for (let elem of <any>templates.children) {
      const name = elem.getAttribute("t-name");
      this._addTemplate(name, elem);
    }
  }

  _addTemplate(name: string, elem: Element) {
    if (name in this.templates) {
      throw new Error(`Template ${name} already defined`);
    }
    this._processTemplate(elem);
    const template = {
      elem,
      fn: (context, extra) => {
        const compiledFunction = this._compile(name, elem);
        template.fn = compiledFunction;
        return compiledFunction.call(this, context, extra);
      }
    };
    this.templates[name] = template;
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
   * Render a template
   *
   * @param {string} name the template should already have been added
   */
  render(name: string, context: EvalContext = {}, extra: any = null): VNode {
    const template = this.templates[name];
    if (!template) {
      throw new Error(`Template ${name} does not exist`);
    }
    return template.fn.call(this, context, extra);
  }

  _compile(name: string, elem: Element): CompiledTemplate {
    const isDebug = elem.attributes.hasOwnProperty("t-debug");
    const ctx = new Context(name);
    this._compileNode(elem, ctx);

    if (ctx.shouldProtectContext) {
      ctx.code.unshift("    context = Object.create(context);");
    }
    if (ctx.shouldDefineOwner) {
      // this is necessary to prevent some directives (t-forach for ex) to
      // pollute the rendering context by adding some keys in it.
      ctx.code.unshift("    let owner = context;");
    }
    if (ctx.shouldDefineQWeb) {
      ctx.code.unshift("    let QWeb = this.constructor;");
    }
    if (ctx.shouldDefineUtils) {
      ctx.code.unshift("    let utils = this.utils;");
    }

    if (!ctx.rootNode) {
      throw new Error("A template should have one root node");
    }
    ctx.addLine(`return vn${ctx.rootNode};`);
    let template;
    try {
      template = new Function(
        "context",
        "extra",
        ctx.code.join("\n")
      ) as CompiledTemplate;
    } catch (e) {
      const templateName = ctx.templateName.replace(/`/g, "'");
      console.groupCollapsed(`Invalid Code generated by ${templateName}`);
      console.warn(ctx.code.join("\n"));
      console.groupEnd();
      throw new Error(
        `Invalid generated code while compiling template '${templateName}': ${
          e.message
        }`
      );
    }
    if (isDebug) {
      console.log(
        `Template: ${this.templates[name].elem.outerHTML}\nCompiled code:\n` +
          template.toString()
      );
    }
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
      if (!ctx.inPreTag) {
        if (lineBreakRE.test(text) && !text.trim()) {
          return;
        }
        text = text.replace(whitespaceRE, " ");
      }
      if (ctx.parentNode) {
        ctx.addLine(`c${ctx.parentNode}.push({text: \`${text}\`});`);
      } else {
        // this is an unusual situation: this text node is the result of the
        // template rendering.
        let nodeID = ctx.generateID();
        ctx.addLine(`var vn${nodeID} = {text: \`${text}\`};`);
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

    let withHandlers = false;

    // maybe this is not optimal: we iterate on all attributes here, and again
    // just after for each directive.
    for (let i = 0; i < attributes.length; i++) {
      let attrName = attributes[i].name;
      if (attrName.startsWith("t-")) {
        let dName = attrName.slice(2).split("-")[0];
        if (!(dName in DIRECTIVE_NAMES)) {
          throw new Error(`Unknown QWeb directive: '${attrName}'`);
        }
      }
    }

    const DIR_N = DIRECTIVES.length;
    const ATTR_N = attributes.length;
    for (let i = 0; i < DIR_N; i++) {
      let directive = DIRECTIVES[i];
      let fullName;
      let value;
      for (let j = 0; j < ATTR_N; j++) {
        const name = attributes[j].name;
        if (
          name === "t-" + directive.name ||
          name.startsWith("t-" + directive.name + "-")
        ) {
          fullName = name;
          value = attributes[j].textContent;
          validDirectives.push({ directive, value, fullName });
          if (directive.name === "on") {
            withHandlers = true;
          }
        }
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
      let nodeID = this._compileGenericNode(node, ctx, withHandlers);
      ctx = ctx.withParent(nodeID);
      let nodeHooks = {};
      let addNodeHook = function(hook, handler) {
        nodeHooks[hook] = nodeHooks[hook] || [];
        nodeHooks[hook].push(handler);
      };

      for (let { directive, value, fullName } of validDirectives) {
        if (directive.atNodeCreation) {
          directive.atNodeCreation({
            node,
            qweb: this,
            ctx,
            fullName,
            value,
            nodeID,
            addNodeHook
          });
        }
      }

      if (Object.keys(nodeHooks).length) {
        ctx.addLine(`p${nodeID}.hook = {`);
        for (let hook in nodeHooks) {
          ctx.addLine(`  ${hook}: ${NODE_HOOKS_PARAMS[hook]} => {`);
          for (let handler of nodeHooks[hook]) {
            ctx.addLine(`    ${handler}`);
          }
          ctx.addLine(`  },`);
        }
        ctx.addLine(`};`);
      }
    }
    if (node.nodeName === "pre") {
      ctx = ctx.subContext("inPreTag", true);
    }

    this._compileChildren(node, ctx);

    for (let { directive, value, fullName } of validDirectives) {
      if (directive.finalize) {
        directive.finalize({ node, qweb: this, ctx, fullName, value });
      }
    }
  }

  _compileGenericNode(
    node: ChildNode,
    ctx: Context,
    withHandlers: boolean = true
  ): number {
    // nodeType 1 is generic tag
    if (node.nodeType !== 1) {
      throw new Error("unsupported node type");
    }
    const attributes = (<Element>node).attributes;
    const attrs: string[] = [];
    const props: string[] = [];
    const tattrs: number[] = [];

    function handleBooleanProps(key, val) {
      let isProp = false;
      if (node.nodeName === "input" && key === "checked") {
        let type = (<Element>node).getAttribute("type");
        if (type === "checkbox" || type === "radio") {
          isProp = true;
        }
      }
      if (node.nodeName === "option" && key === "selected") {
        isProp = true;
      }
      if (key === "disabled" && DISABLED_TAGS.indexOf(node.nodeName) > -1) {
        isProp = true;
      }
      if (
        (key === "readonly" && node.nodeName === "input") ||
        node.nodeName === "textarea"
      ) {
        isProp = true;
      }
      if (isProp) {
        props.push(`${key}: _${val}`);
      }
    }

    for (let i = 0; i < attributes.length; i++) {
      let name = attributes[i].name;
      const value = attributes[i].textContent!;

      // regular attributes
      if (
        !name.startsWith("t-") &&
        !(<Element>node).getAttribute("t-attf-" + name)
      ) {
        const attID = ctx.generateID();
        ctx.addLine(`var _${attID} = '${value}';`);
        if (!name.match(/^[a-zA-Z]+$/)) {
          // attribute contains 'non letters' => we want to quote it
          name = '"' + name + '"';
        }
        attrs.push(`${name}: _${attID}`);
        handleBooleanProps(name, attID);
      }

      // dynamic attributes
      if (name.startsWith("t-att-")) {
        let attName = name.slice(6);
        let formattedValue = ctx.formatExpression(ctx.getValue(value!));
        if (
          formattedValue[0] === "{" &&
          formattedValue[formattedValue.length - 1] === "}"
        ) {
          formattedValue = `this.utils.objectToAttrString(${formattedValue})`;
        }
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
          ctx.addLine(`var _${attValueID} = ${formattedValue};`);
          formattedValue = `'${attValue}' + (_${attValueID} ? ' ' + _${attValueID} : '')`;
          const attrIndex = attrs.findIndex(att =>
            att.startsWith(attName + ":")
          );
          attrs.splice(attrIndex, 1);
        }
        ctx.addLine(`var _${attID} = ${formattedValue};`);
        attrs.push(`${attName}: _${attID}`);
        handleBooleanProps(attName, attID);
      }

      if (name.startsWith("t-attf-")) {
        let attName = name.slice(7);
        if (!attName.match(/^[a-zA-Z]+$/)) {
          // attribute contains 'non letters' => we want to quote it
          attName = '"' + attName + '"';
        }
        const formattedExpr = ctx.interpolate(value);
        const attID = ctx.generateID();
        let staticVal = (<Element>node).getAttribute(attName);
        if (staticVal) {
          ctx.addLine(`var _${attID} = '${staticVal} ' + ${formattedExpr};`);
        } else {
          ctx.addLine(`var _${attID} = ${formattedExpr};`);
        }
        attrs.push(`${attName}: _${attID}`);
      }

      // t-att= attributes
      if (name === "t-att") {
        let id = ctx.generateID();
        ctx.addLine(`var _${id} = ${ctx.formatExpression(value!)};`);
        tattrs.push(id);
      }
    }
    let nodeID = ctx.generateID();
    let nodeKey: any = (<Element>node).getAttribute("t-key");
    if (nodeKey) {
      nodeKey = ctx.formatExpression(nodeKey);
    } else {
      nodeKey = nodeID;
    }
    const parts = [`key:${nodeKey}`];
    if (attrs.length + tattrs.length > 0) {
      parts.push(`attrs:{${attrs.join(",")}}`);
    }
    if (props.length > 0) {
      parts.push(`props:{${props.join(",")}}`);
    }
    if (withHandlers) {
      parts.push(`on:{}`);
    }

    ctx.addLine(`let c${nodeID} = [], p${nodeID} = {${parts.join(",")}};`);
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
      `var vn${nodeID} = h('${node.nodeName}', p${nodeID}, c${nodeID});`
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
}

//------------------------------------------------------------------------------
// Compilation Context
//------------------------------------------------------------------------------
export class Context {
  nextID: number = 1;
  code: string[] = [];
  variables: { [key: string]: any } = {};
  definedVariables: { [key: string]: string } = {};
  escaping: boolean = false;
  parentNode: number | null = null;
  rootNode: number | null = null;
  indentLevel: number = 0;
  rootContext: Context;
  caller: Element | undefined;
  shouldDefineOwner: boolean = false;
  shouldDefineQWeb: boolean = false;
  shouldDefineUtils: boolean = false;
  shouldProtectContext: boolean = false;
  inLoop: boolean = false;
  inPreTag: boolean = false;
  templateName: string;

  constructor(name?: string) {
    this.rootContext = this;
    this.templateName = name || "noname";
    this.addLine("var h = this.utils.h;");
  }

  generateID(): number {
    const id = this.rootContext.nextID++;
    return id;
  }

  withParent(node: number): Context {
    if (this === this.rootContext && this.parentNode) {
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

  formatExpression(e: string): string {
    e = e.trim();
    if (e[0] === "{" && e[e.length - 1] === "}") {
      const innerExpr = e
        .slice(1, -1)
        .split(",")
        .map(p => {
          let [key, val] = p.trim().split(":");
          if (key === "") {
            return "";
          }
          if (!val) {
            val = key;
          }
          return `${key}: ${this.formatExpression(val)}`;
        })
        .join(",");
      return "{" + innerExpr + "}";
    }

    // Thanks CHM for this code...
    const chars = e.split("");
    let instring = "";
    let invar = "";
    let invarPos = 0;
    let r = "";
    chars.push(" ");
    for (let i = 0, ilen = chars.length; i < ilen; i++) {
      let c = chars[i];
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
          if (!(invar in this.definedVariables)) {
            invar =
              WORD_REPLACEMENT[invar] ||
              (invar in this.variables &&
                this.formatExpression(this.variables[invar])) ||
              "context['" + invar + "']";
          }
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
    return result;
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
    matches = s.match(/\#\{.*?\}/g);
    if (matches && matches[0].length === s.length) {
      return `(${this.formatExpression(s.slice(2, -1))})`;
    }

    let formatter = expr => "${" + this.formatExpression(expr) + "}";
    let r = s
      .replace(/\{\{.*?\}\}/g, s => formatter(s.slice(2, -2)))
      .replace(/\#\{.*?\}/g, s => formatter(s.slice(2, -1)));
    return "`" + r + "`";
  }
}
