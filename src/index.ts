import { TemplateSet } from "./runtime/template_set";
import { compile } from "./compiler";
import { isThisTrackingEnabled } from "./runtime/this_tracking";

export * from "./runtime";

TemplateSet.prototype._compileTemplate = function _compileTemplate(
  name: string,
  template: string | Element
) {
  const trackExpressions = isThisTrackingEnabled();
  return compile(template, {
    name,
    dev: this.dev,
    translateFn: this.translateFn,
    translatableAttributes: this.translatableAttributes,
    customDirectives: this.customDirectives,
    hasGlobalValues: this.hasGlobalValues,
    trackExpressions,
    rawXml: trackExpressions
      ? typeof template === "string"
        ? template
        : template.outerHTML
      : undefined,
  });
};
