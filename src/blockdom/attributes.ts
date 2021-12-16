import type { Setter } from "./block_compiler";

const { setAttribute: elemSetAttribute, removeAttribute } = Element.prototype;
const tokenList = DOMTokenList.prototype;
const tokenListAdd = tokenList.add;
const tokenListRemove = tokenList.remove;
const isArray = Array.isArray;
const { split, trim } = String.prototype;
const wordRegexp = /\s+/;

/**
 * We regroup here all code related to updating attributes in a very loose sense:
 * attributes, properties and classs are all managed by the functions in this
 * file.
 */

function setAttribute(this: HTMLElement, key: string, value: any) {
  switch (value) {
    case false:
    case undefined:
      removeAttribute.call(this, key);
      break;
    case true:
      elemSetAttribute.call(this, key, "");
      break;
    default:
      elemSetAttribute.call(this, key, value);
  }
}

export function createAttrUpdater(attr: string): Setter<HTMLElement> {
  return function (this: HTMLElement, value: any) {
    setAttribute.call(this, attr, value);
  };
}

export function attrsSetter(this: HTMLElement, attrs: any) {
  if (isArray(attrs)) {
    setAttribute.call(this, attrs[0], attrs[1]);
  } else {
    for (let k in attrs) {
      setAttribute.call(this, k, attrs[k]);
    }
  }
}

export function attrsUpdater(this: HTMLElement, attrs: any, oldAttrs: any) {
  if (isArray(attrs)) {
    const name = attrs[0];
    const val = attrs[1];
    if (name === oldAttrs[0]) {
      if (val === oldAttrs[1]) {
        return;
      }
      setAttribute.call(this, name, val);
    } else {
      removeAttribute.call(this, oldAttrs[0]);
      setAttribute.call(this, name, val);
    }
  } else {
    for (let k in oldAttrs) {
      if (!(k in attrs)) {
        removeAttribute.call(this, k);
      }
    }
    for (let k in attrs) {
      const val = attrs[k];
      if (val !== oldAttrs[k]) {
        setAttribute.call(this, k, val);
      }
    }
  }
}

function toClassObj(expr: string | number | { [c: string]: any }) {
  const result: { [c: string]: any } = {};
  switch (typeof expr) {
    case "string":
      // we transform here a list of classes into an object:
      //  'hey you' becomes {hey: true, you: true}
      const str = trim.call(expr);
      if (!str) {
        return {};
      }
      let words = split.call(str, wordRegexp);
      for (let i = 0, l = words.length; i < l; i++) {
        result[words[i]] = true;
      }
      return result;
    case "object":
      // this is already an object but we may need to split keys:
      // {'a': true, 'b c': true} should become {a: true, b: true, c: true}
      for (let key in expr as any) {
        const value = (expr as any)[key];
        if (value) {
          const words = split.call(key, wordRegexp);
          for (let word of words) {
            result[word] = value;
          }
        }
      }
      return result;

    case "undefined":
      return {};
    case "number":
      return { [expr as number]: true };
    default:
      return { [expr as any]: true };
  }
}

export function setClass(this: HTMLElement, val: any) {
  val = val === "" ? {} : toClassObj(val);
  // add classes
  const cl = this.classList;
  for (let c in val) {
    tokenListAdd.call(cl, c);
  }
}

export function updateClass(this: HTMLElement, val: any, oldVal: any) {
  oldVal = oldVal === "" ? {} : toClassObj(oldVal);
  val = val === "" ? {} : toClassObj(val);
  const cl = this.classList;
  // remove classes
  for (let c in oldVal) {
    if (!(c in val)) {
      tokenListRemove.call(cl, c);
    }
  }
  // add classes
  for (let c in val) {
    if (!(c in oldVal)) {
      tokenListAdd.call(cl, c);
    }
  }
}

export function makePropSetter(name: string): Setter<HTMLElement> {
  return function setProp(this: HTMLElement, value: any) {
    (this as any)[name] = value;
  };
}

export function isProp(tag: string, key: string): boolean {
  switch (tag) {
    case "input":
      return (
        key === "checked" ||
        key === "indeterminate" ||
        key === "value" ||
        key === "readonly" ||
        key === "disabled"
      );
    case "option":
      return key === "selected" || key === "disabled";
    case "textarea":
      return key === "value" || key === "readonly" || key === "disabled";
    case "select":
      return key === "value" || key === "disabled";
    case "button":
    case "optgroup":
      return key === "disabled";
  }
  return false;
}
