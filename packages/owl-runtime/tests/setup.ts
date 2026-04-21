// Wire compile + parseXML into TemplateSet for tests that use xml templates.
// Import from the specific module to avoid triggering runtime/index side
// effects (which would overwrite config.mainEventHandler and break blockdom
// tests that rely on the default).
import { compile, parseXML } from "@odoo/owl-compiler";
import { TemplateSet } from "../src/template_set";

(TemplateSet.prototype as any)._compileTemplate = function _compileTemplate(
  name: string,
  template: string | Element
) {
  return compile(template, {
    name,
    dev: this.dev,
    translateFn: this.translateFn,
    translatableAttributes: this.translatableAttributes,
    customDirectives: this.customDirectives,
    hasGlobalValues: this.hasGlobalValues,
  });
};
(TemplateSet.prototype as any)._parseXML = function _parseXML(xml: string) {
  return parseXML(xml);
};

const consoleOutput: string[] = [];
(globalThis as any).__owl_console_output = consoleOutput;

for (const method of ["warn", "info", "log", "error"] as const) {
  console[method] = (...args: any[]) => {
    consoleOutput.push(`${method}:${args[0]}`);
  };
}

afterEach(() => {
  const remaining = consoleOutput.splice(0);
  if (remaining.length > 0) {
    throw new Error(`Unexpected console output:\n${remaining.join("\n")}`);
  }
});
