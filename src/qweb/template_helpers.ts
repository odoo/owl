import { BDom, createBlock, html, list, multi, text, toggler } from "../blockdom";
import { compileTemplate, Template } from "./compiler";
import { component } from "../component/component_node";

const bdom = { text, createBlock, list, multi, html, toggler, component };

export const globalTemplates: { [key: string]: string } = {};

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

function callSlot(
  ctx: any,
  parent: any,
  key: string,
  name: string,
  defaultSlot?: (ctx: any, key: string) => BDom,
  dynamic?: boolean
): BDom | null {
  const slots = ctx.__owl__.slots;
  const slotFn = slots[name];
  const slotBDom = slotFn ? slotFn(parent, key) : null;
  if (defaultSlot) {
    let child1: BDom | undefined = undefined;
    let child2: BDom | undefined = undefined;
    // const result = new BMulti(2);
    if (slotBDom) {
      child1 = dynamic ? toggler(name, slotBDom) : slotBDom;
    } else {
      child2 = defaultSlot(parent, key);
    }
    return multi([child1, child2]);
  }
  return slotBDom;
}

function capture(ctx: any): any {
  const component = ctx.__owl__.component;
  const result = Object.create(component);
  for (let k in ctx) {
    result[k] = ctx[k];
  }
  return result;
}

function withKey(elem: any, k: string) {
  elem.key = k;
  return elem;
}

function prepareList(collection: any): [any[], any[], number, any[]] {
  let keys: any[];
  let values: any[];

  if (Array.isArray(collection)) {
    keys = collection;
    values = collection;
  } else if (collection) {
    values = Object.keys(collection);
    keys = Object.values(collection);
  } else {
    throw new Error("Invalid loop expression");
  }
  const n = values.length;
  return [keys, values, n, new Array(n)];
}
export const UTILS = {
  // elem,
  // setText,
  withDefault,
  zero: Symbol("zero"),
  callSlot,
  capture,
  // toClassObj,
  withKey,
  prepareList,
  shallowEqual,
};

export class TemplateSet {
  rawTemplates: { [name: string]: string } = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  translateFn?: (s: string) => string;
  translatableAttributes?: string[];
  utils: typeof UTILS;

  constructor() {
    const call = (subTemplate: string, ctx: any, parent: any) => {
      const template = this.getTemplate(subTemplate);
      return toggler(subTemplate, template(ctx, parent));
    };

    const getTemplate = (name: string) => this.getTemplate(name);
    this.utils = Object.assign({}, UTILS, { getTemplate, call });
  }

  addTemplate(name: string, template: string, options: { allowDuplicate?: boolean } = {}) {
    if (name in this.rawTemplates && !options.allowDuplicate) {
      throw new Error(`Template ${name} already defined`);
    }
    this.rawTemplates[name] = template;
  }

  getTemplate(name: string): Template {
    if (!(name in this.templates)) {
      const rawTemplate = this.rawTemplates[name];
      if (rawTemplate === undefined) {
        throw new Error(`Missing template: "${name}"`);
      }
      const templateFn = compileTemplate(rawTemplate, {
        name,
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

function shallowEqual(l1: any[], l2: any[]): boolean {
  for (let i = 0, l = l1.length; i < l; i++) {
    if (l1[i] !== l2[i]) {
      return false;
    }
  }
  return true;
}
