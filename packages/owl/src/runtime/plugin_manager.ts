import { OwlError } from "../common/owl_error";
import type { App } from "./app";
import { untrack } from "./reactivity/computations";
import { effect } from "./reactivity/effect";
import { Resource } from "./resource";
import { Scope, scopeStack } from "./scope";
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

export class PluginManager extends Scope {
  config: Record<string, any>;
  plugins: Record<string, Plugin>;

  constructor(app: App, options: PluginManagerOptions = {}) {
    super(app);
    this.config = options.config ?? {};

    if (options.parent) {
      const parent = options.parent;
      parent.onDestroy(() => this.destroy());
      this.plugins = Object.create(parent.plugins);
    } else {
      this.plugins = {};
    }
  }

  destroy() {
    this.finalize((e) => console.error(e));
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
    scopeStack.push(this);
    try {
      for (const pluginConstructor of pluginConstructors) {
        this.startPlugin(pluginConstructor);
      }
    } finally {
      scopeStack.pop();
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
    manager.onDestroy(
      effect(() => {
        const pluginItems = plugins.items();
        untrack(() => manager.startPlugins(pluginItems));
      })
    );
  }
}
