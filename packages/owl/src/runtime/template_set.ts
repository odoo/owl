import { OwlError } from "../common/owl_error";
import { parseXML } from "../common/utils";
import { compile, CustomDirectives, Template, TemplateFunction } from "../compiler";
import { createBlock, html, list, multi, text, toggler } from "./blockdom";
import { getContext } from "./context";
import { helpers } from "./rendering/template_helpers";

const bdom = { text, createBlock, list, multi, html, toggler };

export interface TemplateSetConfig {
  dev?: boolean;
  translatableAttributes?: string[];
  translateFn?: (s: string, translationCtx: string) => string;
  templates?: string | Document | Record<string, string>;
  getTemplate?: (s: string) => Element | Function | string | void;
  customDirectives?: CustomDirectives;
  globalValues?: object;
}

export class TemplateSet {
  static registerTemplate(name: string, fn: TemplateFunction) {
    globalTemplates[name] = fn;
  }
  dev: boolean;
  rawTemplates: typeof globalTemplates = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  getRawTemplate?: (s: string) => Element | Function | string | void;
  translateFn?: (s: string, translationCtx: string) => string;
  translatableAttributes?: string[];
  customDirectives: CustomDirectives;
  runtimeUtils: object;
  hasGlobalValues: boolean;

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
    this.runtimeUtils = { ...helpers, __globals__: config.globalValues || {} };
    this.hasGlobalValues = Boolean(config.globalValues && Object.keys(config.globalValues).length);
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
    const cacheKey = name;
    if (!(cacheKey in this.templates)) {
      const rawTemplate = this.getRawTemplate?.(name) || this.rawTemplates[name];
      if (rawTemplate === undefined) {
        let extraInfo = "";
        try {
          const { componentName } = getContext("component");
          extraInfo = ` (for component "${componentName}")`;
        } catch {}
        throw new OwlError(`Missing template: "${name}"${extraInfo}`);
      }
      const isFn = typeof rawTemplate === "function" && !(rawTemplate instanceof Element);
      const templateFn = isFn ? rawTemplate : this._compileTemplate(name, rawTemplate);
      // first add a function to lazily get the template, in case there is a
      // recursive call to the template name
      const templates = this.templates;
      this.templates[cacheKey] = function (context, parent) {
        return templates[cacheKey].call(this, context, parent);
      };
      const template = templateFn(this, bdom, this.runtimeUtils);
      this.templates[cacheKey] = template;
    }
    return this.templates[cacheKey];
  }

  private _compileTemplate(name: string, template: string | Element): ReturnType<typeof compile> {
    throw new OwlError(`Unable to compile a template. Please use owl full build instead`);
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
