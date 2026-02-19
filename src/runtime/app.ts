import { version } from "../version";
import { ComponentConstructor } from "./component";
import { ComponentNode } from "./component_node";
import { saveContext } from "./context";
import { PluginConstructor, PluginManager, startPlugins } from "./plugin_manager";
import { GetProps } from "./props";
import { proxy, toRaw } from "./reactivity/proxy";
import { handleError, nodeErrorHandlers } from "./rendering/error_handling";
import { Fiber, MountOptions, RootFiber } from "./rendering/fibers";
import { Scheduler } from "./rendering/scheduler";
import { Resource } from "./resource";
import { TemplateSet, TemplateSetConfig } from "./template_set";
import { validateTarget } from "./utils";

// reimplement dev mode stuff see last change in 0f7a8289a6fb8387c3c1af41c6664b2a8448758f

type ComponentInstance<C extends ComponentConstructor> = C extends new (...args: any) => infer T
  ? T
  : never;

interface RootConfig<P> {
  props?: P;
}

export interface AppConfig extends TemplateSetConfig {
  name?: string;
  plugins?: PluginConstructor[] | Resource<PluginConstructor>;
  config?: Record<string, any>;
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
    this.pluginManager = new PluginManager(this, { config: config.config });
    if (config.plugins) {
      startPlugins(this.pluginManager, config.plugins);
    }
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
    const restore = saveContext();
    let node: ComponentNode;
    let error: any = null;
    try {
      node = new ComponentNode(Root, props, this, null, null);
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

  private mountNode(
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
    this.pluginManager.destroy();
    this.scheduler.processTasks();
    apps.delete(this);
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
