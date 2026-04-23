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
import { nodeErrorHandlers } from "./rendering/error_handling";
import { Fiber, MountFiber, MountOptions, RootFiber } from "./rendering/fibers";
import { Scheduler } from "./rendering/scheduler";
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

import type { MountTarget } from "./blockdom";

interface Root<T extends ComponentConstructor> {
  node: ComponentNode;
  promise: Promise<ComponentInstance<T>>;
  // Kick off rendering without a DOM target. Descendants' onWillStart fires
  // immediately and the bdom is built in memory. Idempotent — second call
  // returns the same promise. Resolves when the render phase finishes.
  prepare(): Promise<void>;
  // Mount the (possibly already-prepared) bdom into target, then fire
  // onMounted hooks. If prepare() was not called, mount() prepares first.
  mount(target: MountTarget, options?: MountOptions): Promise<ComponentInstance<T>>;
  destroy(): void;
}

if (typeof window !== "undefined") {
  window.__OWL_DEVTOOLS__ ||= { apps, Fiber, RootFiber, toRaw, proxy };
}

export class App extends TemplateSet {
  static validateTarget = validateTarget;
  static apps = apps;
  static version = version;

  name: string;
  scheduler = new Scheduler();
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
      // No plugins provided: nothing to await, mark as MOUNTED so mount()
      // takes the sync fast path.
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
    let node: ComponentNode;
    let error: any = null;
    try {
      node = new ComponentNode(Root, props, this, null, null);
    } catch (e) {
      error = e;
      reject(e);
    }

    let fiber: MountFiber | null = null;
    let preparedPromise: Promise<void> | null = null;

    const prepare = (): Promise<void> => {
      if (preparedPromise) {
        return preparedPromise;
      }
      if (error) {
        return Promise.reject(error);
      }
      fiber = new MountFiber(node, null);

      // Set up error handler. We install it at prepare() time so that errors
      // during the render phase (e.g. a descendant's onWillStart rejecting)
      // reject both `promise` (the mount result) and the prepared promise.
      let handlers = nodeErrorHandlers.get(node);
      if (!handlers) {
        handlers = [];
        nodeErrorHandlers.set(node, handlers);
      }
      handlers.unshift((_, finalize) => {
        const finalError = finalize();
        reject(finalError);
      });

      const ready = new Promise<void>((res) => {
        fiber!.onPrepared = () => res();
      });
      preparedPromise = ready;

      // Install the mount-resolve callback up front so the sync render path's
      // `if (node.mounted.length)` check sees it and registers the fiber in
      // root.mounted. Without this ordering the callback would never fire for
      // the commit-after-prepare sequence.
      node.mounted.push(() => {
        resolve(node.component);
        handlers!.shift();
      });

      this.scheduler.addFiber(fiber);
      if (this.pluginManager.status < STATUS.MOUNTED) {
        // Plugins have pending onWillStart callbacks — await them before the
        // root renders, so plugin state is populated during first render.
        node.willStart.unshift(() => this.pluginManager.ready);
      }
      if (node.willStart.length) {
        node.initiateRender(fiber);
      } else {
        node.fiber = fiber;
        if (node.mounted.length) {
          fiber.root!.mounted.push(fiber);
        }
        try {
          fiber.render();
        } catch (e) {
          reject(e);
        }
      }
      return preparedPromise;
    };

    const mount = (target: MountTarget, options?: MountOptions): Promise<ComponentInstance<T>> => {
      if (error) {
        return promise;
      }
      App.validateTarget(target);
      prepare();
      fiber!.commit(target, options);
      return promise;
    };

    const root = {
      node: node!,
      promise,
      prepare,
      mount,
      destroy: () => {
        this.roots.delete(root);
        node?.destroy();
        this.scheduler.processTasks();
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
    this.scheduler.processTasks();
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
  const root = app.createRoot(C, config);
  return root.mount(target, config) as any;
}
