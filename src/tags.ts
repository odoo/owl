import { registerSheet } from "./component/style";
import { globalTemplates } from "./compiler/template_helpers";

// -----------------------------------------------------------------------------
//  Global templates
// -----------------------------------------------------------------------------

export function xml(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__template__${xml.nextId++}`;
  const value = String.raw(strings, ...args);
  globalTemplates[name] = value;
  return name;
}

xml.nextId = 1;

// -----------------------------------------------------------------------------
//  Global stylesheets
// -----------------------------------------------------------------------------

export function css(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__sheet__${css.nextId++}`;
  const value = String.raw(strings, ...args);
  registerSheet(name, value);
  return name;
}

css.nextId = 1;
