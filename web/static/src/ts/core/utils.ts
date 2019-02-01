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

export function idGenerator(): (() => number) {
  let nextID = 1;
  return () => nextID++;
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
