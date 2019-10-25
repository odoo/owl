import { EventBus } from "../core/event_bus";
import { h, patch, VNode } from "../vdom/index";
import { CompilationContext } from "./compilation_context";
import { shallowEqual } from "../utils";
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

const DISABLED_TAGS = ["input", "textarea", "button", "select", "option", "optgroup"];

const TRANSLATABLE_ATTRS = ["label", "title", "placeholder", "alt"];

const lineBreakRE = /[\r\n]/;
const whitespaceRE = /\s+/g;

const NODE_HOOKS_PARAMS = {
  create: "(_, n)",
  insert: "vn",
  remove: "(vn, rm)",
  destroy: "()"
};

interface Utils {
  toObj(expr: any): Object;
  shallowEqual(p1: Object, p2: Object): boolean;
  [key: string]: any;
}

const UTILS: Utils = {
  toObj(expr) {
    if (typeof expr === "string") {
      expr = expr.trim();
      if (!expr) {
        return {};
      }
      let words = expr.split(/\s+/);
      let result = {};
      for (let i = 0; i < words.length; i++) {
        result[words[i]] = true;
      }
      return result;
    }
    return expr;
  },
  shallowEqual,
  addNameSpace(vnode) {
    addNS(vnode.data, vnode.children, vnode.sel);
  }
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
    key: 1,
    translation: 1
  };
  static DIRECTIVES: Directive[] = [];

  static TEMPLATES: { [name: string]: Template } = {};

  static nextId: number = 1;

  h = h;
  // dev mode enables better error messages or more costly validations
  static dev: boolean = false;

  // slots contains sub templates defined with t-set inside t-component nodes, and
  // are meant to be used by the t-slot directive.
  static slots = {};
  static nextSlotId = 1;

  // recursiveTemplates contains sub templates called with t-call, but which
  // ends up in recursive situations.  This is very similar to the slot situation,
  // as in we need to propagate the scope.
  recursiveFns = {};

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
      directive.extraNames.forEach(n => (QWeb.DIRECTIVE_NAMES[n] = 1));
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
      fn: function(this: QWeb, context, extra) {
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
          throw new Error("Only one conditional branching directive is allowed per node");
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
    const result = patch(node, vnode);
    return (<HTMLElement>result.elm).outerHTML;
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

  _compile(name: string, elem: Element, parentContext?: CompilationContext): CompiledTemplate {
    const isDebug = elem.attributes.hasOwnProperty("t-debug");
    const ctx = new CompilationContext(name);
    if (elem.tagName !== "t") {
      ctx.shouldDefineResult = false;
    }
    if (parentContext) {
      ctx.templates = Object.create(parentContext.templates);
      ctx.variables = Object.create(parentContext.variables);
      ctx.nextID = parentContext.nextID + 1;
      ctx.parentNode = parentContext.parentNode || ctx.nextID++;
      ctx.allowMultipleRoots = true;
      ctx.hasParentWidget = true;
      ctx.shouldDefineResult = false;
      ctx.addLine(`let c${ctx.parentNode} = extra.parentNode;`);

      for (let v in parentContext.variables) {
        let variable = <any>parentContext.variables[v];
        if (variable.id) {
          ctx.addLine(`let ${variable.id} = extra.fiber.vars.${variable.id}`);
        }
      }
    }
    if (parentContext) {
      ctx.addLine("    Object.assign(context, extra.fiber.scope);");
    }
    this._compileNode(elem, ctx);

    if (!parentContext) {
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

    let template;
    try {
      template = new Function("context", "extra", code.join("\n")) as CompiledTemplate;
    } catch (e) {
      const templateName = ctx.templateName.replace(/`/g, "'");
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
          text = this.translateFn(text);
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
        ctx.addLine(`var vn${nodeID} = {text: \`${text}\`};`);
        ctx.addLine(`result = vn${nodeID};`);
        ctx.rootContext.rootNode = nodeID;
        ctx.rootContext.parentTextNode = nodeID;
      }
      return;
    }

    const firstLetter = node.tagName[0];
    if (firstLetter === firstLetter.toUpperCase()) {
      // this is a component, we modify in place the xml document to change
      // <SomeComponent ... /> to <t t-component="SomeComponent" ... />
      node.setAttribute("t-component", node.tagName);
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
          const tNode = document.createElement("t");
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
          value
        });
        if (isDone) {
          for (let { directive, value, fullName } of finalizers) {
            directive.finalize!({ node, qweb: this, ctx, fullName, value });
          }
          return;
        }
      }
    }

    if (node.nodeName !== "t") {
      let nodeID = this._compileGenericNode(node, ctx, withHandlers);
      ctx = ctx.withParent(nodeID);
      ctx = ctx.subContext("currentKey", ctx.lastNodeKey);
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
      if ((key === "readonly" && node.nodeName === "input") || node.nodeName === "textarea") {
        isProp = true;
      }
      if (isProp) {
        props.push(`${key}: _${val}`);
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
          let classDef = value
            .trim()
            .split(/\s+/)
            .map(a => `'${a}':true`)
            .join(",");
          classObj = `_${ctx.generateID()}`;
          ctx.addLine(`let ${classObj} = {${classDef}};`);
        } else {
          ctx.addLine(`var _${attID} = '${value}';`);
          if (!name.match(/^[a-zA-Z]+$/)) {
            // attribute contains 'non letters' => we want to quote it
            name = '"' + name + '"';
          }
          attrs.push(`${name}: _${attID}`);
          handleBooleanProps(name, attID);
        }
      }

      // dynamic attributes
      if (name.startsWith("t-att-")) {
        let attName = name.slice(6);
        const v = ctx.getValue(value);
        let formattedValue = typeof v === "string" ? ctx.formatExpression(v) : v.id;

        if (attName === "class") {
          ctx.rootContext.shouldDefineUtils = true;
          formattedValue = `utils.toObj(${formattedValue})`;
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
            ctx.addLine(`var _${attValueID} = ${formattedValue};`);
            formattedValue = `'${attValue}' + (_${attValueID} ? ' ' + _${attValueID} : '')`;
            const attrIndex = attrs.findIndex(att => att.startsWith(attName + ":"));
            attrs.splice(attrIndex, 1);
          }
          ctx.addLine(`var _${attID} = ${formattedValue};`);
          attrs.push(`${attName}: _${attID}`);
          handleBooleanProps(attName, attID);
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
      ctx.addLine(`const nodeKey${nodeID} = ${ctx.formatExpression(nodeKey)}`);
      nodeKey = `nodeKey${nodeID}`;
      ctx.lastNodeKey = nodeKey;
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
    ctx.addLine(`var vn${nodeID} = h('${node.nodeName}', p${nodeID}, c${nodeID});`);
    if (ctx.parentNode) {
      ctx.addLine(`c${ctx.parentNode}.push(vn${nodeID});`);
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
