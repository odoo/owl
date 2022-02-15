import { createBlock, html, list, multi, text, toggler, comment } from "../blockdom";
import { compile, Template } from "../compiler";
import { component, getCurrent } from "../component/component_node";
import { UTILS } from "./template_helpers";

const bdom = { text, createBlock, list, multi, html, toggler, component, comment };

export const globalTemplates: { [key: string]: string | Element } = {};

function parseXML(xml: string): Document {
  const parser = new DOMParser();

  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    let msg = "Invalid XML in template.";
    const parsererrorText = doc.getElementsByTagName("parsererror")[0].textContent;
    if (parsererrorText) {
      msg += "\nThe parser has produced the following error message:\n" + parsererrorText;
      const re = /\d+/g;
      const firstMatch = re.exec(parsererrorText);
      if (firstMatch) {
        const lineNumber = Number(firstMatch[0]);
        const line = xml.split("\n")[lineNumber - 1];
        const secondMatch = re.exec(parsererrorText);
        if (line && secondMatch) {
          const columnIndex = Number(secondMatch[0]) - 1;
          if (line[columnIndex]) {
            msg +=
              `\nThe error might be located at xml line ${lineNumber} column ${columnIndex}\n` +
              `${line}\n${"-".repeat(columnIndex - 1)}^`;
          }
        }
      }
    }
    throw new Error(msg);
  }
  return doc;
}

export interface TemplateSetConfig {
  dev?: boolean;
  translatableAttributes?: string[];
  translateFn?: (s: string) => string;
  templates?: string | Document;
}

export class TemplateSet {
  dev: boolean;
  rawTemplates: typeof globalTemplates = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
  utils: typeof UTILS = Object.assign({}, UTILS, {
    call: (owner: any, subTemplate: string, ctx: any, parent: any, key: any) => {
      const template = this.getTemplate(subTemplate);
      return toggler(subTemplate, template.call(owner, ctx, parent, key));
    },
    getTemplate: (name: string) => this.getTemplate(name),
  });

  constructor(config: TemplateSetConfig = {}) {
    this.dev = config.dev || false;
    this.translateFn = config.translateFn;
    this.translatableAttributes = config.translatableAttributes;
    if (config.templates) {
      this.addTemplates(config.templates);
    }
  }

  addTemplate(
    name: string,
    template: string | Element,
    options: { allowDuplicate?: boolean } = {}
  ) {
    if (name in this.rawTemplates && !options.allowDuplicate) {
      throw new Error(`Template ${name} already defined`);
    }
    this.rawTemplates[name] = template;
  }

  addTemplates(xml: string | Document, options: { allowDuplicate?: boolean } = {}) {
    if (!xml) {
      // empty string
      return;
    }
    xml = xml instanceof Document ? xml : parseXML(xml);
    for (const template of xml.querySelectorAll("[t-name]")) {
      const name = template.getAttribute("t-name")!;
      this.addTemplate(name, template, options);
    }
  }

  getTemplate(name: string): Template {
    if (!(name in this.templates)) {
      const rawTemplate = this.rawTemplates[name];
      if (rawTemplate === undefined) {
        let extraInfo = "";
        try {
          const componentName = getCurrent().component.constructor.name;
          extraInfo = ` (for component "${componentName}")`;
        } catch {}
        throw new Error(`Missing template: "${name}"${extraInfo}`);
      }
      const templateFn = this._compileTemplate(name, rawTemplate);
      // first add a function to lazily get the template, in case there is a
      // recursive call to the template name
      const templates = this.templates;
      this.templates[name] = function (context, parent) {
        return templates[name].call(this, context, parent);
      };
      const template = templateFn(bdom, this.utils);
      this.templates[name] = template;
    }
    return this.templates[name];
  }

  _compileTemplate(name: string, template: string | Element) {
    return compile(template, {
      name,
      dev: this.dev,
      translateFn: this.translateFn,
      translatableAttributes: this.translatableAttributes,
    });
  }
}

// -----------------------------------------------------------------------------
//  xml tag helper
// -----------------------------------------------------------------------------
export function xml(...args: Parameters<typeof String.raw>) {
  const name = `__template__${xml.nextId++}`;
  const value = String.raw(...args);
  globalTemplates[name] = value;
  return name;
}

xml.nextId = 1;
