import { Block, Blocks } from "../bdom";

const { BMulti } = Blocks;

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

export function elem(html: string): HTMLElement | Text | Comment {
  const doc = new DOMParser().parseFromString(html, "text/xml");
  return toDom(doc.firstChild!);
}

export function toString(value: any): string {
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

export function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

export const scope = Symbol("scope");

export function owner(obj: any): any | null {
  while (obj && obj[scope]) {
    obj = obj.__proto__;
  }
  return obj;
}

export function callSlot(ctx: any, name: string, def?: (ctx: any) => Block): Block | null {
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
