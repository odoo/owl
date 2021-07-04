import { Blocks } from "../bdom";
import { compileTemplate, Template } from "../compiler/index";
import { globalTemplates } from "../tags";
import { Component, internalMount } from "./component";
import { Scheduler } from "./scheduler";
import { callSlot, elem, owner, scope, toString, withDefault } from "./template_utils";

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
  owner,
  callSlot,
};

export class TemplateSet {
  rawTemplates: { [name: string]: string } = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  utils: typeof UTILS;

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

export class App<T extends typeof Component = any> extends TemplateSet {
  Root: T;
  props: any;
  env: any = {};
  scheduler = new Scheduler(window.requestAnimationFrame.bind(window));

  constructor(Root: T, props?: any) {
    super();
    this.Root = Root;
    this.props = props;
  }

  configure(params: any) {
    if (params.env) {
      this.env = params.env;
    }
  }

  mount(target: HTMLElement): Promise<InstanceType<T>> {
    return internalMount(this, this.Root, this.props, target);
  }
}

interface MountParameters {
  env?: any;
  target: HTMLElement;
  props?: any;
}

export async function mount<T extends typeof Component>(
  C: T,
  params: MountParameters
): Promise<InstanceType<T>> {
  const { env, props, target } = params;
  const app = new App(C, props);
  app.configure({ env });
  return app.mount(target);
}
