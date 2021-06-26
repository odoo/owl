import { Blocks } from "./bdom";
import { compileTemplate, Template } from "./compiler/index";
import { callSlot, elem, getValues, owner, scope, toString, withDefault } from "./qweb_utils";
import { Scheduler } from "./scheduler";
import { globalTemplates } from "./tags";

// -----------------------------------------------------------------------------
//  TemplateSet
// -----------------------------------------------------------------------------

export const UTILS = {
  elem,
  toString,
  withDefault,
  call: (name: string) => {
    throw new Error(`Missing template: ${name}`);
  },
  zero: Symbol("zero"),
  scope,
  getValues,
  owner,
  callSlot,
};

export class App {
  rawTemplates: { [name: string]: string } = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  utils: typeof UTILS;
  scheduler = new Scheduler(window.requestAnimationFrame.bind(window));

  constructor() {
    const call = (subTemplate: string, ctx: any, refs: any) => {
      const template = this.getTemplate(subTemplate);
      return template(ctx, refs);
    };

    this.utils = Object.assign({}, UTILS, { call });
  }

  addTemplate(name: string, template: string, allowDuplicate: boolean = false) {
    if (name in this.rawTemplates && !allowDuplicate) {
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
      const templateFn = compileTemplate(rawTemplate, name);
      const template = templateFn(Blocks, this.utils);
      this.templates[name] = template;
    }
    return this.templates[name];
  }
}
