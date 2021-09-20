import { EventBus } from "../core/event_bus";
import { h, patch, VNode } from "../vdom/index";
import { CompilationContext } from "./compilation_context";
import { shallowEqual, escape } from "../utils";
import { addNS } from "../vdom/vdom";

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
  ctx: CompilationContext;
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

interface QWebConfig {
  templates?: string;
  translateFn?(text: string): string;
}

//------------------------------------------------------------------------------
// Const/global stuff/helpers
//------------------------------------------------------------------------------

export const TRANSLATABLE_ATTRS = ["label", "title", "placeholder", "alt"];

const lineBreakRE = /[\r\n]/;
const whitespaceRE = /\s+/g;
const translationRE = /^(\s*)([\s\S]+?)(\s*)$/;

const NODE_HOOKS_PARAMS = {
  create: "(_, n)",
  insert: "vn",
  remove: "(vn, rm)",
  destroy: "()",
};

interface Utils {
  toClassObj(expr: any): Object;
  shallowEqual(p1: Object, p2: Object): boolean;
  [key: string]: any;
}

function isComponent(obj): boolean {
  return obj && obj.hasOwnProperty("__owl__");
}

class VDomArray extends Array {
  toString() {
    return vDomToString(this);
  }
}

function vDomToString(vdom: VNode[]): string {
  return vdom
    .map((vnode) => {
      if (vnode.sel) {
        const node = document.createElement(vnode.sel);
        const result = patch(node, vnode);
        return (<HTMLElement>result.elm).outerHTML;
      } else {
        return vnode.text;
      }
    })
    .join("");
}

const UTILS: Utils = {
  zero: Symbol("zero"),
  toClassObj(expr) {
    const result = {};
    if (typeof expr === "string") {
      // we transform here a list of classes into an object:
      //  'hey you' becomes {hey: true, you: true}
      expr = expr.trim();
      if (!expr) {
        return {};
      }
      let words = expr.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        result[words[i]] = true;
      }
      return result;
    }
    // this is already an object, but we may need to split keys:
    // {'a b': true, 'a c': false} should become {a: true, b: true, c: false}
    for (let key in expr) {
      const value = expr[key];
      const words = key.split(/\s+/);
      for (let word of words) {
        result[word] = result[word] || value;
      }
    }
    return result;
  },
  /**
   * This method combines the current context with the variables defined in a
   * scope for use in a slot.
   *
   * The implementation is kind of tricky because we want to preserve the
   * prototype chain structure of the cloned result. So we need to traverse the
   * prototype chain, cloning each level respectively.
   */
  combine(context, scope) {
    let clone = context;
    const scopeStack = [];
    while (!isComponent(scope)) {
      scopeStack.push(scope);
      scope = scope.__proto__;
    }
    while (scopeStack.length) {
      let scope = scopeStack.pop();
      clone = Object.create(clone);
      Object.assign(clone, scope);
    }
    return clone;
  },
  shallowEqual,
  addNameSpace(vnode) {
    addNS(vnode.data, vnode.children, vnode.sel);
  },
  VDomArray,
  vDomToString,
  getComponent(obj) {
    while (obj && !isComponent(obj)) {
      obj = obj.__proto__;
    }
    return obj;
  },
  getScope(obj, property: string) {
    const obj0 = obj;
    while (
      obj &&
      !obj.hasOwnProperty(property) &&
      !(obj.hasOwnProperty("__access_mode__") && obj.__access_mode__ === "ro")
    ) {
      const newObj = obj.__proto__;
      if (!newObj || isComponent(newObj)) {
        return obj0;
      }
      obj = newObj;
    }
    return obj;
  },
};

function parseXML(xml: string): Document {
  const parser = new DOMParser();

  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    let msg = "Invalid XML in template.";
    const parsererrorText = doc.getElementsByTagName("parsererror")[0].textContent;
    if (parsererrorText) {
      msg += "\nThe parser has produced the following error message:\n" + parsererrorText;
      const re = /\d+/g;
      const firstMatch = re.exec(parsererrorText);
      if (firstMatch) {
        const lineNumber = Number(firstMatch[0]);
        const line = xml.split("\n")[lineNumber - 1];
        const secondMatch = re.exec(parsererrorText);
        if (line && secondMatch) {
          const columnIndex = Number(secondMatch[0]) - 1;
          if (line[columnIndex]) {
            msg +=
              `\nThe error might be located at xml line ${lineNumber} column ${columnIndex}\n` +
              `${line}\n${"-".repeat(columnIndex - 1)}^`;
          }
        }
      }
    }
    throw new Error(msg);
  }
  return doc;
}

function escapeQuotes(str: string): string {
  return str.replace(/\'/g, "\\'");
}

//------------------------------------------------------------------------------
// QWeb rendering engine
//------------------------------------------------------------------------------

export class QWeb extends EventBus {
  templates: { [name: string]: Template };
  static utils = UTILS;
  static components = Object.create(null);

  static DIRECTIVE_NAMES: { [key: string]: 1 } = {
    name: 1,
    att: 1,
    attf: 1,
    translation: 1,
    tag: 1,
  };
  static DIRECTIVES: Directive[] = [];

  static TEMPLATES: { [name: string]: Template } = {};

  static nextId: number = 1;

  h = h;
  // dev mode enables better error messages or more costly validations
  static dev: boolean = false;
  static enableTransitions: boolean = true;

  // slots contains sub templates defined with t-set inside t-component nodes, and
  // are meant to be used by the t-slot directive.
  static slots = {};
  static nextSlotId = 1;

  // subTemplates are stored in two objects: a (local) mapping from a name to an
  // id, and a (global) mapping from an id to the compiled function.  This is
  // necessary to ensure that global templates can be called with more than one
  // QWeb instance.
  subTemplates: { [key: string]: number } = {};
  static subTemplates: { [id: number]: Function } = {};

  isUpdating: boolean = false;
  translateFn?: QWebConfig["translateFn"];

  constructor(config: QWebConfig = {}) {
    super();
    this.templates = Object.create(QWeb.TEMPLATES);
    if (config.templates) {
      this.addTemplates(config.templates);
    }
    if (config.translateFn) {
      this.translateFn = config.translateFn;
    }
  }

  static addDirective(directive: Directive) {
    if (directive.name in QWeb.DIRECTIVE_NAMES) {
      throw new Error(`Directive "${directive.name} already registered`);
    }
    QWeb.DIRECTIVES.push(directive);
    QWeb.DIRECTIVE_NAMES[directive.name] = 1;
    QWeb.DIRECTIVES.sort((d1, d2) => d1.priority - d2.priority);
    if (directive.extraNames) {
      directive.extraNames.forEach((n) => (QWeb.DIRECTIVE_NAMES[n] = 1));
    }
  }

  static registerComponent(name: string, Component: any) {
    if (QWeb.components[name]) {
      throw new Error(`Component '${name}' has already been registered`);
    }
    QWeb.components[name] = Component;
  }

  /**
   * Register globally a template.  All QWeb instances will obtain their
   * templates from their own template map, and then, from the global static
   * TEMPLATES property.
   */
  static registerTemplate(name: string, template: string) {
    if (QWeb.TEMPLATES[name]) {
      throw new Error(`Template '${name}' has already been registered`);
    }
    const qweb = new QWeb();
    qweb.addTemplate(name, template);
    QWeb.TEMPLATES[name] = qweb.templates[name];
  }

  /**
   * Add a template to the internal template map.  Note that it is not
   * immediately compiled.
   */
  addTemplate(name: string, xmlString: string, allowDuplicate?: boolean) {
    if (allowDuplicate && name in this.templates) {
      return;
    }
    const doc = parseXML(xmlString);
    if (!doc.firstChild) {
      throw new Error("Invalid template (should not be empty)");
    }
    this._addTemplate(name, <Element>doc.firstChild);
  }

  /**
   * Load templates from a xml (as a string or xml document).  This will look up
   * for the first <templates> tag, and will consider each child of this as a
   * template, with the name given by the t-name attribute.
   */
  addTemplates(xmlstr: string | Document) {
    if (!xmlstr) {
      return;
    }
    const doc = typeof xmlstr === "string" ? parseXML(xmlstr) : xmlstr;
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
      fn: function (this: QWeb, context, extra) {
        const compiledFunction = this._compile(name);
        template.fn = compiledFunction;
        return compiledFunction.call(this, context, extra);
      },
    };
    this.templates[name] = template;
  }

  _processTemplate(elem: Element) {
    let tbranch = elem.querySelectorAll("[t-elif], [t-else]");
    for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
      let node = tbranch[i];
      let prevElem = node.previousElementSibling!;
      let pattr = function (name) {
        return prevElem.getAttribute(name);
      };
      let nattr = function (name) {
        return +!!node.getAttribute(name);
      };
      if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
        if (pattr("t-foreach")) {
          throw new Error(
            "t-if cannot stay at the same level as t-foreach when using t-elif or t-else"
          );
        }
        if (
          ["t-if", "t-elif", "t-else"].map(nattr).reduce(function (a, b) {
            return a + b;
          }) > 1
        ) {
          throw new Error("Only one conditional branching directive is allowed per node");
        }
        // All text (with only spaces) and comment nodes (nodeType 8) between
        // branch nodes are removed
        let textNode;
        while ((textNode = node.previousSibling) !== prevElem) {
          if (textNode.nodeValue.trim().length && textNode.nodeType !== 8) {
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

  /**
   * Render a template to a html string.
   *
   * Note that this is more limited than the `render` method: it is not suitable
   * to render a full component tree, since this is an asynchronous operation.
   * This method can only render templates without components.
   */
  renderToString(name: string, context: EvalContext = {}, extra?: any): string {
    const vnode = this.render(name, context, extra);
    if (vnode.sel === undefined) {
      return vnode.text!;
    }
    const node = document.createElement(vnode.sel);
    const elem = patch(node, vnode).elm as HTMLElement;
    function escapeTextNodes(node) {
      if (node.nodeType === 3) {
        node.textContent = escape(node.textContent);
      }
      for (let n of node.childNodes) {
        escapeTextNodes(n);
      }
    }
    escapeTextNodes(elem);
    return elem.outerHTML;
  }

  /**
   * Force all widgets connected to this QWeb instance to rerender themselves.
   *
   * This method is mostly useful for external code that want to modify the
   * application in some cases.  For example, a router plugin.
   */
  forceUpdate() {
    this.isUpdating = true;
    Promise.resolve().then(() => {
      if (this.isUpdating) {
        this.isUpdating = false;
        this.trigger("update");
      }
    });
  }

  _compile(
    name: string,
    options: {
      elem?: Element;
      hasParent?: boolean;
      defineKey?: boolean;
    } = {}
  ): CompiledTemplate {
    const elem = options.elem || this.templates[name].elem;
    const isDebug = elem.attributes.hasOwnProperty("t-debug");
    const ctx = new CompilationContext(name);
    if (elem.tagName !== "t") {
      ctx.shouldDefineResult = false;
    }
    if (options.hasParent) {
      ctx.variables = Object.create(null);
      ctx.parentNode = ctx.generateID();
      ctx.allowMultipleRoots = true;
      ctx.shouldDefineParent = true;
      ctx.hasParentWidget = true;
      ctx.shouldDefineResult = false;
      ctx.addLine(`let c${ctx.parentNode} = extra.parentNode;`);
      if (options.defineKey) {
        ctx.addLine(`let key0 = extra.key || "";`);
        ctx.hasKey0 = true;
      }
    }
    this._compileNode(elem, ctx);

    if (!options.hasParent) {
      if (ctx.shouldDefineResult) {
        ctx.addLine(`return result;`);
      } else {
        if (!ctx.rootNode) {
          throw new Error(`A template should have one root node (${ctx.templateName})`);
        }
        ctx.addLine(`return vn${ctx.rootNode};`);
      }
    }

    let code = ctx.generateCode();
    const templateName = ctx.templateName.replace(/`/g, "'").slice(0, 200);
    code.unshift(`    // Template name: "${templateName}"`);

    let template;
    try {
      template = new Function("context, extra", code.join("\n")) as CompiledTemplate;
    } catch (e) {
      console.groupCollapsed(`Invalid Code generated by ${templateName}`);
      console.warn(code.join("\n"));
      console.groupEnd();
      throw new Error(
        `Invalid generated code while compiling template '${templateName}': ${e.message}`
      );
    }
    if (isDebug) {
      const tpl = this.templates[name];
      if (tpl) {
        const msg = `Template: ${tpl.elem.outerHTML}\nCompiled code:\n${template.toString()}`;
        console.log(msg);
      }
    }
    return template;
  }

  /**
   * Generate code from an xml node
   *
   */
  _compileNode(node: ChildNode, ctx: CompilationContext) {
    if (!(node instanceof Element)) {
      // this is a text node, there are no directive to apply
      let text = node.textContent!;
      if (!ctx.inPreTag) {
        if (lineBreakRE.test(text) && !text.trim()) {
          return;
        }
        text = text.replace(whitespaceRE, " ");
      }
      if (this.translateFn) {
        if ((node.parentNode as any).getAttribute("t-translation") !== "off") {
          const match = translationRE.exec(text);
          text = match[1] + this.translateFn(match[2]) + match[3];
        }
      }
      if (ctx.parentNode) {
        if (node.nodeType === 3) {
          ctx.addLine(`c${ctx.parentNode}.push({text: \`${text}\`});`);
        } else if (node.nodeType === 8) {
          ctx.addLine(`c${ctx.parentNode}.push(h('!', \`${text}\`));`);
        }
      } else if (ctx.parentTextNode) {
        ctx.addLine(`vn${ctx.parentTextNode}.text += \`${text}\`;`);
      } else {
        // this is an unusual situation: this text node is the result of the
        // template rendering.
        let nodeID = ctx.generateID();
        ctx.addLine(`let vn${nodeID} = {text: \`${text}\`};`);
        ctx.addLine(`result = vn${nodeID};`);
        ctx.rootContext.rootNode = nodeID;
        ctx.rootContext.parentTextNode = nodeID;
      }
      return;
    }

    if (node.tagName !== "t" && node.hasAttribute("t-call")) {
      const tCallNode = document.implementation.createDocument(
        "http://www.w3.org/1999/xhtml",
        "t",
        null
      ).documentElement;
      tCallNode.setAttribute("t-call", node.getAttribute("t-call")!);
      node.removeAttribute("t-call");
      node.prepend(tCallNode);
    }

    const firstLetter = node.tagName[0];
    if (firstLetter === firstLetter.toUpperCase()) {
      // this is a component, we modify in place the xml document to change
      // <SomeComponent ... /> to <SomeComponent t-component="SomeComponent" ... />
      node.setAttribute("t-component", node.tagName);
    } else if (node.tagName !== "t" && node.hasAttribute("t-component")) {
      throw new Error(
        `Directive 't-component' can only be used on <t> nodes (used on a <${node.tagName}>)`
      );
    }
    const attributes = (<Element>node).attributes;

    const validDirectives: {
      directive: Directive;
      value: string;
      fullName: string;
    }[] = [];

    const finalizers: typeof validDirectives = [];

    // maybe this is not optimal: we iterate on all attributes here, and again
    // just after for each directive.
    for (let i = 0; i < attributes.length; i++) {
      let attrName = attributes[i].name;
      if (attrName.startsWith("t-")) {
        let dName = attrName.slice(2).split(/-|\./)[0];
        if (!(dName in QWeb.DIRECTIVE_NAMES)) {
          throw new Error(`Unknown QWeb directive: '${attrName}'`);
        }
        if (node.tagName !== "t" && (attrName === "t-esc" || attrName === "t-raw")) {
          const tNode = document.implementation.createDocument(
            "http://www.w3.org/1999/xhtml",
            "t",
            null
          ).documentElement;
          tNode.setAttribute(attrName, node.getAttribute(attrName)!);
          for (let child of Array.from(node.childNodes)) {
            tNode.appendChild(child);
          }
          node.appendChild(tNode);
          node.removeAttribute(attrName);
        }
      }
    }

    const DIR_N = QWeb.DIRECTIVES.length;
    const ATTR_N = attributes.length;
    let withHandlers = false;
    for (let i = 0; i < DIR_N; i++) {
      let directive = QWeb.DIRECTIVES[i];
      let fullName;
      let value;
      for (let j = 0; j < ATTR_N; j++) {
        const name = attributes[j].name;
        if (
          name === "t-" + directive.name ||
          name.startsWith("t-" + directive.name + "-") ||
          name.startsWith("t-" + directive.name + ".")
        ) {
          fullName = name;
          value = attributes[j].textContent;
          validDirectives.push({ directive, value, fullName });
          if (directive.name === "on" || directive.name === "model") {
            withHandlers = true;
          }
        }
      }
    }

    for (let { directive, value, fullName } of validDirectives) {
      if (directive.finalize) {
        finalizers.push({ directive, value, fullName });
      }
      if (directive.atNodeEncounter) {
        const isDone = directive.atNodeEncounter({
          node,
          qweb: this,
          ctx,
          fullName,
          value,
        });
        if (isDone) {
          for (let { directive, value, fullName } of finalizers) {
            directive.finalize!({ node, qweb: this, ctx, fullName, value });
          }
          return;
        }
      }
    }

    if (node.nodeName !== "t" || node.hasAttribute("t-tag")) {
      let nodeHooks = {};
      let addNodeHook = function (hook, handler) {
        nodeHooks[hook] = nodeHooks[hook] || [];
        nodeHooks[hook].push(handler);
      };
      if (node.tagName === "select" && node.hasAttribute("t-att-value")) {
        const value = node.getAttribute("t-att-value");
        let exprId = ctx.generateID();
        ctx.addLine(`let expr${exprId} = ${ctx.formatExpression(value)};`);
        let expr = `expr${exprId}`;
        node.setAttribute("t-att-value", expr);
        addNodeHook("create", `n.elm.value=${expr};`);
      }
      let nodeID = this._compileGenericNode(node, ctx, withHandlers);
      ctx = ctx.withParent(nodeID);

      for (let { directive, value, fullName } of validDirectives) {
        if (directive.atNodeCreation) {
          directive.atNodeCreation({
            node,
            qweb: this,
            ctx,
            fullName,
            value,
            nodeID,
            addNodeHook,
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
    // svg support
    // we hadd svg namespace if it is a svg or if it is a g, but only if it is
    // the root node.  This is the easiest way to support svg sub components:
    // they need to have a g tag as root. Otherwise, we would need a complete
    // list of allowed svg tags.
    const shouldAddNS =
      node.nodeName === "svg" || (node.nodeName === "g" && ctx.rootNode === ctx.parentNode);
    if (shouldAddNS) {
      ctx.rootContext.shouldDefineUtils = true;
      ctx.addLine(`utils.addNameSpace(vn${ctx.parentNode});`);
    }

    for (let { directive, value, fullName } of finalizers) {
      directive.finalize!({ node, qweb: this, ctx, fullName, value });
    }
  }

  _compileGenericNode(
    node: ChildNode,
    ctx: CompilationContext,
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

    function handleProperties(key, val) {
      let isProp = false;
      switch (node.nodeName) {
        case "input":
          let type = (<Element>node).getAttribute("type");
          if (type === "checkbox" || type === "radio") {
            if (key === "checked" || key === "indeterminate") {
              isProp = true;
            }
          }
          if (key === "value" || key === "readonly" || key === "disabled") {
            isProp = true;
          }
          break;
        case "option":
          isProp = key === "selected" || key === "disabled";
          break;
        case "textarea":
          isProp = key === "readonly" || key === "disabled" || key === "value";
          break;
        case "select":
          isProp = key === "disabled" || key === "value";
          break;
        case "button":
        case "optgroup":
          isProp = key === "disabled";
          break;
      }
      if (isProp) {
        props.push(`${key}: ${val}`);
      }
    }
    let classObj = "";

    for (let i = 0; i < attributes.length; i++) {
      let name = attributes[i].name;
      let value = attributes[i].textContent!;

      if (this.translateFn && TRANSLATABLE_ATTRS.includes(name)) {
        value = this.translateFn(value);
      }

      // regular attributes
      if (!name.startsWith("t-") && !(<Element>node).getAttribute("t-attf-" + name)) {
        const attID = ctx.generateID();
        if (name === "class") {
          if ((value = value.trim())) {
            let classDef = value
              .split(/\s+/)
              .map((a) => `'${escapeQuotes(a)}':true`)
              .join(",");
            if (classObj) {
              ctx.addLine(`Object.assign(${classObj}, {${classDef}})`);
            } else {
              classObj = `_${ctx.generateID()}`;
              ctx.addLine(`let ${classObj} = {${classDef}};`);
            }
          }
        } else {
          ctx.addLine(`let _${attID} = '${escapeQuotes(value)}';`);
          if (!name.match(/^[a-zA-Z]+$/)) {
            // attribute contains 'non letters' => we want to quote it
            name = '"' + name + '"';
          }
          attrs.push(`${name}: _${attID}`);
          handleProperties(name, `_${attID}`);
        }
      }

      // dynamic attributes
      if (name.startsWith("t-att-")) {
        let attName = name.slice(6);
        const v = ctx.getValue(value);
        let formattedValue = typeof v === "string" ? ctx.formatExpression(v) : `scope.${v.id}`;

        if (attName === "class") {
          ctx.rootContext.shouldDefineUtils = true;
          formattedValue = `utils.toClassObj(${formattedValue})`;
          if (classObj) {
            ctx.addLine(`Object.assign(${classObj}, ${formattedValue})`);
          } else {
            classObj = `_${ctx.generateID()}`;
            ctx.addLine(`let ${classObj} = ${formattedValue};`);
          }
        } else {
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
            const attrIndex = attrs.findIndex((att) => att.startsWith(attName + ":"));
            attrs.splice(attrIndex, 1);
          }
          if (node.nodeName === "select" && attName === "value") {
            attrs.push(`${attName}: ${v}`);
            handleProperties(attName, v);
          } else {
            ctx.addLine(`let _${attID} = ${formattedValue};`);
            attrs.push(`${attName}: _${attID}`);
            handleProperties(attName, "_" + attID);
          }
        }
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
          ctx.addLine(`let _${attID} = '${staticVal} ' + ${formattedExpr};`);
        } else {
          ctx.addLine(`let _${attID} = ${formattedExpr};`);
        }
        attrs.push(`${attName}: _${attID}`);
      }

      // t-att= attributes
      if (name === "t-att") {
        let id = ctx.generateID();
        ctx.addLine(`let _${id} = ${ctx.formatExpression(value!)};`);
        tattrs.push(id);
      }
    }
    let nodeID = ctx.generateID();
    let key = ctx.loopNumber || ctx.hasKey0 ? `\`\${key${ctx.loopNumber}}_${nodeID}\`` : nodeID;
    const parts = [`key:${key}`];
    if (attrs.length + tattrs.length > 0) {
      parts.push(`attrs:{${attrs.join(",")}}`);
    }
    if (props.length > 0) {
      parts.push(`props:{${props.join(",")}}`);
    }
    if (classObj) {
      parts.push(`class:${classObj}`);
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
    let nodeName = `'${node.nodeName}'`;
    if ((<Element>node).hasAttribute("t-tag")) {
      const tagExpr = (<Element>node).getAttribute("t-tag");
      (<Element>node).removeAttribute("t-tag");
      nodeName = `tag${ctx.generateID()}`;
      ctx.addLine(`let ${nodeName} = ${ctx.formatExpression(tagExpr)};`);
    }
    ctx.addLine(`let vn${nodeID} = h(${nodeName}, p${nodeID}, c${nodeID});`);
    if (ctx.parentNode) {
      ctx.addLine(`c${ctx.parentNode}.push(vn${nodeID});`);
    } else if (ctx.loopNumber || ctx.hasKey0) {
      ctx.rootContext.shouldDefineResult = true;
      ctx.addLine(`result = vn${nodeID};`);
    }

    return nodeID;
  }

  _compileChildren(node: ChildNode, ctx: CompilationContext) {
    if (node.childNodes.length > 0) {
      for (let child of Array.from(node.childNodes)) {
        this._compileNode(child, ctx);
      }
    }
  }
}
