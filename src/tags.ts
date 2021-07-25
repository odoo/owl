// -----------------------------------------------------------------------------
//  Global templates
// -----------------------------------------------------------------------------

export const globalTemplates: { [key: string]: string } = {};

export function xml(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__template__${xml.nextId++}`;
  const value = String.raw(strings, ...args);
  globalTemplates[name] = value;
  return name;
}

xml.nextId = 1;
