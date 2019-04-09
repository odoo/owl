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

/**
 * Create a function that will generate unique id numbers
 */
export function idGenerator(): () => number {
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

export function shallowEqual(objA, objB) {
  if (objA === objB) {
    return true;
  }
  const keysA = Object.keys(objA);
  for (let key of keysA) {
    if (!(key in objB) || objA[key] !== objB[key]) {
      return false;
    }
  }
  return true;
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

function _magifyArray({ raw, key, parent, magic, onDirty }) {
  Object.defineProperty(magic, "length", {
    get() {
      return magic.raw.length;
    }
  });
  Object.assign(magic, {
    push: function(item) {
      onDirty();
      parent.raw[key] = [...magic.raw, item];
      magic.raw = parent.raw[key];
      const index = magic.raw.length - 1;
      let prop = magify({ raw: item, key: index, parent: magic, onDirty });
      Object.defineProperty(magic, index, {
        set(newVal) {
          onDirty();
          parent.raw[key] = [...magic.raw];
          parent.raw[key][index] = newVal;
          magic.raw = parent.raw[key];
          prop = magify({ raw: newVal, key: index, parent: magic, onDirty });
        },
        get() {
          return prop;
        }
      });
    }
  });
  raw.forEach((value, index) => {
    let prop = magify({
      raw: value,
      key: index,
      parent: magic,
      onDirty
    });
    Object.defineProperty(magic, index, {
      set(newVal) {
        onDirty();
        parent.raw[key] = [...magic.raw];
        parent.raw[key][index] = newVal;
        magic.raw = parent.raw[key];
        prop = magify({ raw: newVal, key: index, parent: magic, onDirty });
      },
      get() {
        return prop;
      }
    });
  });
}

export function magify({ raw, key, parent, onDirty }) {
  if (!parent.magic) {
    parent = {
      raw: parent,
      magic: true,
      parent: null
    };
  }
  if (raw.magic) {
    return raw;
  }
  if (typeof raw !== "object") {
    return raw;
  }
  let magic = { raw, key, parent, magic: true };
  if (Array.isArray(raw)) {
    _magifyArray({ raw, key, parent, magic, onDirty });
  } else {
    Object.keys(raw).forEach(propKey => {
      let prop = magify({
        raw: raw[propKey],
        key: propKey,
        parent: magic,
        onDirty
      });
      Object.defineProperty(magic, propKey, {
        set(newVal) {
          onDirty();
          parent.raw[key] = { ...magic.raw, [propKey]: newVal };
          magic.raw = parent.raw[key];
          prop = magify({ raw: newVal, key: propKey, parent: magic, onDirty });
        },
        get() {
          return prop;
        }
      });
    });
  }
  return magic;
}
