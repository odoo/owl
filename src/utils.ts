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
 */

import { browser } from "./browser";

export function whenReady(fn?: any) {
  return new Promise(function (resolve) {
    if (document.readyState !== "loading") {
      (resolve as any)();
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

const escapeMethod = Symbol('html')

// notable issues:
// * objects can't be negative in JS, so !!"" -> false but
//   !!(new String) -> true, likewise markup
// TODO (?)
// * Markup.join / Markup#join => escapes items and returns a Markup
// * Markup#replace => automatically escapes the replacements (difficult impl)
class _Markup extends String {
  [escapeMethod]() {
      return this;
  }
}

/**
* Returns a markup object, which acts like a String but is considered safe by
* `_.escape`, and will therefore be injected as-is (without additional
* escaping) in templates. Can be used to inject dynamic HTML in templates
* (where the template itself can't), see first example.
*
* Can also be used as a *template tag*, in which case the literal content
* won't be escaped but the substitutions which are not already markup objects
* will be.
*
* ## WARNINGS:
* * A markup object is a `String` (boxed) but not a `string` (primitive), they
*   typecheck differently which can be relevant.
* * To strip out the "markupness", just call `String(markup)`.
* * Most string operations (e.g. concatenation, `String#replace`, ...) will
*   also strip out markupness
* * If the input is empty, returns a regular string (that way boolean tests
*   work as expected).
*
* @returns a markup object
*
* @example regular function
* let h;
* if (someTest) {
*     h = Markup(_t("This is a <strong>success</strong>"));
* } else {
*     h = Markup(_t("Things did <strong>not</strong> work out"));
* }
* qweb.render("some_template", { message: h });
*
* @example template tag
* const escaped = "<some> text";
* const asis = Markup`some <b>text</b>`;
* const h = Markup`Regular strings get ${escaped} but markup is injected ${asis}`;
*/
export function Markup(v, ...exprs) {
  if (!(v instanceof Array)) {
      return v ? new _Markup(v) : '';
  }
  const elements = [];
  let i = 0;
  for(; i < exprs.length; ++i) {
      elements.push(v[i], escape(exprs[i]));
  }
  elements.push(v[i]);

  const s = elements.join('');
  if (!s) { return '' }
  return new _Markup(s);
}

