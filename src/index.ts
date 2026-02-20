import { TemplateSet } from "./runtime/template_set";
import { compile } from "./compiler";

export * from "./runtime";

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
