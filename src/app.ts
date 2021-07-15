import { Blocks as BaseBlocks } from "./bdom";
import { compileTemplate, Template } from "./compiler/index";
import { globalTemplates } from "./tags";
import { BComponent, BComponentH } from "./block_component";
import type { Component } from "./component";
import { OwlNode } from "./owl_node";
import { Scheduler } from "./scheduler";
import { UTILS } from "./template_utils";

const Blocks = {
  ...BaseBlocks,
  BComponent,
  BComponentH,
};

// -----------------------------------------------------------------------------
//  TemplateSet
// -----------------------------------------------------------------------------

export class TemplateSet {
  rawTemplates: { [name: string]: string } = Object.create(globalTemplates);
  templates: { [name: string]: Template } = {};
  utils: typeof UTILS;

  constructor() {
    const call = (subTemplate: string, ctx: any, parent: any) => {
      const template = this.getTemplate(subTemplate);
      return template(ctx, parent);
    };

    this.utils = Object.assign({}, UTILS, { call });
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
  root: OwlNode | null = null;
  dev: boolean = true;
  
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
    if (!(target instanceof HTMLElement)) {
      throw new Error("Cannot mount component: the target is not a valid DOM element");
    }
    if (!document.body.contains(target)) {
      throw new Error("Cannot mount a component on a detached dom node");
    }
    const node = new OwlNode(this, this.Root, this.props);
    this.root = node;
    return node.mount(target);
  }

  destroy() {
    if (this.root) {
      this.root.destroy();
    }
  }
}
