import type { Block } from "./bdom";
import { BDispatch } from "./bdom/b_dispatch";
import { BMulti } from "./bdom/b_multi";

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

function setText(el: Text, prevValue: any, value: any) {
  if (prevValue === value) {
    return;
  }
  let str: string;
  switch (typeof value) {
    case "string":
      str = value;
      break;
    case "number":
      str = String(value);
      break;
    case "boolean":
      str = value ? "true" : "false";
      break;
    case "object":
      str = value ? value.toString() : "";
      break;
    default:
      // most notably, undefined
      str = "";
      break;
  }
  el.textContent = str;
}

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

function callSlot(
  ctx: any,
  parent: any,
  key: string,
  name: string,
  defaultSlot?: (ctx: any, key: string) => Block,
  dynamic?: boolean
): Block | null {
  const slots = ctx.__owl__.slots;
  const slotFn = slots[name];
  const slotBDom = slotFn ? slotFn(parent, key) : null;
  if (defaultSlot) {
    const result = new BMulti(2);
    if (slotBDom) {
      result.children[0] = dynamic ? new BDispatch(name, slotBDom) : slotBDom;
    } else {
      result.children[1] = defaultSlot(parent, key);
    }
    return result;
  }
  return slotBDom;
}

function capture(ctx: any): any {
  const component = ctx.__owl__.component;
  const result = Object.create(component);
  for (let k in ctx) {
    result[k] = ctx[k];
  }
  return result;
}

export function toClassObj(expr: string | number | { [c: string]: any }, expr2?: any) {
  const result: { [c: string]: any } = expr2 ? toClassObj(expr2) : {};

  if (typeof expr === "object") {
    // this is already an object but we may need to split keys:
    // {'a': true, 'b c': true} should become {a: true, b: true, c: true}
    for (let key in expr) {
      const value = expr[key];
      if (value) {
        const words = key.split(/\s+/);
        for (let word of words) {
          result[word] = value;
        }
      }
    }
    return result;
  }
  if (typeof expr !== "string") {
    expr = String(expr);
  }
  // we transform here a list of classes into an object:
  //  'hey you' becomes {hey: true, you: true}
  const str = expr.trim();
  if (!str) {
    return {};
  }
  let words = str.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    result[words[i]] = true;
  }
  return result;
}

export const UTILS = {
  elem,
  setText,
  withDefault,
  zero: Symbol("zero"),
  callSlot,
  capture,
  toClassObj,
};
