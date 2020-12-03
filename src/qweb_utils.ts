import { BDom, BMulti } from "./bdom";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function toDom(node: ChildNode): HTMLElement | Text | Comment {
  switch (node.nodeType) {
    case 1: {
      // HTMLElement
      const tagName = (node as Element).tagName;
      if (tagName === "owl-text" || tagName === "owl-anchor") {
        return document.createTextNode("");
      }
      const result = document.createElement((node as Element).tagName);
      const attrs = (node as Element).attributes;
      for (let i = 0; i < attrs.length; i++) {
        result.setAttribute(attrs[i].name, attrs[i].value);
      }
      for (let child of (node as Element).childNodes) {
        result.appendChild(toDom(child));
      }
      return result;
    }
    case 3: {
      // text node
      return document.createTextNode(node.textContent!);
    }
    case 8: {
      // comment node
      return document.createComment(node.textContent!);
    }
  }
  throw new Error("boom");
}

function elem(html: string): HTMLElement | Text | Comment {
  const doc = new DOMParser().parseFromString(html, "text/xml");
  return toDom(doc.firstChild!);
}

function toString(value: any): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return String(value);
    case "boolean":
      return value ? "true" : "false";
    case "undefined":
      return "";
    case "object":
      return value ? value.toString() : "";
  }
  throw new Error("not yet working" + value);
}

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

function call(name: string): BDom {
  throw new Error(`Missing template: "${name}"`);
}

function getValues(collection: any): [any[], any[], number] {
  if (Array.isArray(collection)) {
    return [collection, collection, collection.length];
  } else if (collection) {
    const keys = Object.keys(collection);
    return [keys, Object.values(collection), keys.length];
  }
  throw new Error("Invalid loop expression");
}

const scope = Symbol("scope");

export const UTILS = {
  elem,
  toString,
  withDefault,
  call,
  zero: Symbol("zero"),
  scope,
  getValues,
  owner,
  callSlot,
};

export const enum DomType {
  Text,
  Comment,
  Node,
}

export interface DomText {
  type: DomType.Text;
  value: string;
}

export interface DomComment {
  type: DomType.Comment;
  value: string;
}
export interface DomNode {
  type: DomType.Node;
  tag: string;
  attrs: { [key: string]: string };
  content: Dom[];
}

export type Dom = DomText | DomComment | DomNode;

export function domToString(dom: Dom): string {
  switch (dom.type) {
    case DomType.Text:
      return dom.value;
    case DomType.Comment:
      return `<!--${dom.value}-->`;
    case DomType.Node:
      const content = dom.content.map(domToString).join("");
      const attrs: string[] = [];
      for (let [key, value] of Object.entries(dom.attrs)) {
        if (!(key === "class" && value === "")) {
          attrs.push(`${key}="${value}"`);
        }
      }
      if (content) {
        return `<${dom.tag}${attrs.length ? " " + attrs.join(" ") : ""}>${content}</${dom.tag}>`;
      } else {
        return `<${dom.tag}${attrs.length ? " " + attrs.join(" ") : ""}/>`;
      }
  }
}

export function owner(obj: any): any | null {
  while (obj && obj[scope]) {
    obj = obj.__proto__;
  }
  return obj;
}

export function callSlot(ctx: any, name: string, def?: (ctx: any) => BDom): BDom | null {
  const slots = ctx.__owl__.slots;
  const slotBDom = slots ? slots[name]() : null;
  if (def) {
    const result = new BMulti(2);
    if (slotBDom) {
      result.children[0] = slotBDom;
    } else {
      result.children[1] = def(ctx);
    }
    return result;
  }
  return slotBDom;
}
