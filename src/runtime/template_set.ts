import { compile, Template, TemplateFunction } from "../compiler";
import { comment, createBlock, html, list, multi, text, toggler } from "./blockdom";
import { getCurrent } from "./component_node";
import { Portal, portalTemplate } from "./portal";
import { helpers } from "./template_helpers";
import { OwlError } from "../common/owl_error";
import { parseXML } from "../common/utils";
import type { customDirectives } from "../common/types";

const bdom = { text, createBlock, list, multi, html, toggler, comment };

export interface TemplateSetConfig {
  dev?: boolean;
  translatableAttributes?: string[];
  translateFn?: (s: string) => string;
  templates?: string | Document | Record<string, string>;
  getTemplate?: (s: string) => Element | Function | string | void;
  customDirectives?: customDirectives;
}

export class TemplateSet {
  static registerTemplate(name: string, fn: TemplateFunction) {
    globalTemplates[name] = fn;
  }
  dev: boolean;
  rawTemplates: typeof globalTemplates = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  getRawTemplate?: (s: string) => Element | Function | string | void;
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
  Portal = Portal;
  customDirectives: customDirectives;

  constructor(config: TemplateSetConfig = {}) {
    this.dev = config.dev || false;
    this.translateFn = config.translateFn;
    this.translatableAttributes = config.translatableAttributes;
    if (config.templates) {
      if (config.templates instanceof Document || typeof config.templates === "string") {
        this.addTemplates(config.templates);
      } else {
        for (const name in config.templates) {
          this.addTemplate(name, config.templates[name]);
        }
      }
    }
    this.getRawTemplate = config.getTemplate;
    this.customDirectives = config.customDirectives || {};
  }

  addTemplate(name: string, template: string | Element) {
    if (name in this.rawTemplates) {
      // this check can be expensive, just silently ignore double definitions outside dev mode
      if (!this.dev) {
        return;
      }
      const rawTemplate = this.rawTemplates[name];
      const currentAsString =
        typeof rawTemplate === "string"
          ? rawTemplate
          : rawTemplate instanceof Element
          ? rawTemplate.outerHTML
          : rawTemplate.toString();
      const newAsString = typeof template === "string" ? template : template.outerHTML;
      if (currentAsString === newAsString) {
        return;
      }
      throw new OwlError(`Template ${name} already defined with different content`);
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

  getTemplate(name: string): Template {
    if (!(name in this.templates)) {
      const rawTemplate = this.getRawTemplate?.(name) || this.rawTemplates[name];
      if (rawTemplate === undefined) {
        let extraInfo = "";
        try {
          const componentName = getCurrent().component.constructor.name;
          extraInfo = ` (for component "${componentName}")`;
        } catch {}
        throw new OwlError(`Missing template: "${name}"${extraInfo}`);
      }
      const isFn = typeof rawTemplate === "function" && !(rawTemplate instanceof Element);
      const templateFn = isFn ? rawTemplate : this._compileTemplate(name, rawTemplate);
      // first add a function to lazily get the template, in case there is a
      // recursive call to the template name
      const templates = this.templates;
      this.templates[name] = function (context, parent) {
        return templates[name].call(this, context, parent);
      };
      const template = templateFn(this, bdom, helpers);
      this.templates[name] = template;
    }
    return this.templates[name];
  }

  _compileTemplate(name: string, template: string | Element): ReturnType<typeof compile> {
    throw new OwlError(`Unable to compile a template. Please use owl full build instead`);
  }

  callTemplate(owner: any, subTemplate: string, ctx: any, parent: any, key: any): any {
    const template = this.getTemplate(subTemplate);
    return toggler(subTemplate, template.call(owner, ctx, parent, key + subTemplate));
  }
}

// -----------------------------------------------------------------------------
//  xml tag helper
// -----------------------------------------------------------------------------
export const globalTemplates: { [key: string]: string | Element | TemplateFunction } = {};

export function xml(...args: Parameters<typeof String.raw>) {
  const name = `__template__${xml.nextId++}`;
  const value = String.raw(...args);
  globalTemplates[name] = value;
  return name;
}

xml.nextId = 1;

TemplateSet.registerTemplate("__portal__", portalTemplate);
