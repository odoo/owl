import { OwlError } from "../common/owl_error";
import { version } from "../version";
import { Component, ComponentConstructor } from "./component";
import { ComponentNode, saveCurrent } from "./component_node";
import { handleError, nodeErrorHandlers } from "./rendering/error_handling";
import { Fiber, MountOptions, RootFiber } from "./rendering/fibers";
import { PluginManager } from "./plugins";
import { proxy, toRaw } from "./reactivity/proxy";
import { Scheduler } from "./rendering/scheduler";
import { TemplateSet, TemplateSetConfig } from "./template_set";
import { validateTarget } from "./utils";
import { GetProps } from "./props";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

type ComponentInstance<C extends ComponentConstructor> = C extends new (...args: any) => infer T
  ? T
  : never;

interface RootConfig<P> {
  pluginManager?: PluginManager;
  props?: P;
}

export interface AppConfig extends TemplateSetConfig {
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

interface Root<T extends ComponentConstructor> {
  node: ComponentNode;
  promise: Promise<ComponentInstance<T>>;
  mount(target: MountTarget, options?: MountOptions): Promise<ComponentInstance<T>>;
  destroy(): void;
}

window.__OWL_DEVTOOLS__ ||= { apps, Fiber, RootFiber, toRaw, proxy };

export class App extends TemplateSet {
  static validateTarget = validateTarget;
  static apps = apps;
  static version = version;

  name: string;
  scheduler = new Scheduler();
  roots: Set<Root<any>> = new Set();
  pluginManager: PluginManager;

  constructor(config: AppConfig = {}) {
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
  }

  createRoot<T extends ComponentConstructor>(
    Root: T,
    config: RootConfig<GetProps<ComponentInstance<T>>> = {}
  ): Root<T> {
    const props = config.props || ({} as any);
    let resolve!: (value: any) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<any>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const restore = saveCurrent();
    let node: ComponentNode;
    let error: any = null;
    try {
      node = this.makeNode(Root, props);
    } catch (e) {
      error = e;
      reject(e);
    } finally {
      restore();
    }

    const root = {
      node: node!,
      promise,
      mount: (target: HTMLElement | ShadowRoot, options?: MountOptions) => {
        if (error) {
          return promise;
        }
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

  makeNode<T extends ComponentConstructor>(
    Component: T,
    props: GetProps<ComponentInstance<T>>
  ): ComponentNode {
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

    handlers.unshift((e, finalize) => {
      const finalError = finalize();
      reject(finalError);
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

  createComponent<P extends Record<string, any>>(
    name: string | null,
    isStatic: boolean,
    hasSlotsProp: boolean,
    hasDynamicPropList: boolean,
    propList: string[]
  ) {
    const isDynamic = !isStatic;
    let arePropsDifferent: (p1: P, p2: P) => boolean;
    const hasNoProp = propList.length === 0;
    if (hasSlotsProp) {
      arePropsDifferent = (_1, _2) => true;
    } else if (hasDynamicPropList) {
      arePropsDifferent = function (props1: P, props2: P) {
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
      arePropsDifferent = function (props1: P, props2: P) {
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

export async function mount<T extends ComponentConstructor>(
  C: T,
  target: MountTarget,
  config: AppConfig & RootConfig<GetProps<ComponentInstance<T>>> & MountOptions = {}
): Promise<ComponentInstance<T>> {
  const app = new App(config);
  const root = app.createRoot(C, config);
  return root.mount(target, config) as any;
}
