export function escape(str: string | number | undefined): string {
  if (str === undefined) {
    return "";
  }
  if (typeof str === "number") {
    return String(str);
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&#x27;")
    .replace(/`/g, "&#x60;");
}

/**
 * Remove trailing and leading spaces
 */
export function htmlTrim(s: string): string {
  let result = s.replace(/(^\s+|\s+$)/g, "");
  if (s[0] === " ") {
    result = " " + result;
  }
  if (result !== " " && s[s.length - 1] === " ") {
    result = result + " ";
  }
  return result;
}

export type HashFn = (args: any[]) => string;

export function memoize<R, T extends (...args: any[]) => R>(
  f: T,
  hash?: HashFn
): T {
  if (!hash) {
    hash = args => args.map(a => String(a)).join(",");
  }
  let cache: { [key: string]: R } = {};
  function memoizedFunction(...args: any[]) {
    let hashValue = hash!(args);
    if (!(hashValue in cache)) {
      cache[hashValue] = f(...args);
    }
    return cache[hashValue];
  }
  return memoizedFunction as T;
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * Inspired by https://davidwalsh.name/javascript-debounce-function
 */
export function debounce(
  func: Function,
  wait: number,
  immediate?: boolean
): Function {
  let timeout;
  return function(this: any) {
    const context = this;
    const args = arguments;
    function later() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    }
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}

interface Tree<T> {
  children: T[];
}

/**
 * Find a node in a tree.
 *
 * This will traverse the tree (depth first) and return the first child that
 * matches the predicate, if any
 */
export function findInTree<T extends Tree<T>>(
  tree: T,
  predicate: (t: T) => boolean
): T | null {
  if (predicate(tree)) {
    return tree;
  }
  for (let child of tree.children) {
    let match = findInTree(child, predicate);
    if (match) {
      return match;
    }
  }
  return null;
}

export function patch(C: any, patchName: string, patch: any) {
  const proto = C.prototype;
  if (!proto.__patches) {
    proto.__patches = {
      origMethods: {},
      patches: {},
      current: []
    };
  }
  if (proto.__patches.patches[patchName]) {
    throw new Error(`Patch [${patchName}] already exists`);
  }
  proto.__patches.patches[patchName] = patch;
  applyPatch(proto, patch);
  proto.__patches.current.push(patchName);

  function applyPatch(proto, patch) {
    Object.keys(patch).forEach(function(methodName) {
      const method = patch[methodName];
      if (typeof method === "function") {
        const original = proto[methodName];
        if (!(methodName in proto.__patches.origMethods)) {
          proto.__patches.origMethods[methodName] = original;
        }
        proto[methodName] = function(...args) {
          this._super = original;
          return method.call(this, ...args);
        };
      }
    });
  }
}

export function unpatch(C: any, patchName: string) {
  const proto = C.prototype;
  const patchInfo = proto.__patches;
  delete proto.__patches;

  // reset to original
  for (let k in patchInfo.origMethods) {
    proto[k] = patchInfo.origMethods[k];
  }

  // apply other patches
  for (let name of patchInfo.current) {
    if (name !== patchName) {
      patch(C, name, patchInfo.patches[name]);
    }
  }
}

export async function loadTemplates(url: string): Promise<string> {
  const result = await fetch(url);
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  let templates = await result.text();
  templates = templates.replace(/<!--[\s\S]*?-->/g, "");
  return templates;
}

const loadedScripts: { [key: string]: Promise<void> } = {};

export function loadJS(url: string): Promise<void> {
  if (url in loadedScripts) {
    return loadedScripts[url];
  }
  const promise: Promise<void> = new Promise(function(resolve, reject) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = function() {
      resolve();
    };
    script.onerror = function() {
      reject(`Error loading file '${url}'`);
    };
    const head = document.head || document.getElementsByTagName("head")[0];
    head.appendChild(script);
  });
  loadedScripts[url] = promise;
  return promise;
}

export function whenReady(fn) {
  if (document.readyState === "complete") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn, false);
  }
}
