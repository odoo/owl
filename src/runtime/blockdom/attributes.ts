import type { Setter } from "./block_compiler";

let elemSetAttribute: typeof Element.prototype.setAttribute;
let removeAttribute: typeof Element.prototype.removeAttribute;
let tokenListAdd: typeof DOMTokenList.prototype.add;
let tokenListRemove: typeof DOMTokenList.prototype.remove;
if (typeof Element !== "undefined") {
  ({ setAttribute: elemSetAttribute, removeAttribute } = Element.prototype);
  const tokenList = DOMTokenList.prototype;
  tokenListAdd = tokenList.add;
  tokenListRemove = tokenList.remove;
}
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
    if (attrs[0] === "class") {
      setClass.call(this, attrs[1]);
    } else if (attrs[0] === "style") {
      setStyle.call(this, attrs[1]);
    } else {
      setAttribute.call(this, attrs[0], attrs[1]);
    }
  } else {
    for (let k in attrs) {
      if (k === "class") {
        setClass.call(this, attrs[k]);
      } else if (k === "style") {
        setStyle.call(this, attrs[k]);
      } else {
        setAttribute.call(this, k, attrs[k]);
      }
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
      if (name === "class") {
        updateClass.call(this, val, oldAttrs[1]);
      } else if (name === "style") {
        updateStyle.call(this, val, oldAttrs[1]);
      } else {
        setAttribute.call(this, name, val);
      }
    } else {
      removeAttribute.call(this, oldAttrs[0]);
      setAttribute.call(this, name, val);
    }
  } else {
    for (let k in oldAttrs) {
      if (!(k in attrs)) {
        if (k === "class") {
          updateClass.call(this, "", oldAttrs[k]);
        } else if (k === "style") {
          updateStyle.call(this, "", oldAttrs[k]);
        } else {
          removeAttribute.call(this, k);
        }
      }
    }
    for (let k in attrs) {
      const val = attrs[k];
      if (val !== oldAttrs[k]) {
        if (k === "class") {
          updateClass.call(this, val, oldAttrs[k]);
        } else if (k === "style") {
          updateStyle.call(this, val, oldAttrs[k]);
        } else {
          setAttribute.call(this, k, val);
        }
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
          key = trim.call(key);
          if (!key) {
            continue;
          }
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

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------

const CSS_PROP_CACHE: { [key: string]: string } = {};

function toKebabCase(prop: string): string {
  if (prop in CSS_PROP_CACHE) {
    return CSS_PROP_CACHE[prop];
  }
  const result = prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
  CSS_PROP_CACHE[prop] = result;
  return result;
}

function toStyleObj(expr: string | { [prop: string]: any }): { [prop: string]: string } {
  const result: { [prop: string]: string } = {};
  switch (typeof expr) {
    case "string": {
      const str = trim.call(expr);
      if (!str) {
        return {};
      }
      const parts = str.split(";");
      for (let part of parts) {
        part = trim.call(part);
        if (!part) {
          continue;
        }
        const colonIdx = part.indexOf(":");
        if (colonIdx === -1) {
          continue;
        }
        const prop = trim.call(part.slice(0, colonIdx));
        const value = trim.call(part.slice(colonIdx + 1));
        if (prop && value) {
          result[prop] = value;
        }
      }
      return result;
    }
    case "object":
      for (let prop in expr as any) {
        const value = (expr as any)[prop];
        if (value || value === 0) {
          result[toKebabCase(prop)] = String(value);
        }
      }
      return result;
    default:
      return {};
  }
}

export function setStyle(this: HTMLElement, val: any) {
  val = val === "" ? {} : toStyleObj(val);
  const style = this.style;
  for (let prop in val) {
    style.setProperty(prop, val[prop]);
  }
}

export function updateStyle(this: HTMLElement, val: any, oldVal: any) {
  oldVal = oldVal === "" ? {} : toStyleObj(oldVal);
  val = val === "" ? {} : toStyleObj(val);
  const style = this.style;
  // remove old styles
  for (let prop in oldVal) {
    if (!(prop in val)) {
      style.removeProperty(prop);
    }
  }
  // set new/changed styles
  for (let prop in val) {
    if (val[prop] !== oldVal[prop]) {
      style.setProperty(prop, val[prop]);
    }
  }
}
