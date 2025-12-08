import { OwlError } from "../common/owl_error";
import { version } from "../version";
import { Component, ComponentConstructor, Props } from "./component";
import { ComponentNode, saveCurrent } from "./component_node";
import { handleError, nodeErrorHandlers } from "./rendering/error_handling";
import { Fiber, MountOptions, RootFiber } from "./rendering/fibers";
import { PluginManager } from "./plugins";
import { proxy, toRaw } from "./reactivity/proxy";
import { Scheduler } from "./rendering/scheduler";
import { TemplateSet, TemplateSetConfig } from "./template_set";
import { validateTarget } from "./utils";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

export interface Env {
  [key: string]: any;
}

interface RootConfig<P, E> {
  env?: E;
  pluginManager?: PluginManager;
  props?: P;
}

export interface AppConfig<E> extends TemplateSetConfig {
  env?: E;
  name?: string;
  pluginManager?: PluginManager;
  test?: boolean;
}

let hasBeenLogged = false;

const apps = new Set<App>();

declare global {
  interface Window {
    __OWL_DEVTOOLS__: {
      apps: Set<App>;
      Fiber: typeof Fiber;
      RootFiber: typeof RootFiber;
      toRaw: typeof toRaw;
      proxy: typeof proxy;
    };
  }
}

type MountTarget = HTMLElement | ShadowRoot;

interface Root<P extends Props, E, T extends abstract new (...args: any) => any = any> {
  node: ComponentNode<P, E>;
  promise: Promise<any>;
  mount(target: MountTarget, options?: MountOptions): Promise<Component<P, E> & InstanceType<T>>;
  destroy(): void;
}

window.__OWL_DEVTOOLS__ ||= { apps, Fiber, RootFiber, toRaw, proxy };

export class App<E = any> extends TemplateSet {
  static validateTarget = validateTarget;
  static apps = apps;
  static version = version;

  name: string;
  env: E;
  scheduler = new Scheduler();
  roots: Set<Root<any, any>> = new Set();
  pluginManager: PluginManager;

  constructor(config: AppConfig<E> = {}) {
    super(config);
    this.name = config.name || "";
    apps.add(this);
    this.pluginManager = config.pluginManager || new PluginManager(null);
    if (config.test) {
      this.dev = true;
    }
    if (this.dev && !config.test && !hasBeenLogged) {
      console.info(`Owl is running in 'dev' mode.`);
      hasBeenLogged = true;
    }
    const env = config.env || {};
    const descrs = Object.getOwnPropertyDescriptors(env);
    this.env = Object.freeze(Object.create(Object.getPrototypeOf(env), descrs));
  }

  createRoot<Props extends object, SubEnv = any>(
    Root: ComponentConstructor<Props, E>,
    config: RootConfig<Props, SubEnv> = {}
  ): Root<Props, SubEnv> {
    const props = config.props || ({} as Props);
    // hack to make sure the sub root get the sub env if necessary. for owl 3,
    // would be nice to rethink the initialization process to make sure that
    // we can create a ComponentNode and give it explicitely the env, instead
    // of looking it up in the app
    const env = this.env;
    if (config.env) {
      this.env = config.env as any;
    }

    const restore = saveCurrent();
    const node = this.makeNode(Root, props);
    restore();
    if (config.env) {
      this.env = env;
    }
    let resolve!: (value: any) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<any>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const root = {
      node,
      promise,
      mount: (target: HTMLElement | ShadowRoot, options?: MountOptions) => {
        App.validateTarget(target);
        this.mountNode(node, target, resolve, reject, options);
        return promise;
      },
      destroy: () => {
        this.roots.delete(root);
        node.destroy();
        this.scheduler.processTasks();
      },
    };
    this.roots.add(root);
    return root;
  }

  makeNode(Component: ComponentConstructor, props: any): ComponentNode {
    return new ComponentNode(Component, props, this, null, null);
  }

  mountNode(
    node: ComponentNode,
    target: HTMLElement | ShadowRoot,
    resolve: (c: any) => void,
    reject: (e: any) => void,
    options?: MountOptions
  ) {
    // Manually add the last resort error handler on the node
    let handlers = nodeErrorHandlers.get(node);
    if (!handlers) {
      handlers = [];
      nodeErrorHandlers.set(node, handlers);
    }

    handlers.unshift((e) => {
      reject(e);
      return "destroy";
    });

    // manually set a onMounted callback.
    // that way, we are independant from the current node.
    node.mounted.push(() => {
      resolve(node.component);
      handlers!.shift();
    });

    node.mountComponent(target, options);
  }

  destroy() {
    for (let root of this.roots) {
      root.destroy();
    }
    this.scheduler.processTasks();
    apps.delete(this);
  }

  createComponent<P extends Props>(
    name: string | null,
    isStatic: boolean,
    hasSlotsProp: boolean,
    hasDynamicPropList: boolean,
    propList: string[]
  ) {
    const isDynamic = !isStatic;
    let arePropsDifferent: (p1: Object, p2: Object) => boolean;
    const hasNoProp = propList.length === 0;
    if (hasSlotsProp) {
      arePropsDifferent = (_1, _2) => true;
    } else if (hasDynamicPropList) {
      arePropsDifferent = function (props1: Props, props2: Props) {
        for (let k in props1) {
          if (props1[k] !== props2[k]) {
            return true;
          }
        }
        return Object.keys(props1).length !== Object.keys(props2).length;
      };
    } else if (hasNoProp) {
      arePropsDifferent = (_1: any, _2: any) => false;
    } else {
      arePropsDifferent = function (props1: Props, props2: Props) {
        for (let p of propList) {
          if (props1[p] !== props2[p]) {
            return true;
          }
        }
        return false;
      };
    }

    const updateAndRender = ComponentNode.prototype.updateAndRender;
    const initiateRender = ComponentNode.prototype.initiateRender;

    return (props: P, key: string, ctx: ComponentNode, parent: any, C: any) => {
      let children = ctx.children;
      let node: any = children[key];
      if (isDynamic && node && node.component.constructor !== C) {
        node = undefined;
      }
      const parentFiber = ctx.fiber!;
      if (node) {
        if (arePropsDifferent(node.props, props) || parentFiber.deep || node.forceNextRender) {
          node.forceNextRender = false;
          updateAndRender.call(node, props, parentFiber);
        }
      } else {
        // new component
        if (isStatic) {
          const components = parent.constructor.components;
          if (!components) {
            throw new OwlError(
              `Cannot find the definition of component "${name}", missing static components key in parent`
            );
          }
          C = components[name as any];
          if (!C) {
            throw new OwlError(`Cannot find the definition of component "${name}"`);
          } else if (!(C.prototype instanceof Component)) {
            throw new OwlError(
              `"${name}" is not a Component. It must inherit from the Component class`
            );
          }
        }
        node = new ComponentNode(C, props, this, ctx, key);
        children[key] = node;
        initiateRender.call(node, new Fiber(node, parentFiber));
      }
      parentFiber.childrenMap[key] = node;
      return node;
    };
  }

  handleError(...args: Parameters<typeof handleError>) {
    return handleError(...args);
  }
}

type ComponentInstance<C extends ComponentConstructor<any, any>> = C extends new (
  ...args: any
) => infer T
  ? T
  : never;

export async function mount<
  T extends ComponentConstructor<any, any>,
  P extends object = any,
  E = any
>(
  C: T & ComponentConstructor<P, E>,
  target: MountTarget,
  config: AppConfig<E> & RootConfig<P, E> & MountOptions = {}
): Promise<ComponentInstance<T>> {
  const app = new App(config);
  const root = app.createRoot(C, config);
  return root.mount(target, config) as any;
}
