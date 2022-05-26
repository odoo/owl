import { TemplateSet } from "./runtime/template_set";
import { compile } from "./compiler";

export * from "./runtime";

TemplateSet.prototype._compileTemplate = function _compileTemplate(
  name: string,
  template: string | Element
) {
  return compile(template, {
    name,
    dev: this.dev,
    translateFn: this.translateFn,
    translatableAttributes: this.translatableAttributes,
  });
};
