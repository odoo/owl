import { createBlock, html, list, multi, text, toggler, comment } from "../blockdom";
import { compile, Template, TemplateFunction } from "../compiler";
import { markRaw } from "../reactivity";
import { Portal } from "../portal";
import { component, getCurrent } from "../component/component_node";
import { helpers } from "./template_helpers";

const bdom = { text, createBlock, list, multi, html, toggler, component, comment };

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

/**
 * Returns the helpers object that will be injected in each template closure
 * function
 */
function makeHelpers(getTemplate: (name: string) => Template): any {
  return Object.assign({}, helpers, {
    Portal,
    markRaw,
    getTemplate,
    call: (owner: any, subTemplate: string, ctx: any, parent: any, key: any) => {
      const template = typeof subTemplate === "string" ? getTemplate(subTemplate) : subTemplate;
      return toggler(subTemplate, template.call(owner, ctx, parent, key));
    },
  });
}

export interface TemplateSetConfig {
  dev?: boolean;
  translatableAttributes?: string[];
  translateFn?: (s: string) => string;
  templates?: string | Document;
}

export class TemplateSet {
  dev: boolean;
  rawTemplates: any = {}; //typeof globalTemplates = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
  helpers: any;
  bdom: any = bdom;

  constructor(config: TemplateSetConfig = {}) {
    this.dev = config.dev || false;
    this.translateFn = config.translateFn;
    this.translatableAttributes = config.translatableAttributes;
    if (config.templates) {
      this.addTemplates(config.templates);
    }
    this.helpers = makeHelpers(this.getTemplate.bind(this));
  }

  addTemplate(name: string, template: string | Element) {
    if (name in this.rawTemplates) {
      const rawTemplate = this.rawTemplates[name];
      const currentAsString = typeof rawTemplate === "string" ? rawTemplate : rawTemplate.outerHTML;
      const newAsString = typeof template === "string" ? template : template.outerHTML;
      if (currentAsString === newAsString) {
        return;
      }
      throw new Error(`Template ${name} already defined with different content`);
    }
    this.rawTemplates[name] = template;
  }

  addTemplates(xml: string | Document) {
    if (!xml) {
      // empty string
      return;
    }
    xml = xml instanceof Document ? xml : parseXML(xml);
    for (const template of xml.querySelectorAll("[t-name]")) {
      const name = template.getAttribute("t-name")!;
      this.addTemplate(name, template);
    }
  }

  getTemplate(name: string | any): Template {
    if (!(name in this.templates)) {
      if (typeof name === "function") {
        return name(this);
      }
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
      const template = templateFn(bdom, this.helpers);
      this.templates[name] = template;
    }
    return this.templates[name];
  }

  _compileTemplate(name: string, template: string | Element): TemplateFunction {
    return compile(template, {
      name,
      dev: this.dev,
      translateFn: this.translateFn,
      translatableAttributes: this.translatableAttributes,
    });
  }
}
