import { Component, ComponentConstructor } from "../component/component";
import { ComponentNode } from "../component/component_node";
import { MountOptions } from "../component/fibers";
import { Scheduler } from "../component/scheduler";
import { TemplateSet, TemplateSetConfig } from "./template_set";
import { nodeErrorHandlers } from "../component/error_handling";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

export interface Env {
  [key: string]: any;
}

export interface AppConfig<P, E> extends TemplateSetConfig {
  props?: P;
  env?: E;
  test?: boolean;
}

export const DEV_MSG = `Owl is running in 'dev' mode.

This is not suitable for production use.
See https://github.com/odoo/owl/blob/master/doc/reference/config.md#mode for more information.`;

export class App<
  T extends abstract new (...args: any) => any = any,
  P = any,
  E = any
> extends TemplateSet {
  Root: ComponentConstructor<P, E>;
  props: P;
  env: E;
  scheduler = new Scheduler();
  root: ComponentNode<P, E> | null = null;

  constructor(Root: ComponentConstructor<P, E>, config: AppConfig<P, E> = {}) {
    super(config);
    this.Root = Root;
    if (config.test) {
      this.dev = true;
    }
    if (this.dev && !config.test) {
      console.info(DEV_MSG);
    }
    const descrs = Object.getOwnPropertyDescriptors(config.env || {});
    this.env = Object.freeze(Object.defineProperties({}, descrs)) as E;
    this.props = config.props || ({} as P);
  }

  mount(target: HTMLElement, options?: MountOptions): Promise<Component<P, E> & InstanceType<T>> {
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

  makeNode(Component: ComponentConstructor, props: any): ComponentNode {
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

export async function mount<T extends abstract new (...args: any) => any = any, P = any, E = any>(
  C: T & ComponentConstructor<P, E>,
  target: HTMLElement,
  config: AppConfig<P, E> & MountOptions = {}
): Promise<Component<P, E> & InstanceType<T>> {
  return new App(C, config).mount(target, config);
}
