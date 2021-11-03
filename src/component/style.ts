import { Component } from "./component";

export const globalStylesheets: { [key: string]: HTMLStyleElement } = {};

export function registerSheet(id: string, css: string) {
  const sheet = document.createElement("style");
  sheet.innerHTML = processSheet(css);
  globalStylesheets[id] = sheet;
}

/**
 * Apply the stylesheets defined by the component. Note that we need to make
 * sure all inherited stylesheets are applied as well, in a reverse order to
 * ensure that <style/> will be applied to the DOM in the order they are
 * included in the document. We then delete the `style` key from the constructor
 * to make sure we do not apply it again.
 */
export function applyStyles(ComponentClass: typeof Component) {
  const toApply: [string, string][] = [];
  while (ComponentClass && ComponentClass.style) {
    if (ComponentClass.hasOwnProperty("style")) {
      toApply.push([ComponentClass.style, ComponentClass.name]);
      delete (ComponentClass as any).style;
    }
    ComponentClass = Object.getPrototypeOf(ComponentClass);
  }
  while (toApply.length) {
    const [styleId, componentName] = toApply.pop()!;
    activateSheet(styleId, componentName);
  }
}

function activateSheet(id: string, name: string) {
  const sheet = globalStylesheets[id];
  if (!sheet) {
    throw new Error(
      `Invalid css stylesheet for component '${name}'. Did you forget to use the 'css' tag helper?`
    );
  }
  sheet.dataset.component = name;
  document.head.appendChild(sheet);
}

function processSheet(str: string): string {
  const tokens = str.split(/(\{|\}|;)/).map((s) => s.trim());
  const selectorStack: string[][] = [];
  const parts: string[] = [];
  let rules: string[] = [];
  function generateSelector(stackIndex: number, parentSelector?: string) {
    const parts: string[] = [];
    for (const selector of selectorStack[stackIndex]) {
      let part = (parentSelector && parentSelector + " " + selector) || selector;
      if (part.includes("&")) {
        part = selector.replace(/&/g, parentSelector || "");
      }
      if (stackIndex < selectorStack.length - 1) {
        part = generateSelector(stackIndex + 1, part);
      }
      parts.push(part);
    }
    return parts.join(", ");
  }
  function generateRules() {
    if (rules.length) {
      parts.push(generateSelector(0) + " {");
      parts.push(...rules);
      parts.push("}");
      rules = [];
    }
  }
  while (tokens.length) {
    let token = tokens.shift()!;
    if (token === "}") {
      generateRules();
      selectorStack.pop();
    } else {
      if (tokens[0] === "{") {
        generateRules();
        selectorStack.push(token.split(/\s*,\s*/));
        tokens.shift();
      }
      if (tokens[0] === ";") {
        rules.push("  " + token + ";");
      }
    }
  }
  return parts.join("\n");
}
