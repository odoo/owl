import { Component } from "../component/component";
import { ComponentNode } from "../component/component_node";
import { MountOptions } from "../component/fibers";
import { Scheduler } from "../component/scheduler";
import { TemplateSet, TemplateSetConfig } from "./template_set";
import { nodeErrorHandlers } from "../component/error_handling";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

export interface Env {
  [key: string]: any;
}

export interface AppConfig extends TemplateSetConfig {
  env?: Env;
  props?: any;
}

export const DEV_MSG = `Owl is running in 'dev' mode.

This is not suitable for production use.
See https://github.com/odoo/owl/blob/master/doc/reference/config.md#mode for more information.`;

export class App<T extends typeof Component = any> extends TemplateSet {
  Root: T;
  props: any;
  env: Env;
  scheduler = new Scheduler(window.requestAnimationFrame.bind(window));
  root: ComponentNode | null = null;

  constructor(Root: T, config: AppConfig = {}) {
    super(config);
    this.Root = Root;
    if (config.dev) {
      console.info(DEV_MSG);
    }
    const descrs = Object.getOwnPropertyDescriptors(config.env || {});
    this.env = Object.freeze(Object.defineProperties({}, descrs));
    this.props = config.props || {};
  }

  mount(target: HTMLElement, options?: MountOptions): Promise<InstanceType<T>> {
    this.checkTarget(target);
    const node = this.makeNode(this.Root, this.props);
    const prom = this.mountNode(node, target, options);
    this.root = node;
    return prom;
  }

  checkTarget(target: HTMLElement) {
    if (!(target instanceof HTMLElement)) {
      throw new Error("Cannot mount component: the target is not a valid DOM element");
    }
    if (!document.body.contains(target)) {
      throw new Error("Cannot mount a component on a detached dom node");
    }
  }

  makeNode(Component: T, props: any): ComponentNode {
    return new ComponentNode(Component, props, this);
  }

  mountNode(node: ComponentNode, target: HTMLElement, options?: MountOptions) {
    const promise: any = new Promise((resolve, reject) => {
      let isResolved = false;
      // manually set a onMounted callback.
      // that way, we are independant from the current node.
      node.mounted.push(() => {
        resolve(node.component);
        isResolved = true;
      });

      // Manually add the last resort error handler on the node
      let handlers = nodeErrorHandlers.get(node);
      if (!handlers) {
        handlers = [];
        nodeErrorHandlers.set(node, handlers);
      }
      handlers.unshift((e) => {
        if (isResolved) {
          console.error(e);
        } else {
          reject(e);
        }
        throw e;
      });
    });
    node.mountComponent(target, options);
    return promise;
  }

  destroy() {
    if (this.root) {
      this.root.destroy();
    }
  }
}

export async function mount<T extends typeof Component>(
  C: T,
  target: HTMLElement,
  config: AppConfig & MountOptions = {}
): Promise<InstanceType<T>> {
  return new App(C, config).mount(target, config);
}
