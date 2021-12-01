import { onMounted } from "../component/lifecycle_hooks";
import { Component } from "../component/component";
import { ComponentNode } from "../component/component_node";
import { MountOptions } from "../component/fibers";
import { Scheduler } from "../component/scheduler";
import { TemplateSet } from "./template_set";
import { nodeErrorHandlers } from "../component/error_handling";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

export interface Env {
  [key: string]: any;
}

export interface AppConfig {
  dev?: boolean;
  env?: Env;
  translatableAttributes?: string[];
  translateFn?: (s: string) => string;
  templates?: string | Document;
}

export const DEV_MSG = `Owl is running in 'dev' mode.

This is not suitable for production use.
See https://github.com/odoo/owl/blob/master/doc/reference/config.md#mode for more information.`;

export class App<T extends typeof Component = any> extends TemplateSet {
  Root: T;
  props: any;
  env: Env = Object.freeze({});
  scheduler = new Scheduler(window.requestAnimationFrame.bind(window));
  root: ComponentNode | null = null;

  constructor(Root: T, props?: any) {
    super();
    this.Root = Root;
    this.props = props;
  }

  configure(config: AppConfig): App<T> {
    if (config.dev) {
      this.dev = config.dev;
      console.info(DEV_MSG);
    }
    if (config.env) {
      this.env = Object.freeze(Object.assign({}, config.env));
    }
    if (config.translateFn) {
      this.translateFn = config.translateFn;
    }
    if (config.translatableAttributes) {
      this.translatableAttributes = config.translatableAttributes;
    }
    if (config.templates) {
      this.addTemplates(config.templates);
    }
    return this;
  }

  mount(target: HTMLElement, options?: MountOptions): Promise<InstanceType<T>> {
    if (!(target instanceof HTMLElement)) {
      throw new Error("Cannot mount component: the target is not a valid DOM element");
    }
    if (!document.body.contains(target)) {
      throw new Error("Cannot mount a component on a detached dom node");
    }
    const node = new ComponentNode(this.Root, this.props, this);
    const promise: any = new Promise((resolve, reject) => {
      onMounted(() => resolve(node.component));

      // Manually add the last resort error handler on the node
      let handlers = nodeErrorHandlers.get(node);
      if (!handlers) {
        handlers = [];
        nodeErrorHandlers.set(node, handlers);
      }
      handlers.unshift((e) => {
        reject(e);
        throw e;
      });
    });
    this.root = node;
    node.mountComponent(target, options);
    return promise;
  }

  destroy() {
    if (this.root) {
      this.root.destroy();
    }
  }
}
