import { OwlError } from "../common/owl_error";
import { App } from "./app";
import { contextStack } from "./context";
import { effect } from "./reactivity/effect";
import { ReactiveValue } from "./reactivity/signal";
import { STATUS } from "./status";

export interface PluginConstructor {
  new (): Plugin;
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

  setup() {}
}

interface PluginManagerOptions {
  parent?: PluginManager | null;
  plugins?: ReactiveValue<PluginConstructor[]>;
  inputs?: Record<string, any>;
}

export class PluginManager {
  app: App;
  inputs: Record<string, any>;
  onDestroyCb: Function[] = [];
  plugins: Record<string, Plugin>;
  status: STATUS = STATUS.NEW;

  constructor(app: App, options: PluginManagerOptions = {}) {
    this.app = app;
    this.inputs = options.inputs ?? {};

    if (options.parent) {
      const parent = options.parent;
      parent.onDestroyCb.push(() => this.destroy());
      this.plugins = Object.create(parent.plugins);
    } else {
      this.plugins = {};
    }

    if (options.plugins) {
      const plugins = options.plugins;
      this.onDestroyCb.push(
        effect(() => {
          this.startPlugins(plugins());
        })
      );
    } else {
      this.status = STATUS.MOUNTED;
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

    const plugin = new pluginConstructor();
    plugin.setup();
    this.plugins[pluginConstructor.id] = plugin;
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
