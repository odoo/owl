// -----------------------------------------------------------------------------
//  Global templates
// -----------------------------------------------------------------------------

let nextId = 1;
export const globalTemplates: { [key: string]: string } = {};

export function xml(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__template__${nextId++}`;
  const value = String.raw(strings, ...args);
  globalTemplates[name] = value;
  return name;
}
