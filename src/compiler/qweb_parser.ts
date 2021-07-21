// -----------------------------------------------------------------------------
// AST Type definition
// -----------------------------------------------------------------------------

export const enum ASTType {
  Text,
  Comment,
  DomNode,
  Multi,
  TEsc,
  TIf,
  TSet,
  TCall,
  TRaw,
  TForEach,
  TKey,
  TComponent,
  TDebug,
  TLog,
  TSlot,
  TCallBlock,
}

export interface ASTText {
  type: ASTType.Text;
  value: string;
}

export interface ASTComment {
  type: ASTType.Comment;
  value: string;
}

export interface ASTDomNode {
  type: ASTType.DomNode;
  tag: string;
  attrs: { [key: string]: string };
  content: AST[];
  ref: string | null;
  on: { [key: string]: string };
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

export interface ASTTRaw {
  type: ASTType.TRaw;
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
  key: string | null;
  body: AST;
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
}

export interface ASTComponent {
  type: ASTType.TComponent;
  name: string;
  isDynamic: boolean;
  props: { [name: string]: string };
  handlers: { [event: string]: string };
  slots: { [name: string]: AST };
}

export interface ASTSlot {
  type: ASTType.TSlot;
  name: string;
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

export type AST =
  | ASTText
  | ASTComment
  | ASTDomNode
  | ASTMulti
  | ASTTEsc
  | ASTTif
  | ASTTSet
  | ASTTCall
  | ASTTRaw
  | ASTTForEach
  | ASTTKey
  | ASTComponent
  | ASTSlot
  | ASTTCallBlock
  | ASTLog
  | ASTDebug;

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------
interface ParsingContext {
  inPreTag: boolean;
}

export function parse(xml: string): AST {
  const template = `<t>${xml}</t>`;
  const doc = parseXML(template);
  const ctx = { inPreTag: false };
  const ast = parseNode(doc.firstChild!, ctx);
  if (!ast) {
    return { type: ASTType.Text, value: "" };
  }
  return ast;
}

function parseNode(node: ChildNode, ctx: ParsingContext): AST | null {
  if (!(node instanceof Element)) {
    return parseTextCommentNode(node, ctx);
  }
  return (
    parseTDebugLog(node, ctx) ||
    parseTForEach(node, ctx) ||
    parseTIf(node, ctx) ||
    parseTCall(node, ctx) ||
    parseTCallBlock(node, ctx) ||
    parseTEscNode(node, ctx) ||
    parseTKey(node, ctx) ||
    parseTSlot(node, ctx) ||
    parseTRawNode(node, ctx) ||
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
  const children: AST[] = [];
  for (let child of node.childNodes) {
    const ast = parseNode(child, ctx);
    if (ast) {
      children.push(ast);
    }
  }
  switch (children.length) {
    case 0:
      return null;
    case 1:
      return children[0];
    default:
      return {
        type: ASTType.Multi,
        content: children,
      };
  }
}

// -----------------------------------------------------------------------------
// Text and Comment Nodes
// -----------------------------------------------------------------------------
const lineBreakRE = /[\r\n]/;
const whitespaceRE = /\s+/g;

function parseTextCommentNode(node: ChildNode, ctx: ParsingContext): AST | null {
  if (node.nodeType === 3) {
    let value = node.textContent || "";
    if (!ctx.inPreTag) {
      if (lineBreakRE.test(value) && !value.trim()) {
        return null;
      }
      value = value.replace(whitespaceRE, " ");
    }

    return { type: ASTType.Text, value };
  } else if (node.nodeType === 8) {
    return { type: ASTType.Comment, value: node.textContent || "" };
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

function parseDOMNode(node: Element, ctx: ParsingContext): AST | null {
  if (node.tagName === "t") {
    return null;
  }
  const children: AST[] = [];
  if (node.tagName === "pre") {
    ctx = { inPreTag: true };
  }
  let ref = null;
  if (node.hasAttribute("t-ref")) {
    ref = node.getAttribute("t-ref");
    node.removeAttribute("t-ref");
  }

  for (let child of node.childNodes) {
    const ast = parseNode(child, ctx);
    if (ast) {
      children.push(ast);
    }
  }

  const attrs: ASTDomNode["attrs"] = {};
  const on: ASTDomNode["on"] = {};

  for (let attr of node.getAttributeNames()) {
    const value = node.getAttribute(attr)!;
    if (attr.startsWith("t-on")) {
      if (attr === "t-on") {
        throw new Error("Missing event name with t-on directive");
      }
      on[attr.slice(5)] = value;
    } else {
      if (attr.startsWith("t-") && !attr.startsWith("t-att")) {
        throw new Error(`Unknown QWeb directive: '${attr}'`);
      }
      attrs[attr] = value;
    }
  }
  return {
    type: ASTType.DomNode,
    tag: node.tagName,
    attrs,
    on,
    ref,
    content: children,
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
  if (ast && ast.type === ASTType.DomNode) {
    return {
      type: ASTType.DomNode,
      tag: ast.tag,
      attrs: ast.attrs,
      on: ast.on,
      ref,
      content: [tesc],
    };
  }
  if (ast && ast.type === ASTType.TComponent) {
    return {
      ...ast,
      slots: { default: tesc },
    };
  }
  return tesc;
}

// -----------------------------------------------------------------------------
// t-raw
// -----------------------------------------------------------------------------

function parseTRawNode(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-raw")) {
    return null;
  }
  const expr = node.getAttribute("t-raw")!;
  node.removeAttribute("t-raw");

  const tRaw: AST = { type: ASTType.TRaw, expr, body: null };
  const ref = node.getAttribute("t-ref");
  node.removeAttribute("t-ref");
  const ast = parseNode(node, ctx);
  if (!ast) {
    return tRaw;
  }
  if (ast && ast.type === ASTType.DomNode) {
    tRaw.body = ast.content.length ? ast.content : null;
    return {
      type: ASTType.DomNode,
      tag: ast.tag,
      attrs: ast.attrs,
      on: ast.on,
      ref,
      content: [tRaw],
    };
  }

  return tRaw;
}

// -----------------------------------------------------------------------------
// t-foreach and t-key
// -----------------------------------------------------------------------------

function parseTForEach(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-foreach")) {
    return null;
  }
  const collection = node.getAttribute("t-foreach")!;
  node.removeAttribute("t-foreach");
  const elem = node.getAttribute("t-as") || "";
  node.removeAttribute("t-as");
  const key = node.getAttribute("t-key");
  node.removeAttribute("t-key");
  const body = parseNode(node, ctx);

  if (!body) {
    return null;
  }
  return {
    type: ASTType.TForEach,
    collection,
    elem,
    body,
    key,
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

  node.removeAttribute("t-call");
  if (node.tagName !== "t") {
    const ast = parseNode(node, ctx);
    const tcall: AST = { type: ASTType.TCall, name: subTemplate, body: null };
    if (ast && ast.type === ASTType.DomNode) {
      ast.content = [tcall];
      return ast;
    }
    if (ast && ast.type === ASTType.TComponent) {
      return {
        ...ast,
        slots: { default: tcall },
      };
    }
  }
  const body: AST[] = [];
  for (let child of node.childNodes) {
    const ast = parseNode(child, ctx);
    if (ast) {
      body.push(ast);
    }
  }

  return {
    type: ASTType.TCall,
    name: subTemplate,
    body: body.length ? body : null,
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
  const content = parseNode(node, ctx);
  if (!content) {
    throw new Error("hmmm");
  }

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
    body = [];
    for (let child of node.childNodes) {
      let childAst = parseNode(child, ctx);
      if (childAst) {
        body.push(childAst);
      }
    }
  }
  return { type: ASTType.TSet, name, value, defaultValue, body };
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function parseComponent(node: Element, ctx: ParsingContext): AST | null {
  let name = node.tagName;
  const firstLetter = name[0];
  let isDynamic = node.hasAttribute("t-component");

  if (!(firstLetter === firstLetter.toUpperCase() || isDynamic)) {
    return null;
  }
  if (isDynamic) {
    name = node.getAttribute("t-component")!;
    node.removeAttribute("t-component");
  }

  const props: ASTComponent["props"] = {};
  const handlers: ASTComponent["handlers"] = {};
  for (let name of node.getAttributeNames()) {
    const value = node.getAttribute(name)!;
    if (name.startsWith("t-on-")) {
      handlers[name.slice(5)] = value;
    } else {
      props[name] = value;
    }
  }

  const slots: ASTComponent["slots"] = {};
  if (node.hasChildNodes()) {
    const clone = <Element>node.cloneNode(true);

    // named slots
    const slotNodes = Array.from(clone.querySelectorAll("[t-set-slot]"));
    for (let slotNode of slotNodes) {
      const name = slotNode.getAttribute("t-set-slot")!;
      slotNode.removeAttribute("t-set-slot");
      slotNode.remove();
      const slotAst = parseNode(slotNode, ctx);
      if (slotAst) {
        slots[name] = slotAst;
      }
    }

    // default slot
    const defaultContent = parseChildNodes(clone, ctx);
    if (defaultContent) {
      slots.default = defaultContent;
    }
  }
  return { type: ASTType.TComponent, name, isDynamic, props, handlers, slots };
}

// -----------------------------------------------------------------------------
// Slots
// -----------------------------------------------------------------------------

function parseTSlot(node: Element, ctx: ParsingContext): AST | null {
  if (!node.hasAttribute("t-slot")) {
    return null;
  }
  return {
    type: ASTType.TSlot,
    name: node.getAttribute("t-slot")!,
    defaultContent: parseChildNodes(node, ctx),
  };
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function parseChildNodes(node: Element, ctx: ParsingContext): AST | null {
  const children: AST[] = [];
  for (let child of node.childNodes) {
    const childAst = parseNode(child, ctx);
    if (childAst) {
      children.push(childAst);
    }
  }
  switch (children.length) {
    case 0:
      return null;
    case 1:
      return children[0];
    default:
      return { type: ASTType.Multi, content: children };
  }
}
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
  let tbranch = doc.querySelectorAll("[t-elif], [t-else]");
  for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
    let node = tbranch[i];
    let prevElem = node.previousElementSibling!;
    let pattr = (name: string) => prevElem.getAttribute(name);
    let nattr = (name: string) => +!!node.getAttribute(name);
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
        if (textNode!.nodeValue!.trim().length && textNode!.nodeType !== 8) {
          throw new Error("text is not allowed between branching directives");
        }
        textNode!.remove();
      }
    } else {
      throw new Error(
        "t-elif and t-else directives must be preceded by a t-if or t-elif directive"
      );
    }
  }

  return doc;
}
