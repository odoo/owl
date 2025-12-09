import { OwlError } from "../common/owl_error";
import { getCurrent } from "./component_node";

let currentPluginManager: PluginManager | null = null;

export const _getCurrentPluginManager = () => currentPluginManager;

export interface PluginConstructor {
  new (): Plugin;
  id: string;
}

export class Plugin {
  static id: string = "";

  setup() {}
}

export class PluginManager {
  private children: PluginManager[] = [];
  private parent: PluginManager | null;
  private plugins: Record<string, Plugin>;
  private onDestroyCb: Function[] = [];

  constructor(parent: PluginManager | null) {
    this.parent = parent;
    this.parent?.children.push(this);
    this.plugins = this.parent ? Object.create(this.parent.plugins) : {};
  }

  destroy() {
    for (let children of this.children) {
      children.destroy();
    }

    const cbs = this.onDestroyCb;
    while (cbs.length) {
      cbs.pop()!();
    }
  }

  getPluginById<T extends Plugin>(id: string): T | null {
    return (this.plugins[id] as T) || null;
  }

  getPlugin<T extends PluginConstructor>(pluginType: T): InstanceType<T> | null {
    return this.getPluginById<InstanceType<T>>(pluginType.id);
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

      const plugin = new pluginType();
      this.plugins[pluginType.id] = plugin;
      plugins.push(plugin);
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

  let plugin = manager.getPluginById<InstanceType<T>>(pluginType.id);
  if (!plugin) {
    if (manager === currentPluginManager) {
      manager.startPlugins([pluginType]);
      plugin = manager.getPluginById<InstanceType<T>>(pluginType.id)!;
    } else {
      throw new OwlError(`Unknown plugin "${pluginType.id}"`);
    }
  }

  return plugin;
}
