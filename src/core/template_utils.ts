import { Block, Blocks } from "../bdom";
import { BDispatch } from "../bdom/block_dispatch";

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

function callSlot(
  ctx: any,
  name: string,
  defaultSlot?: (ctx: any) => Block,
  dynamic?: boolean
): Block | null {
  const slots = ctx.__owl__.slots;
  const slotFn = slots[name];
  const slotBDom = slotFn ? slotFn(ctx) : null;
  if (defaultSlot) {
    const result = new BMulti(2);
    if (slotBDom) {
      result.children[0] = dynamic ? new BDispatch(name, slotBDom) : slotBDom;
    } else {
      result.children[1] = defaultSlot(ctx);
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
  return Object.create(result);
}

export const UTILS = {
  elem,
  toString,
  withDefault,
  call: (name: string) => {
    throw new Error(`Missing template: ${name}`);
  },
  zero: Symbol("zero"),
  callSlot,
  capture,
};
