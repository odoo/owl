import { globalTemplates } from "./qweb/template_helpers";

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
