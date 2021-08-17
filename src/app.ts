// import { Blocks as BaseBlocks } from "./bdom";
import { compileTemplate, Template } from "./compiler/index";
import { globalTemplates } from "./tags";
import { BNode } from "./b_node";
import type { Component } from "./component";
import { Scheduler } from "./scheduler";
import { UTILS } from "./template_utils";
import { blockDom } from ".";
import { toggler } from "./bdom";
// import { BDispatch } from "./bdom/b_dispatch";

// const Blocks = {
//   ...BaseBlocks,
//   BNode,
// };

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
      const templateFn = compileTemplate(rawTemplate, name);

      // first add a function to lazily get the template, in case there is a
      // recursive call to the template name
      this.templates[name] = (context, parent) => this.templates[name](context, parent);
      const template = templateFn(blockDom, this.utils);
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
  root: BNode | null = null;
  dev: boolean = true;

  constructor(Root: T, props?: any) {
    super();
    this.Root = Root;
    this.props = props;
    // todo: remove this
    if ((window as any).debug) {
      (window as any).owl.apps = (window as any).owl.apps || [];
      (window as any).owl.apps.push(this);
    }
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
    const node = new BNode(this.Root, this.props, this);
    this.root = node;
    return node.mountComponent(target);

    // const node = new OwlNode(this, this.Root, this.props);
    // return node.mount(target);
  }

  destroy() {
    if (this.root) {
      this.root.destroy();
    }
  }
}
