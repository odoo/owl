import { OwlError } from "@odoo/owl-core";
import type {
  compile,
  ComponentHelpers,
  CustomDirectives,
  Template,
  TemplateBlockDom,
  TemplateFunction,
  TemplateHelpers,
} from "@odoo/owl-compiler";
import { createBlock, html, list, multi, text, toggler } from "@odoo/owl-blockdom";
import { templateHelpers } from "./rendering/template_helpers";

const bdom = { text, createBlock, list, multi, html, toggler } satisfies TemplateBlockDom;

// Component helpers of a template set that has none: rendering a component,
// a slot or a prop for a component throws. Templates can still contain
// components, as long as these parts are not rendered.
const NO_COMPONENT_HELPERS: ComponentHelpers = {
  createComponent(name) {
    return (props, key, node, parent, C) => {
      throw new OwlError(
        `Cannot render component "${C?.name ?? name}": components can only be rendered by an App`
      );
    };
  },
  callSlot(ctx, parent, key, name) {
    throw new OwlError(
      `Cannot render slot "${name}": components and their slots can only be rendered by an App`
    );
  },
  toSignal() {
    throw new OwlError(
      `Cannot render the props of a component: components can only be rendered by an App`
    );
  },
};

export interface TemplateSetConfig {
  dev?: boolean;
  translatableAttributes?: string[];
  translateFn?: (s: string, translationCtx: string) => string;
  templates?: string | Document | Record<string, string | TemplateFunction>;
  getTemplate?: (s: string) => Element | Function | string | void;
  customDirectives?: CustomDirectives;
  globalValues?: object;
  // the helpers rendering components (given by an App). Without them, the
  // template set renders templates, but no components.
  componentHelpers?: ComponentHelpers;
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
  runtimeUtils: TemplateHelpers & ComponentHelpers;
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
    this.runtimeUtils = {
      ...templateHelpers,
      ...(config.componentHelpers || NO_COMPONENT_HELPERS),
      __globals__: config.globalValues || {},
    };
    this.hasGlobalValues = Boolean(config.globalValues && Object.keys(config.globalValues).length);
  }

  addTemplate(name: string, template: string | Element | TemplateFunction) {
    if (name in this.rawTemplates) {
      // this check can be expensive, just silently ignore double definitions outside dev mode
      if (!this.dev) {
        return;
      }
      const rawTemplate = this.rawTemplates[name];
      if (areTemplatesEqual(rawTemplate, template)) {
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
    xml = xml instanceof Document ? xml : this._parseXML(xml);
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
        throw new OwlError(missingTemplateMessage(name));
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

  private _parseXML(xml: string): Document {
    throw new OwlError(
      `Unable to parse XML templates. Please use owl full build instead, or pass a Document instance.`
    );
  }
}

export function missingTemplateMessage(name: string): string {
  return `Missing template: "${name}"`;
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

function areTemplatesEqual(t1: any, t2: any): boolean {
  if (t1 === t2) {
    return true;
  }
  if ((typeof t1 === "function") !== (typeof t2 === "function")) {
    return false;
  }
  const s1 = t1 instanceof Element ? t1.outerHTML : String(t1);
  const s2 = t2 instanceof Element ? t2.outerHTML : String(t2);
  return s1 === s2;
}
