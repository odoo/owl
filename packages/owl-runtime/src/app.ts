import { version } from "./version";
import { ComponentConstructor } from "./component";
import { ComponentNode } from "./component_node";
import { GetProps } from "./props";
import {
  PluginConstructor,
  PluginManager,
  proxy,
  Resource,
  startPlugins,
  STATUS,
  toRaw,
} from "@odoo/owl-core";
import { mountTree } from "./rendering/content";
import { nodeErrorHandlers } from "./rendering/error_handling";
import { TemplateSet, TemplateSetConfig } from "./template_set";
import { validateTarget } from "./utils";

type ComponentInstance<C extends ComponentConstructor> = C extends new (...args: any) => infer T
  ? T
  : never;

export type MountTarget = HTMLElement | ShadowRoot;

type Position = "first-child" | "last-child";

export interface MountOptions {
  position?: Position;
  // If set, the root is inserted immediately before this node inside `target`
  // (ignoring `position`).
  afterNode?: Node | null;
}

interface RootConfig<P> {
  props?: P;
}

// Internal-only options (e.g. for sub-roots)
interface SubRootConfig<P> extends RootConfig<P> {
  pluginManager?: PluginManager;
  onError?: (error: any, finalize: Function) => void;
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
      toRaw: typeof toRaw;
      proxy: typeof proxy;
    };
  }
}

interface Root<T extends ComponentConstructor> {
  promise: Promise<ComponentInstance<T>>;
  readonly prepared: boolean;
  readonly destroyed: boolean;
  prepare(): Promise<void>;
  mount(target: MountTarget, options?: MountOptions): Promise<ComponentInstance<T>>;
  destroy(): void;
}

if (typeof window !== "undefined") {
  window.__OWL_DEVTOOLS__ ||= { apps, toRaw, proxy };
}

export class App extends TemplateSet {
  static validateTarget = validateTarget;
  static apps = apps;
  static version = version;

  name: string;
  roots: Set<Root<any>> = new Set();
  pluginManager: PluginManager;
  destroyed = false;

  constructor(config: AppConfig = {}) {
    super(config);
    this.name = config.name || "";
    apps.add(this);
    this.pluginManager = new PluginManager(this, { config: config.config });
    if (config.plugins) {
      startPlugins(this.pluginManager, config.plugins);
    } else {
      this.pluginManager.status = STATUS.MOUNTED;
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
    const subConfig = config as SubRootConfig<any>;
    let node: ComponentNode | null = null;
    let error: any = null;
    try {
      node = new ComponentNode(
        Root,
        props,
        this,
        subConfig.pluginManager || this.pluginManager,
        null,
        null
      );
    } catch (e) {
      error = e;
      reject(e);
    }

    if (node) {
      const n = node;
      // setup may already have registered onError handlers
      let handlers = nodeErrorHandlers.get(n);
      if (!handlers) {
        handlers = [];
        nodeErrorHandlers.set(n, handlers);
      }
      if (subConfig.onError) {
        handlers.unshift(subConfig.onError);
      }
      // until the root is mounted, an unhandled error rejects its promise
      const rejectMount = (_: any, finalize: Function) => {
        reject(finalize());
      };
      handlers.unshift(rejectMount);
      n.mounted.push(() => {
        resolve(n.component);
        const index = handlers.indexOf(rejectMount);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      });
      if (this.pluginManager.status < STATUS.MOUNTED) {
        n.willStart.unshift(() => this.pluginManager.ready);
      }
    }

    let started = false;
    let destroyed = false;
    let preparedPromise: Promise<void> | null = null;

    const prepare = (): Promise<void> => {
      if (preparedPromise) {
        return preparedPromise;
      }
      if (error) {
        return Promise.reject(error);
      }
      if (destroyed) {
        return (preparedPromise = Promise.resolve());
      }
      started = true;
      try {
        node!.start();
      } catch (e) {
        reject(e);
        return (preparedPromise = Promise.reject(e));
      }
      return (preparedPromise = node!.whenReady());
    };

    const mount = (target: MountTarget, options: MountOptions = {}): Promise<any> => {
      if (destroyed || error) {
        return promise;
      }
      App.validateTarget(target);
      prepare().then(() => {
        const n = node!;
        if (destroyed || this.destroyed || n.status !== STATUS.NEW || n.inserted) {
          return;
        }
        // the target may have been detached while waiting for onWillStart
        App.validateTarget(target);
        let ref: Node | null = null;
        if (options.afterNode !== undefined) {
          ref = options.afterNode;
        } else if (options.position === "first-child") {
          ref = target.firstChild;
        }
        n.mount(target, ref);
        n.inserted = true;
        mountTree(n);
      }, reject);
      return promise;
    };

    const root = {
      get prepared() {
        return started && !!node && node.pendingCount === 0;
      },
      get destroyed() {
        return destroyed;
      },
      promise,
      prepare,
      mount,
      destroy: () => {
        if (destroyed) {
          return;
        }
        destroyed = true;
        this.roots.delete(root);
        node?.destroy();
      },
    };
    this.roots.add(root);
    return root;
  }

  destroy() {
    for (let root of this.roots) {
      root.destroy();
    }
    this.pluginManager.destroy();
    apps.delete(this);
    this.destroyed = true;
  }

  _handleError(error: any) {
    throw error;
  }
}

export async function mount<T extends ComponentConstructor>(
  C: T,
  target: MountTarget,
  config: AppConfig & RootConfig<GetProps<ComponentInstance<T>>> & MountOptions = {}
): Promise<ComponentInstance<T>> {
  const app = new App(config);
  if (app.pluginManager.status < STATUS.MOUNTED) {
    await app.pluginManager.ready;
  }
  const root = app.createRoot(C, config);
  return root.mount(target, config) as any;
}
