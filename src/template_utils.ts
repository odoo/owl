// import type { BDom } from "./bdom";
// import { BDispatch } from "./bdom/b_dispatch";
// import { BMulti } from "./bdom/b_multi";

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

// function setText(el: Text, prevValue: any, value: any) {
//   if (prevValue === value) {
//     return;
//   }
//   let str: string;
//   switch (typeof value) {
//     case "string":
//       str = value;
//       break;
//     case "number":
//       str = String(value);
//       break;
//     case "boolean":
//       str = value ? "true" : "false";
//       break;
//     case "object":
//       str = value ? value.toString() : "";
//       break;
//     default:
//       // most notably, undefined
//       str = "";
//       break;
//   }
//   el.textContent = str;
// }

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

// function callSlot(
//   ctx: any,
//   parent: any,
//   key: string,
//   name: string,
//   defaultSlot?: (ctx: any, key: string) => Block,
//   dynamic?: boolean
// ): Block | null {
//   const slots = ctx.__owl__.slots;
//   const slotFn = slots[name];
//   const slotBDom = slotFn ? slotFn(parent, key) : null;
//   if (defaultSlot) {
//     const result = new BMulti(2);
//     if (slotBDom) {
//       result.children[0] = dynamic ? new BDispatch(name, slotBDom) : slotBDom;
//     } else {
//       result.children[1] = defaultSlot(parent, key);
//     }
//     return result;
//   }
//   return slotBDom;
// }

function capture(ctx: any): any {
  const component = ctx.__owl__.component;
  const result = Object.create(component);
  for (let k in ctx) {
    result[k] = ctx[k];
  }
  return result;
}

function withKey(elem: any, k: string) {
  elem.key = k;
  return elem;
}

function prepareList(collection: any): [any[], any[], number, any[]] {
  let keys: any[];
  let values: any[];

  if (Array.isArray(collection)) {
    keys = collection;
    values = collection;
  } else if (collection) {
    values = Object.keys(collection);
    keys = Object.values(collection);
  } else {
    throw new Error("Invalid loop expression");
  }
  const n = values.length;
  return [keys, values, n, new Array(n)];
}
export const UTILS = {
  elem,
  // setText,
  withDefault,
  zero: Symbol("zero"),
  // callSlot,
  capture,
  // toClassObj,
  withKey,
  prepareList,
};
