import { OwlError } from "../common/owl_error";
import { getCurrent } from "./component_node";
import { derived } from "./reactivity/derived";
import { proxy } from "./reactivity/proxy";

let currentPluginManager: PluginManager | null = null;

export const _getCurrentPluginManager = () => currentPluginManager;

export interface PluginConstructor {
  new (): Plugin;
  id: string;
  resources: Record<string, any>;
}

export class Plugin {
  static id: string = "";

  // can define the type of resources, and some information, such as, is the
  // resource global or not
  static resources = {};

  resources: Record<string, any> = {};

  setup() {}
}

export class PluginManager {
  private children: PluginManager[] = [];
  private parent: PluginManager | null;
  private plugins: Record<string, Plugin>;
  private resources: Record<string, any>;

  onDestroyCb: Function[] = [];

  constructor(parent: PluginManager | null) {
    this.parent = parent;
    this.parent?.children.push(this);
    this.plugins = this.parent ? Object.create(this.parent.plugins) : {};
    this.resources = this.parent ? Object.create(this.parent.resources) : {};
  }

  destroy() {
    for (let children of this.children) {
      children.destroy();
    }

    const plugins: Plugin[] = [];
    for (let id in this.plugins) {
      if (this.plugins.hasOwnProperty(id)) {
        const plugin = this.plugins[id];
        // resources
        for (let r in plugin.resources) {
          delete this.resources[r].sources[id];
        }

        plugins.push(this.plugins[id]);
        delete this.plugins[id];
      }
    }

    const cbs = this.onDestroyCb;
    while (cbs.length) {
      cbs.pop()!();
    }
  }

  getPlugin<T extends Plugin>(name: string): T | null {
    return (this.plugins[name] as T) || null;
  }

  getResource(name: string): any[] {
    return this.resources[name].fn();
  }

  startPlugins(pluginTypes: PluginConstructor[]): Plugin[] {
    const previousManager = currentPluginManager;
    currentPluginManager = this;
    const plugins: Plugin[] = [];

    // instantiate plugins
    for (const pluginType of pluginTypes) {
      if (!pluginType.id) {
        currentPluginManager = previousManager;
        throw new OwlError(`Plugin "${pluginType.name}" has no id`);
      }
      if (this.plugins.hasOwnProperty(pluginType.id)) {
        continue;
      }

      for (let r in pluginType.resources) {
        const sources: { [key: string]: Plugin } = proxy({});
        const fn = derived(() => {
          const result = [];
          for (let name in sources) {
            const plugin = sources[name];
            const value = plugin.resources[r];
            if (Array.isArray(value)) {
              result.push(...value);
            } else {
              result.push(value);
            }
          }
          return result;
        });
        this.resources[r] = { sources, fn };
      }

      const plugin = new pluginType();
      this.plugins[pluginType.id] = plugin;
      plugins.push(plugin);
    }

    // aggregate resources
    for (let name in this.plugins) {
      const p = this.plugins[name];
      for (let r in p.resources) {
        this.resources[r].sources[name] = p;
        //     const value = p.resources[r];
        //     if (Array.isArray(value)) {
        //       this.resources[r].push(...value);
        //     } else {
        //       this.resources[r].push(value);
        // }
      }
    }

    // setup phase
    for (let p of plugins) {
      p.setup();
    }

    currentPluginManager = previousManager;
    return plugins;
  }
}

export function plugin<T extends PluginConstructor>(pluginType: T): InstanceType<T> {
  // getCurrent will throw if we're not in a component
  const manager = currentPluginManager || getCurrent().pluginManager;

  let plugin = manager.getPlugin<InstanceType<T>>(pluginType.id);
  if (!plugin) {
    if (manager === currentPluginManager) {
      manager.startPlugins([pluginType]);
      plugin = manager.getPlugin<InstanceType<T>>(pluginType.id)!;
    } else {
      throw new OwlError(`Unknown plugin "${pluginType.id}"`);
    }
  }

  return plugin;
}
