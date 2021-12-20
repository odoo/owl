import { createBlock, html, list, multi, text, toggler, comment } from "../blockdom";
import { compile, Template } from "../compiler";
import { component } from "../component/component_node";
import { UTILS } from "./template_helpers";

const bdom = { text, createBlock, list, multi, html, toggler, component, comment };

export const globalTemplates: { [key: string]: string | Node } = {};

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

export class TemplateSet {
  rawTemplates: typeof globalTemplates = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
  utils: typeof UTILS;
  dev?: boolean;

  constructor() {
    const call = (owner: any, subTemplate: string, ctx: any, parent: any) => {
      const template = this.getTemplate(subTemplate);
      return toggler(subTemplate, template.call(owner, ctx, parent));
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
    if (!xml) {
      // empty string
      return;
    }
    xml = xml instanceof Document ? xml : parseXML(xml);
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
      const templateFn = this._compileTemplate(name, rawTemplate);
      // first add a function to lazily get the template, in case there is a
      // recursive call to the template name
      this.templates[name] = (context, parent) => this.templates[name](context, parent);
      const template = templateFn(bdom, this.utils);
      this.templates[name] = template;
    }
    return this.templates[name];
  }

  _compileTemplate(name: string, template: string | Node) {
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
