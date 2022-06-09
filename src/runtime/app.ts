import { Component, ComponentConstructor, Props } from "./component";
import { ComponentNode } from "./component_node";
import { nodeErrorHandlers } from "./error_handling";
import { Fiber, MountOptions } from "./fibers";
import { Scheduler } from "./scheduler";
import { STATUS } from "./status";
import { validateProps } from "./template_helpers";
import { TemplateSet, TemplateSetConfig } from "./template_set";
import { validateTarget } from "./utils";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

export interface Env {
  [key: string]: any;
}

export interface AppConfig<P, E> extends TemplateSetConfig {
  props?: P;
  env?: E;
  test?: boolean;
  warnIfNoStaticProps?: boolean;
}

let hasBeenLogged = false;

export const DEV_MSG = () => {
  const hash = (window as any).owl ? (window as any).owl.__info__.hash : "master";

  return `Owl is running in 'dev' mode.

This is not suitable for production use.
See https://github.com/odoo/owl/blob/${hash}/doc/reference/app.md#configuration for more information.`;
};

export class App<
  T extends abstract new (...args: any) => any = any,
  P extends object = any,
  E = any
> extends TemplateSet {
  static validateTarget = validateTarget;

  Root: ComponentConstructor<P, E>;
  props: P;
  env: E;
  scheduler = new Scheduler();
  root: ComponentNode<P, E> | null = null;
  warnIfNoStaticProps: boolean;

  constructor(Root: ComponentConstructor<P, E>, config: AppConfig<P, E> = {}) {
    super(config);
    this.Root = Root;
    if (config.test) {
      this.dev = true;
    }
    this.warnIfNoStaticProps = config.warnIfNoStaticProps || false;
    if (this.dev && !config.test && !hasBeenLogged) {
      console.info(DEV_MSG());
      hasBeenLogged = true;
    }
    const env = config.env || {};
    const descrs = Object.getOwnPropertyDescriptors(env);
    this.env = Object.freeze(Object.create(Object.getPrototypeOf(env), descrs));
    this.props = config.props || ({} as P);
  }

  mount(target: HTMLElement, options?: MountOptions): Promise<Component<P, E> & InstanceType<T>> {
    App.validateTarget(target);
    if (this.dev) {
      validateProps(this.Root, this.props, { __owl__: { app: this } });
    }
    const node = this.makeNode(this.Root, this.props);
    const prom = this.mountNode(node, target, options);
    this.root = node;
    return prom;
  }

  makeNode(Component: ComponentConstructor, props: any): ComponentNode {
    return new ComponentNode(Component, props, this, null, null);
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
      this.scheduler.flush();
      this.root.destroy();
    }
  }

  createComponent<P extends Props>(
    name: string | null,
    isStatic: boolean,
    hasSlotsProp: boolean,
    hasDynamicPropList: boolean
  ) {
    const isDynamic = !isStatic;
    function _arePropsDifferent(props1: Props, props2: Props): boolean {
      for (let k in props1) {
        if (props1[k] !== props2[k]) {
          return true;
        }
      }
      return hasDynamicPropList && Object.keys(props1).length !== Object.keys(props2).length;
    }
    const arePropsDifferent = hasSlotsProp ? () => true : _arePropsDifferent;

    return (props: P, key: string, ctx: ComponentNode, parent: any, C: any) => {
      let children = ctx.children;
      let node: any = children[key];

      if (node && node.status === STATUS.DESTROYED) {
        node = undefined;
      }
      if (isDynamic && node && node.component.constructor !== C) {
        node = undefined;
      }

      const parentFiber = ctx.fiber!;
      if (node) {
        let shouldRender = node.forceNextRender;
        if (shouldRender) {
          node.forceNextRender = false;
        } else {
          const currentProps = node.props;
          shouldRender = parentFiber.deep || arePropsDifferent(currentProps, props);
        }
        if (shouldRender) {
          node.updateAndRender(props, parentFiber);
        }
      } else {
        // new component
        if (isStatic) {
          C = parent.constructor.components[name as any];
          if (!C) {
            throw new Error(`Cannot find the definition of component "${name}"`);
          } else if (!(C.prototype instanceof Component)) {
            throw new Error(
              `"${name}" is not a Component. It must inherit from the Component class`
            );
          }
        }
        node = new ComponentNode(C, props, this, ctx, key);
        children[key] = node;
        node.initiateRender(new Fiber(node, parentFiber));
      }
      parentFiber.childrenMap[key] = node;
      return node;
    };
  }
}

export async function mount<
  T extends abstract new (...args: any) => any = any,
  P extends object = any,
  E = any
>(
  C: T & ComponentConstructor<P, E>,
  target: HTMLElement,
  config: AppConfig<P, E> & MountOptions = {}
): Promise<Component<P, E> & InstanceType<T>> {
  return new App(C, config).mount(target, config);
}
