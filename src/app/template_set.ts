import { createBlock, html, list, multi, text, toggler } from "../blockdom";
import { compile, Template } from "../compiler";
import { component } from "../component/component_node";
import { UTILS } from "./template_helpers";

const bdom = { text, createBlock, list, multi, html, toggler, component };

export const globalTemplates: { [key: string]: string | Node } = {};

export class TemplateSet {
  rawTemplates: typeof globalTemplates = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
  utils: typeof UTILS;
  dev?: boolean;

  constructor() {
    const call = (subTemplate: string, ctx: any, parent: any) => {
      const template = this.getTemplate(subTemplate);
      return toggler(subTemplate, template(ctx, parent));
    };

    const getTemplate = (name: string) => this.getTemplate(name);
    this.utils = Object.assign({}, UTILS, { getTemplate, call });
  }

  addTemplate(name: string, template: string | Node, options: { allowDuplicate?: boolean } = {}) {
    if (name in this.rawTemplates && !options.allowDuplicate) {
      throw new Error(`Template ${name} already defined`);
    }
    this.rawTemplates[name] = template;
  }

  addTemplates(xml: string | Document, options: { allowDuplicate?: boolean } = {}) {
    xml = xml instanceof Document ? xml : new DOMParser().parseFromString(xml, "text/xml");
    for (const template of xml.querySelectorAll("[t-name]")) {
      const name = template.getAttribute("t-name")!;
      template.removeAttribute("t-name");
      this.addTemplate(name, template, options);
    }
  }

  getTemplate(name: string): Template {
    if (!(name in this.templates)) {
      const rawTemplate = this.rawTemplates[name];
      if (rawTemplate === undefined) {
        throw new Error(`Missing template: "${name}"`);
      }
      const templateFn = compile(rawTemplate, {
        name,
        dev: this.dev,
        translateFn: this.translateFn,
        translatableAttributes: this.translatableAttributes,
      });

      // first add a function to lazily get the template, in case there is a
      // recursive call to the template name
      this.templates[name] = (context, parent) => this.templates[name](context, parent);
      const template = templateFn(bdom, this.utils);
      this.templates[name] = template;
    }
    return this.templates[name];
  }
}
