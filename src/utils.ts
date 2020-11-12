/**
 * Owl Utils
 *
 * We have here a small collection of utility functions:
 *
 * - whenReady
 * - loadJS
 * - loadFile
 * - escape
 * - debounce
 * - shallowEqual
 * - kebabToCamel
 */

import { browser } from "./browser";

export function whenReady(fn?: any) {
  return new Promise(function (resolve) {
    if (document.readyState !== "loading") {
      resolve();
    } else {
      document.addEventListener("DOMContentLoaded", resolve, false);
    }
  }).then(fn || function () {});
}

const loadedScripts: { [key: string]: Promise<void> } = {};

export function loadJS(url: string): Promise<void> {
  if (url in loadedScripts) {
    return loadedScripts[url];
  }
  const promise: Promise<void> = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = function () {
      resolve();
    };
    script.onerror = function () {
      reject(`Error loading file '${url}'`);
    };
    const head = document.head || document.getElementsByTagName("head")[0];
    head.appendChild(script);
  });
  loadedScripts[url] = promise;
  return promise;
}

export async function loadFile(url: string): Promise<string> {
  const result = await browser.fetch(url);
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  return await result.text();
}

export function escape(str: string | number | undefined): string {
  if (str === undefined) {
    return "";
  }
  if (typeof str === "number") {
    return String(str);
  }
  const p = document.createElement("p");
  p.textContent = str;
  return p.innerHTML;
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * Inspired by https://davidwalsh.name/javascript-debounce-function
 */
export function debounce(func: Function, wait: number, immediate?: boolean): Function {
  let timeout;
  return function (this: any) {
    const context = this;
    const args = arguments;
    function later() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    }
    const callNow = immediate && !timeout;
    browser.clearTimeout(timeout);
    timeout = browser.setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}

export function shallowEqual(p1, p2): boolean {
  for (let k in p1) {
    if (p1[k] !== p2[k]) {
      return false;
    }
  }
  return true;
}

export function kebabToCamel(str: string): string {
  return str.replace(/(\-[a-z])/g, (val) => val.toUpperCase()).replace("-", "");
}
