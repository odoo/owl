import { Component } from "./component/component";
import { ComponentNode } from "./component/component_node";
import { MountOptions } from "./component/fibers";
import { Scheduler } from "./component/scheduler";
import { TemplateSet } from "./qweb/template_helpers";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

interface Config {
  dev?: boolean;
  env?: { [key: string]: any };
  translatableAttributes?: string[];
  translateFn?: (s: string) => string;
}

export const DEV_MSG = `Owl is running in 'dev' mode.

This is not suitable for production use.
See https://github.com/odoo/owl/blob/master/doc/reference/config.md#mode for more information.`;

export class App<T extends typeof Component = any> extends TemplateSet {
  Root: T;
  props: any;
  env: any = {};
  scheduler = new Scheduler(window.requestAnimationFrame.bind(window));
  root: ComponentNode | null = null;

  constructor(Root: T, props?: any) {
    super();
    this.Root = Root;
    this.props = props;
  }

  configure(config: Config) {
    if (config.dev) {
      this.dev = config.dev;
      console.info(DEV_MSG);
    }

    if (config.env) {
      this.env = config.env;
    }
    if (config.translateFn) {
      this.translateFn = config.translateFn;
    }
    if (config.translatableAttributes) {
      this.translatableAttributes = config.translatableAttributes;
    }
  }

  mount(target: HTMLElement, options?: MountOptions): Promise<InstanceType<T>> {
    if (!(target instanceof HTMLElement)) {
      throw new Error("Cannot mount component: the target is not a valid DOM element");
    }
    if (!document.body.contains(target)) {
      throw new Error("Cannot mount a component on a detached dom node");
    }
    const node = new ComponentNode(this.Root, this.props, this);
    this.root = node;
    return node.mountComponent(target, options);
  }

  destroy() {
    if (this.root) {
      this.root.destroy();
    }
  }
}
