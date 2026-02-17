import { OwlError } from "../common/owl_error";
import { App } from "./app";
import { contextStack } from "./context";
import { untrack } from "./reactivity/computations";
import { effect } from "./reactivity/effect";
import { Resource } from "./resource";
import { STATUS } from "./status";

export interface PluginConstructor {
  new (...args: any[]): Plugin;
  id: string;
}

export class Plugin {
  private static _shadowId: string;
  static get id(): string {
    return this._shadowId ?? this.name;
  }
  static set id(shadowId: string) {
    this._shadowId = shadowId;
  }

  __owl__: PluginManager;

  constructor(manager: PluginManager) {
    this.__owl__ = manager;
  }

  setup() {}
}

interface PluginManagerOptions {
  parent?: PluginManager | null;
  config?: Record<string, any>;
}

export class PluginManager {
  app: App;
  config: Record<string, any>;
  onDestroyCb: Function[] = [];
  plugins: Record<string, Plugin>;
  status: STATUS = STATUS.NEW;

  constructor(app: App, options: PluginManagerOptions = {}) {
    this.app = app;
    this.config = options.config ?? {};

    if (options.parent) {
      const parent = options.parent;
      parent.onDestroyCb.push(() => this.destroy());
      this.plugins = Object.create(parent.plugins);
    } else {
      this.plugins = {};
    }
  }

  destroy() {
    const cbs = this.onDestroyCb;
    while (cbs.length) {
      cbs.pop()!();
    }

    this.status = STATUS.DESTROYED;
  }

  getPluginById<T extends Plugin>(id: string): T | null {
    return (this.plugins[id] as T) || null;
  }

  getPlugin<T extends PluginConstructor>(pluginConstructor: T): InstanceType<T> | null {
    return this.getPluginById<InstanceType<T>>(pluginConstructor.id);
  }

  startPlugin<T extends PluginConstructor>(pluginConstructor: T): InstanceType<T> | null {
    if (!pluginConstructor.id) {
      throw new OwlError(`Plugin "${pluginConstructor.name}" has no id`);
    }

    if (this.plugins.hasOwnProperty(pluginConstructor.id)) {
      const existingPluginType = this.getPluginById(pluginConstructor.id)!.constructor;
      if (existingPluginType !== pluginConstructor) {
        throw new OwlError(
          `Trying to start a plugin with the same id as an other plugin (id: '${pluginConstructor.id}', existing plugin: '${existingPluginType.name}', starting plugin: '${pluginConstructor.name}')`
        );
      }
      return null;
    }

    const plugin = new pluginConstructor(this);
    this.plugins[pluginConstructor.id] = plugin;
    plugin.setup();
    return plugin as InstanceType<T>;
  }

  startPlugins(pluginConstructors: PluginConstructor[]): void {
    contextStack.push({
      type: "plugin",
      app: this.app,
      manager: this,
      get status() {
        return this.manager.status;
      },
    });

    try {
      for (const pluginConstructor of pluginConstructors) {
        this.startPlugin(pluginConstructor);
      }
    } finally {
      contextStack.pop();
    }

    this.status = STATUS.MOUNTED;
  }
}

export function startPlugins(
  manager: PluginManager,
  plugins: PluginConstructor[] | Resource<PluginConstructor>
) {
  if (Array.isArray(plugins)) {
    manager.startPlugins(plugins);
  } else {
    manager.onDestroyCb.push(
      effect(() => {
        const pluginItems = plugins.items();
        untrack(() => manager.startPlugins(pluginItems));
      })
    );
  }
}
