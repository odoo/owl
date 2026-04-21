import { TemplateSet } from "@odoo/owl-runtime";
import { compile, parseXML } from "@odoo/owl-compiler";

export * from "@odoo/owl-runtime";

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
