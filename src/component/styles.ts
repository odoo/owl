/**
 * Owl Style System
 *
 * This files contains the Owl code related to processing (extended) css strings
 * and creating/adding <style> tags to the document head.
 */

export const STYLESHEETS: { [id: string]: HTMLStyleElement } = {};

function processSheet(str: string): string {
  const tokens = str.split(/(\{|\}|;)/).map(s => s.trim());
  const selectorStack: string[] = [];
  const parts: string[] = [];
  let rules: string[] = [];
  function generateRules() {
    if (rules.length) {
      parts.push(selectorStack.join(" ") + " {");
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
        selectorStack.push(token);
        tokens.shift();
      }
      if (tokens[0] === ";") {
        rules.push("  " + token + ";");
      }
    }
  }
  return parts.join("\n");
}
export function registerSheet(id: string, css: string) {
  const sheet = document.createElement("style");
  sheet.innerHTML = processSheet(css);
  STYLESHEETS[id] = sheet;
}

export function activateSheet(id, name) {
  const sheet = STYLESHEETS[id];
  if (!sheet) {
    throw new Error(
      `Invalid css stylesheet for component '${name}'. Did you forget to use the 'css' tag helper?`
    );
  }
  sheet.setAttribute("component", name);
  document.head.appendChild(sheet);
}
