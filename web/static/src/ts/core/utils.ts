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
