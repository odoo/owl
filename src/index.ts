import { TemplateSet } from "./app/template_set";
import { compile } from "./compiler";

export * from "./index.runtime";

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
