import { OwlError } from "../common/owl_error";
import type { customDirectives } from "../common/types";
import { parseXML } from "../common/utils";

// -----------------------------------------------------------------------------
// AST Type definition
// -----------------------------------------------------------------------------

export type EventHandlers = { [eventName: string]: string };
export type Attrs = { [attrs: string]: string };

export const enum ASTType {
  Text,
  Comment,
  DomNode,
  Multi,
  TEsc,
  TIf,
  TSet,
  TCall,
  TOut,
  TForEach,
  TKey,
  TComponent,
  TDebug,
  TLog,
  TSlot,
  TCallBlock,
  TTranslation,
  TTranslationContext,
  TPortal,
}

export interface ASTText {
  type: ASTType.Text;
  value: string;
}

export interface ASTComment {
  type: ASTType.Comment;
  value: string;
}

interface TModelInfo {
  baseExpr: string;
  expr: string;
  targetAttr: string;
  eventType: "change" | "click" | "input";
  shouldTrim: boolean;
  shouldNumberize: boolean;
  hasDynamicChildren: boolean;
  specialInitTargetAttr: string | null;
}

export interface ASTDomNode {
  type: ASTType.DomNode;
  tag: string;
  content: AST[];
  attrs: Attrs | null;
  attrsTranslationCtx: Attrs | null;
  ref: string | null;
  on: EventHandlers | null;
  model: TModelInfo | null;
  dynamicTag: string | null;
  ns: string | null;
}

export interface ASTMulti {
  type: ASTType.Multi;
  content: AST[];
}

export interface ASTTEsc {
  type: ASTType.TEsc;
  expr: string;
  defaultValue: string;
}

export interface ASTTOut {
  type: ASTType.TOut;
  expr: string;
  body: AST[] | null;
}

export interface ASTTif {
  type: ASTType.TIf;
  condition: string;
  content: AST;
  tElif: { condition: string; content: AST }[] | null;
  tElse: AST | null;
}

export interface ASTTSet {
  type: ASTType.TSet;
  name: string;
  value: string | null; // value defined in attribute
  defaultValue: string | null; // value defined in body, if text
  body: AST[] | null; // content of body if not text
}

export interface ASTTForEach {
  type: ASTType.TForEach;
  collection: string;
  elem: string;
  body: AST;
  memo: string;
  hasNoFirst: boolean;
  hasNoLast: boolean;
  hasNoIndex: boolean;
  hasNoValue: boolean;
  key: string | null;
}

export interface ASTTKey {
  type: ASTType.TKey;
  expr: string;
  content: AST;
}

export interface ASTTCall {
  type: ASTType.TCall;
  name: string;
  body: AST[] | null;
  context: string | null;
}

interface SlotDefinition {
  content: AST | null;
  scope: string | null;
  on: EventHandlers | null;
  attrs: Attrs | null;
  attrsTranslationCtx: Attrs | null;
}

export interface ASTComponent {
  type: ASTType.TComponent;
  name: string;
  isDynamic: boolean;
  dynamicProps: string | null;
  on: EventHandlers | null;
  props: { [name: string]: string } | null;
  propsTranslationCtx: { [name: string]: string } | null;
  slots: { [name: string]: SlotDefinition } | null;
}

export interface ASTSlot {
  type: ASTType.TSlot;
  name: string;
  attrs: Attrs | null;
  attrsTranslationCtx: Attrs | null;
  on: EventHandlers | null;
  defaultContent: AST | null;
}

export interface ASTTCallBlock {
  type: ASTType.TCallBlock;
  name: string;
}

export interface ASTDebug {
  type: ASTType.TDebug;
  content: AST | null;
}

export interface ASTLog {
  type: ASTType.TLog;
  expr: string;
  content: AST | null;
}

export interface ASTTranslation {
  type: ASTType.TTranslation;
  content: AST | null;
}

export interface ASTTranslationContext {
  type: ASTType.TTranslationContext;
  content: AST | null;
  translationCtx: string;
}

export interface ASTTPortal {
  type: ASTType.TPortal;
  target: string;
  content: AST;
}

export type AST =
  | ASTText
  | ASTComment
  | ASTDomNode
  | ASTMulti
  | ASTTEsc
  | ASTTif
  | ASTTSet
  | ASTTCall
  | ASTTOut
  | ASTTForEach
  | ASTTKey
  | ASTComponent
  | ASTSlot
  | ASTTCallBlock
  | ASTLog
  | ASTDebug
  | ASTTranslation
  | ASTTranslationContext
  | ASTTPortal;

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------
const cache: WeakMap<Element, AST> = new WeakMap();

export function parse(xml: string | Element, customDir?: customDirectives): AST {
  const ctx = {
    inPreTag: false,
    customDirectives: customDir,
  };
  if (typeof xml === "string") {
    const elem = parseXML(`<t>${xml}</t>`).firstChild as Element;
    return _parse(elem, ctx);
  }
  let ast = cache.get(xml);
  if (!ast) {
    // we clone here the xml to prevent modifying it in place
    ast = _parse(xml.cloneNode(true) as Element, ctx);
    cache.set(xml, ast);
  }
  return ast;
}

function _parse(xml: Element, ctx: ParsingContext): AST {
  normalizeXML(xml);
  return parseNode(xml, ctx) || { type: ASTType.Text, value: "" };
}

interface ParsingContext {
  tModelInfo?: TModelInfo | null;
  nameSpace?: string;
  inPreTag: boolean;
  customDirectives?: customDirectives;
}

function parseNode(node: Node, ctx: ParsingContext): AST | null {
  if (!(node instanceof Element)) {
    return parseTextCommentNode(node, ctx);
  }
  return (
    parseTCustom(node, ctx) ||
    parseTDebugLog(node, ctx) ||
    parseTForEach(node, ctx) ||
    parseTIf(node, ctx) ||
    parseTPortal(node, ctx) ||
    parseTCall(node, ctx) ||
    parseTCallBlock(node, ctx) ||
    parseTTranslation(node, ctx) ||
    parseTTranslationContext(node, ctx) ||
    parseTEscNode(node, ctx) ||
    parseTOutNode(node, ctx) ||
    parseTKey(node, ctx) ||
    parseTSlot(node, ctx) ||
    parseComponent(node, ctx) ||
    parseDOMNode(node, ctx) ||
    parseTSetNode(node, ctx) ||
    parseTNode(node, ctx)
  );
}

// -----------------------------------------------------------------------------
// <t /> tag
// -----------------------------------------------------------------------------

function parseTNode(node: Element, ctx: ParsingContext): AST | null {
  if (node.tagName !== "t") {
    return null;
  }
  return parseChildNodes(node, ctx);
}

// -----------------------------------------------------------------------------
// Text and Comment Nodes
// -----------------------------------------------------------------------------
const lineBreakRE = /[\r\n]/;

function parseTextCommentNode(node: Node, ctx: ParsingContext): AST | null {
  if (node.nodeType === Node.TEXT_NODE) {
    let value = node.textContent || "";
    if (!ctx.inPreTag && lineBreakRE.test(value) && !value.trim()) {
      return null;
    }

    return { type: ASTType.Text, value };
  } else if (node.nodeType === Node.COMMENT_NODE) {
    return { type: ASTType.Comment, value: node.textContent || "" };
  }
  return null;
}

function parseTCustom(node: Element, ctx: ParsingContext): AST | null {
  if (!ctx.customDirectives) {
    return null;
  }
  const nodeAttrsNames = node.getAttributeNames();
  for (let attr of nodeAttrsNames) {
    if (attr === "t-custom" || attr === "t-custom-") {
      throw new OwlError("Missing custom directive name with t-custom directive");
    }
    if (attr.startsWith("t-custom-")) {
      const directiveName = attr.split(".")[0].slice(9);
      const customDirective = ctx.customDirectives[directiveName];
      if (!customDirective) {
        throw new OwlError(`Custom directive "${directiveName}" is not defined`);
      }
      const value = node.getAttribute(attr)!;
      const modifiers = attr.split(".").slice(1);
      node.removeAttribute(attr);
      try {
        customDirective(node, value, modifiers);
      } catch (error) {
        throw new OwlError(
          `Custom directive "${directiveName}" throw the following error: ${error}`
        );
      }
      return parseNode(node, ctx);
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// debugging
// -----------------------------------------------------------------------------

function parseTDebugLog(node: Element, ctx: ParsingContext): AST | null {
  if (node.hasAttribute("t-debug")) {
    node.removeAttribute("t-debug");
    return {
      type: ASTType.TDebug,
      content: parseNode(node, ctx),
    };
  }

  if (node.hasAttribute("t-log")) {
    const expr = node.getAttribute("t-log")!;
    node.removeAttribute("t-log");
    return {
      type: ASTType.TLog,
      expr,
      content: parseNode(node, ctx),
    };
  }
  return null;
}

// -----------------------------------------------------------------------------
// Regular dom node
// -----------------------------------------------------------------------------
const hasDotAtTheEnd = /\.[\w_]+\s*$/;
const hasBracketsAtTheEnd = /\[[^\[]+\]\s*$/;

const ROOT_SVG_TAGS = new Set(["svg", "g", "path"]);

function parseDOMNode(node: Element, ctx: ParsingContext): AST | null {
  const { tagName } = node;
  const dynamicTag = node.getAttribute("t-tag");
  node.removeAttribute("t-tag");
  if (tagName === "t" && !dynamicTag) {
    return null;
  }
  if (tagName.startsWith("block-")) {
    throw new OwlError(`Invalid tag name: '${tagName}'`);
  }
  ctx = Object.assign({}, ctx);
  if (tagName === "pre") {
    ctx.inPreTag = true;
  }

  let ns = !ctx.nameSpace && ROOT_SVG_TAGS.has(tagName) ? "http://www.w3.org/2000/svg" : null;
  const ref = node.getAttribute("t-ref");
  node.removeAttribute("t-ref");

  const nodeAttrsNames = node.getAttributeNames();
  let attrs: ASTDomNode["attrs"] = null;
  let attrsTranslationCtx: ASTDomNode["attrsTranslationCtx"] = null;
  let on: EventHandlers | null = null;
  let model: TModelInfo | null = null;

  for (let attr of nodeAttrsNames) {
    const value = node.getAttribute(attr)!;
    if (attr === "t-on" || attr === "t-on-") {
      throw new OwlError("Missing event name with t-on directive");
    }
    if (attr.startsWith("t-on-")) {
      on = on || {};
      on[attr.slice(5)] = value;
    } else if (attr.startsWith("t-model")) {
      if (!["input", "select", "textarea"].includes(tagName)) {
        throw new OwlError(
          "The t-model directive only works with <input>, <textarea> and <select>"
        );
      }

      let baseExpr, expr;
      if (hasDotAtTheEnd.test(value)) {
        const index = value.lastIndexOf(".");
        baseExpr = value.slice(0, index);
        expr = `'${value.slice(index + 1)}'`;
      } else if (hasBracketsAtTheEnd.test(value)) {
        const index = value.lastIndexOf("[");
        baseExpr = value.slice(0, index);
        expr = value.slice(index + 1, -1);
      } else {
        throw new OwlError(`Invalid t-model expression: "${value}" (it should be assignable)`);
      }

      const typeAttr = node.getAttribute("type");
      const isInput = tagName === "input";
      const isSelect = tagName === "select";
      const isCheckboxInput = isInput && typeAttr === "checkbox";
      const isRadioInput = isInput && typeAttr === "radio";
      const hasTrimMod = attr.includes(".trim");
      const hasLazyMod = hasTrimMod || attr.includes(".lazy");
      const hasNumberMod = attr.includes(".number");
      const eventType = isRadioInput ? "click" : isSelect || hasLazyMod ? "change" : "input";

      model = {
        baseExpr,
        expr,
        targetAttr: isCheckboxInput ? "checked" : "value",
        specialInitTargetAttr: isRadioInput ? "checked" : null,
        eventType,
        hasDynamicChildren: false,
        shouldTrim: hasTrimMod,
        shouldNumberize: hasNumberMod,
      };
      if (isSelect) {
        // don't pollute the original ctx
        ctx = Object.assign({}, ctx);
        ctx.tModelInfo = model;
      }
    } else if (attr.startsWith("block-")) {
      throw new OwlError(`Invalid attribute: '${attr}'`);
    } else if (attr === "xmlns") {
      ns = value;
    } else if (attr.startsWith("t-translation-context-")) {
      const attrName = attr.slice(22);
      attrsTranslationCtx = attrsTranslationCtx || {};
      attrsTranslationCtx[attrName] = value;
    } else if (attr !== "t-name") {
      if (attr.startsWith("t-") && !attr.startsWith("t-att")) {
        throw new OwlError(`Unknown QWeb directive: '${attr}'`);
      }
      const tModel = ctx.tModelInfo;
      if (tModel && ["t-att-value", "t-attf-value"].includes(attr)) {
        tModel.hasDynamicChildren = true;
      }
      attrs = attrs || {};
      attrs[attr] = value;
    }
  }
  if (ns) {
    ctx.nameSpace = ns;
  }

  const children = parseChildren(node, ctx);
  return {
    type: ASTType.DomNode,
    tag: tagName,
    dynamicTag,
    attrs,
    attrsTranslationCtx,
    on,
    ref,
    content: children,
    model,
    ns,
  };
}

// -----------------------------------------------------------------------------
// t-esc
// -----------------------------------------------------------------------------

function parseTEscNode(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-esc")) {
    return null;
  }
  const escValue = node.getAttribute("t-esc")!;
  node.removeAttribute("t-esc");
  const tesc: AST = {
    type: ASTType.TEsc,
    expr: escValue,
    defaultValue: node.textContent || "",
  };
  let ref = node.getAttribute("t-ref");
  node.removeAttribute("t-ref");
  const ast = parseNode(node, ctx);
  if (!ast) {
    return tesc;
  }
  if (ast.type === ASTType.DomNode) {
    return {
      ...ast,
      ref,
      content: [tesc],
    };
  }
  return tesc;
}

// -----------------------------------------------------------------------------
// t-out
// -----------------------------------------------------------------------------

function parseTOutNode(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-out") && !node.hasAttribute("t-raw")) {
    return null;
  }
  if (node.hasAttribute("t-raw")) {
    console.warn(
      `t-raw has been deprecated in favor of t-out. If the value to render is not wrapped by the "markup" function, it will be escaped`
    );
  }
  const expr = (node.getAttribute("t-out") || node.getAttribute("t-raw"))!;
  node.removeAttribute("t-out");
  node.removeAttribute("t-raw");

  const tOut: AST = { type: ASTType.TOut, expr, body: null };
  const ref = node.getAttribute("t-ref");
  node.removeAttribute("t-ref");
  const ast = parseNode(node, ctx);
  if (!ast) {
    return tOut;
  }
  if (ast.type === ASTType.DomNode) {
    tOut.body = ast.content.length ? ast.content : null;
    return {
      ...ast,
      ref,
      content: [tOut],
    };
  }

  return tOut;
}

// -----------------------------------------------------------------------------
// t-foreach and t-key
// -----------------------------------------------------------------------------

function parseTForEach(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-foreach")) {
    return null;
  }
  const html = node.outerHTML;
  const collection = node.getAttribute("t-foreach")!;
  node.removeAttribute("t-foreach");
  const elem = node.getAttribute("t-as") || "";
  node.removeAttribute("t-as");
  const key = node.getAttribute("t-key");
  if (!key) {
    throw new OwlError(
      `"Directive t-foreach should always be used with a t-key!" (expression: t-foreach="${collection}" t-as="${elem}")`
    );
  }
  node.removeAttribute("t-key");
  const memo = node.getAttribute("t-memo") || "";
  node.removeAttribute("t-memo");
  const body = parseNode(node, ctx);

  if (!body) {
    return null;
  }

  const hasNoTCall = !html.includes("t-call");
  const hasNoFirst = hasNoTCall && !html.includes(`${elem}_first`);
  const hasNoLast = hasNoTCall && !html.includes(`${elem}_last`);
  const hasNoIndex = hasNoTCall && !html.includes(`${elem}_index`);
  const hasNoValue = hasNoTCall && !html.includes(`${elem}_value`);

  return {
    type: ASTType.TForEach,
    collection,
    elem,
    body,
    memo,
    key,
    hasNoFirst,
    hasNoLast,
    hasNoIndex,
    hasNoValue,
  };
}

function parseTKey(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-key")) {
    return null;
  }
  const key = node.getAttribute("t-key")!;
  node.removeAttribute("t-key");
  const body = parseNode(node, ctx);
  if (!body) {
    return null;
  }
  return { type: ASTType.TKey, expr: key, content: body };
}

// -----------------------------------------------------------------------------
// t-call
// -----------------------------------------------------------------------------

function parseTCall(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-call")) {
    return null;
  }
  const subTemplate = node.getAttribute("t-call")!;
  const context = node.getAttribute("t-call-context");
  node.removeAttribute("t-call");
  node.removeAttribute("t-call-context");

  if (node.tagName !== "t") {
    const ast = parseNode(node, ctx);
    const tcall: AST = { type: ASTType.TCall, name: subTemplate, body: null, context };
    if (ast && ast.type === ASTType.DomNode) {
      ast.content = [tcall];
      return ast;
    }
    if (ast && ast.type === ASTType.TComponent) {
      return {
        ...ast,
        slots: {
          default: {
            content: tcall,
            scope: null,
            on: null,
            attrs: null,
            attrsTranslationCtx: null,
          },
        },
      };
    }
  }
  const body = parseChildren(node, ctx);

  return {
    type: ASTType.TCall,
    name: subTemplate,
    body: body.length ? body : null,
    context,
  };
}

// -----------------------------------------------------------------------------
// t-call-block
// -----------------------------------------------------------------------------

function parseTCallBlock(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-call-block")) {
    return null;
  }
  const name = node.getAttribute("t-call-block")!;
  return {
    type: ASTType.TCallBlock,
    name,
  };
}

// -----------------------------------------------------------------------------
// t-if
// -----------------------------------------------------------------------------

function parseTIf(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-if")) {
    return null;
  }
  const condition = node.getAttribute("t-if")!;
  node.removeAttribute("t-if");
  const content = parseNode(node, ctx) || { type: ASTType.Text, value: "" };

  let nextElement = node.nextElementSibling;
  // t-elifs
  const tElifs: any[] = [];
  while (nextElement && nextElement.hasAttribute("t-elif")) {
    const condition = nextElement.getAttribute("t-elif");
    nextElement.removeAttribute("t-elif");
    const tElif = parseNode(nextElement, ctx);
    const next = nextElement.nextElementSibling;
    nextElement.remove();
    nextElement = next;
    if (tElif) {
      tElifs.push({ condition, content: tElif });
    }
  }

  // t-else
  let tElse: AST | null = null;
  if (nextElement && nextElement.hasAttribute("t-else")) {
    nextElement.removeAttribute("t-else");
    tElse = parseNode(nextElement, ctx);
    nextElement.remove();
  }

  return {
    type: ASTType.TIf,
    condition,
    content,
    tElif: tElifs.length ? tElifs : null,
    tElse,
  };
}

// -----------------------------------------------------------------------------
// t-set directive
// -----------------------------------------------------------------------------

function parseTSetNode(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-set")) {
    return null;
  }
  const name = node.getAttribute("t-set")!;
  const value = node.getAttribute("t-value") || null;
  const defaultValue = node.innerHTML === node.textContent ? node.textContent || null : null;
  let body: AST[] | null = null;
  if (node.textContent !== node.innerHTML) {
    body = parseChildren(node, ctx);
  }
  return { type: ASTType.TSet, name, value, defaultValue, body };
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

// Error messages when trying to use an unsupported directive on a component
const directiveErrorMap = new Map([
  [
    "t-ref",
    "t-ref is no longer supported on components. Consider exposing only the public part of the component's API through a callback prop.",
  ],
  ["t-att", "t-att makes no sense on component: props are already treated as expressions"],
  [
    "t-attf",
    "t-attf is not supported on components: use template strings for string interpolation in props",
  ],
]);

function parseComponent(node: Element, ctx: ParsingContext): AST | null {
  let name = node.tagName;
  const firstLetter = name[0];
  let isDynamic = node.hasAttribute("t-component");

  if (isDynamic && name !== "t") {
    throw new OwlError(
      `Directive 't-component' can only be used on <t> nodes (used on a <${name}>)`
    );
  }

  if (!(firstLetter === firstLetter.toUpperCase() || isDynamic)) {
    return null;
  }
  if (isDynamic) {
    name = node.getAttribute("t-component")!;
    node.removeAttribute("t-component");
  }

  const dynamicProps = node.getAttribute("t-props");
  node.removeAttribute("t-props");

  const defaultSlotScope = node.getAttribute("t-slot-scope");
  node.removeAttribute("t-slot-scope");
  let on: ASTComponent["on"] = null;

  let props: ASTComponent["props"] = null;
  let propsTranslationCtx: ASTComponent["propsTranslationCtx"] = null;
  for (let name of node.getAttributeNames()) {
    const value = node.getAttribute(name)!;
    if (name.startsWith("t-translation-context-")) {
      const attrName = name.slice(22);
      propsTranslationCtx = propsTranslationCtx || {};
      propsTranslationCtx[attrName] = value;
    } else if (name.startsWith("t-")) {
      if (name.startsWith("t-on-")) {
        on = on || {};
        on[name.slice(5)] = value;
      } else {
        const message = directiveErrorMap.get(name.split("-").slice(0, 2).join("-"));
        throw new OwlError(message || `unsupported directive on Component: ${name}`);
      }
    } else {
      props = props || {};
      props[name] = value;
    }
  }

  let slots: ASTComponent["slots"] | null = null;
  if (node.hasChildNodes()) {
    const clone = <Element>node.cloneNode(true);

    // named slots
    const slotNodes = Array.from(clone.querySelectorAll("[t-set-slot]"));
    for (let slotNode of slotNodes) {
      if (slotNode.tagName !== "t") {
        throw new OwlError(
          `Directive 't-set-slot' can only be used on <t> nodes (used on a <${slotNode.tagName}>)`
        );
      }
      const name = slotNode.getAttribute("t-set-slot")!;

      // check if this is defined in a sub component (in which case it should
      // be ignored)
      let el = slotNode.parentElement!;
      let isInSubComponent = false;
      while (el && el !== clone) {
        if (el!.hasAttribute("t-component") || el!.tagName[0] === el!.tagName[0].toUpperCase()) {
          isInSubComponent = true;
          break;
        }
        el = el.parentElement!;
      }
      if (isInSubComponent || !el) {
        continue;
      }

      slotNode.removeAttribute("t-set-slot");
      slotNode.remove();
      const slotAst = parseNode(slotNode, ctx);
      let on: SlotDefinition["on"] = null;
      let attrs: Attrs | null = null;
      let attrsTranslationCtx: Attrs | null = null;
      let scope: string | null = null;
      for (let attributeName of slotNode.getAttributeNames()) {
        const value = slotNode.getAttribute(attributeName)!;
        if (attributeName === "t-slot-scope") {
          scope = value;
          continue;
        } else if (attributeName.startsWith("t-translation-context-")) {
          const attrName = attributeName.slice(22);
          attrsTranslationCtx = attrsTranslationCtx || {};
          attrsTranslationCtx[attrName] = value;
        } else if (attributeName.startsWith("t-on-")) {
          on = on || {};
          on[attributeName.slice(5)] = value;
        } else {
          attrs = attrs || {};
          attrs[attributeName] = value;
        }
      }
      slots = slots || {};
      slots[name] = { content: slotAst, on, attrs, attrsTranslationCtx, scope };
    }

    // default slot
    const defaultContent = parseChildNodes(clone, ctx);
    slots = slots || {};
    // t-set-slot="default" has priority over content
    if (defaultContent && !slots.default) {
      slots.default = {
        content: defaultContent,
        on,
        attrs: null,
        attrsTranslationCtx: null,
        scope: defaultSlotScope,
      };
    }
  }
  return {
    type: ASTType.TComponent,
    name,
    isDynamic,
    dynamicProps,
    props,
    propsTranslationCtx,
    slots,
    on,
  };
}

// -----------------------------------------------------------------------------
// Slots
// -----------------------------------------------------------------------------

function parseTSlot(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-slot")) {
    return null;
  }
  const name = node.getAttribute("t-slot")!;
  node.removeAttribute("t-slot");
  let attrs: Attrs | null = null;
  let attrsTranslationCtx: Attrs | null = null;
  let on: ASTComponent["on"] = null;
  for (let attributeName of node.getAttributeNames()) {
    const value = node.getAttribute(attributeName)!;
    if (attributeName.startsWith("t-on-")) {
      on = on || {};
      on[attributeName.slice(5)] = value;
    } else if (attributeName.startsWith("t-translation-context-")) {
      const attrName = attributeName.slice(22);
      attrsTranslationCtx = attrsTranslationCtx || {};
      attrsTranslationCtx[attrName] = value;
    } else {
      attrs = attrs || {};
      attrs[attributeName] = value;
    }
  }
  return {
    type: ASTType.TSlot,
    name,
    attrs,
    attrsTranslationCtx,
    on,
    defaultContent: parseChildNodes(node, ctx),
  };
}

// -----------------------------------------------------------------------------
// Translation
// -----------------------------------------------------------------------------

function parseTTranslation(node: Element, ctx: ParsingContext): AST | null {
  if (node.getAttribute("t-translation") !== "off") {
    return null;
  }
  node.removeAttribute("t-translation");
  return {
    type: ASTType.TTranslation,
    content: parseNode(node, ctx),
  };
}

// -----------------------------------------------------------------------------
// Translation Context
// -----------------------------------------------------------------------------

function parseTTranslationContext(node: Element, ctx: ParsingContext): AST | null {
  const translationCtx = node.getAttribute("t-translation-context");
  if (!translationCtx) {
    return null;
  }
  node.removeAttribute("t-translation-context");
  return {
    type: ASTType.TTranslationContext,
    content: parseNode(node, ctx),
    translationCtx,
  };
}

// -----------------------------------------------------------------------------
// Portal
// -----------------------------------------------------------------------------

function parseTPortal(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-portal")) {
    return null;
  }
  const target = node.getAttribute("t-portal")!;
  node.removeAttribute("t-portal");
  const content = parseNode(node, ctx);
  if (!content) {
    return {
      type: ASTType.Text,
      value: "",
    };
  }
  return {
    type: ASTType.TPortal,
    target,
    content,
  };
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

/**
 * Parse all the child nodes of a given node and return a list of ast elements
 */
function parseChildren(node: Element, ctx: ParsingContext): AST[] {
  const children: AST[] = [];
  for (let child of node.childNodes) {
    const childAst = parseNode(child, ctx);
    if (childAst) {
      if (childAst.type === ASTType.Multi) {
        children.push(...childAst.content);
      } else {
        children.push(childAst);
      }
    }
  }
  return children;
}

/**
 * Parse all the child nodes of a given node and return an ast if possible.
 * In the case there are multiple children, they are wrapped in a astmulti.
 */
function parseChildNodes(node: Element, ctx: ParsingContext): AST | null {
  const children = parseChildren(node, ctx);
  switch (children.length) {
    case 0:
      return null;
    case 1:
      return children[0];
    default:
      return { type: ASTType.Multi, content: children };
  }
}

/**
 * Normalizes the content of an Element so that t-if/t-elif/t-else directives
 * immediately follow one another (by removing empty text nodes or comments).
 * Throws an error when a conditional branching statement is malformed. This
 * function modifies the Element in place.
 *
 * @param el the element containing the tree that should be normalized
 */
function normalizeTIf(el: Element) {
  let tbranch = el.querySelectorAll("[t-elif], [t-else]");
  for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
    let node = tbranch[i];
    let prevElem = node.previousElementSibling!;
    let pattr = (name: string) => prevElem.getAttribute(name);
    let nattr = (name: string) => +!!node.getAttribute(name);
    if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
      if (pattr("t-foreach")) {
        throw new OwlError(
          "t-if cannot stay at the same level as t-foreach when using t-elif or t-else"
        );
      }
      if (
        ["t-if", "t-elif", "t-else"].map(nattr).reduce(function (a, b) {
          return a + b;
        }) > 1
      ) {
        throw new OwlError("Only one conditional branching directive is allowed per node");
      }
      // All text (with only spaces) and comment nodes (nodeType 8) between
      // branch nodes are removed
      let textNode;
      while ((textNode = node.previousSibling) !== prevElem) {
        if (textNode!.nodeValue!.trim().length && textNode!.nodeType !== 8) {
          throw new OwlError("text is not allowed between branching directives");
        }
        textNode!.remove();
      }
    } else {
      throw new OwlError(
        "t-elif and t-else directives must be preceded by a t-if or t-elif directive"
      );
    }
  }
}

/**
 * Normalizes the content of an Element so that t-esc directives on components
 * are removed and instead places a <t t-esc=""> as the default slot of the
 * component. Also throws if the component already has content. This function
 * modifies the Element in place.
 *
 * @param el the element containing the tree that should be normalized
 */
function normalizeTEscTOut(el: Element) {
  for (const d of ["t-esc", "t-out"]) {
    const elements = [...el.querySelectorAll(`[${d}]`)].filter(
      (el) => el.tagName[0] === el.tagName[0].toUpperCase() || el.hasAttribute("t-component")
    );
    for (const el of elements) {
      if (el.childNodes.length) {
        throw new OwlError(`Cannot have ${d} on a component that already has content`);
      }
      const value = el.getAttribute(d);
      el.removeAttribute(d);
      const t = el.ownerDocument.createElement("t");
      if (value != null) {
        t.setAttribute(d, value);
      }
      el.appendChild(t);
    }
  }
}

/**
 * Normalizes the tree inside a given element and do some preliminary validation
 * on it. This function modifies the Element in place.
 *
 * @param el the element containing the tree that should be normalized
 */
function normalizeXML(el: Element) {
  normalizeTIf(el);
  normalizeTEscTOut(el);
}
