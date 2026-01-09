import { OwlError } from "../common/owl_error";
import { getCurrent } from "./component_node";
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

export class PluginManager {
  // kind of public to make it possible to manipulate from the outside
  static current: PluginManager | null = null;
  private children: PluginManager[] = [];
  private parent: PluginManager | null;
  private plugins: Record<string, Plugin>;
  private onDestroyCb: Function[] = [];

  status: STATUS = STATUS.NEW;

  constructor(parent?: PluginManager | null) {
    this.parent = parent || null;
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

    this.status = STATUS.DESTROYED;
  }

  getPluginById<T extends Plugin>(id: string): T | null {
    return (this.plugins[id] as T) || null;
  }

  getPlugin<T extends PluginConstructor>(pluginType: T): InstanceType<T> | null {
    return this.getPluginById<InstanceType<T>>(pluginType.id);
  }

  startPlugins(pluginTypes: PluginConstructor[]): Plugin[] {
    const previousManager = PluginManager.current;
    PluginManager.current = this;
    const plugins: Plugin[] = [];

    // instantiate plugins
    for (const pluginType of pluginTypes) {
      if (!pluginType.id) {
        PluginManager.current = previousManager;
        throw new OwlError(`Plugin "${pluginType.name}" has no id`);
      }
      if (this.plugins.hasOwnProperty(pluginType.id)) {
        const existingPluginType = this.getPluginById(pluginType.id)!.constructor;
        if (existingPluginType !== pluginType) {
          PluginManager.current = previousManager;
          throw new OwlError(
            `Trying to start a plugin with the same id as an other plugin (id: '${pluginType.id}', existing plugin: '${existingPluginType.name}', starting plugin: '${pluginType.name}')`
          );
        }
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

    PluginManager.current = previousManager;
    if (!PluginManager.current) {
      this.status = STATUS.MOUNTED;
    }
    return plugins;
  }
}

export function plugin<T extends PluginConstructor>(pluginType: T): InstanceType<T> {
  // getCurrent will throw if we're not in a component
  const manager = PluginManager.current || getCurrent().pluginManager;

  let plugin = manager.getPluginById<InstanceType<T>>(pluginType.id);
  if (!plugin) {
    if (manager === PluginManager.current) {
      manager.startPlugins([pluginType]);
      plugin = manager.getPluginById<InstanceType<T>>(pluginType.id)!;
    } else {
      throw new OwlError(`Unknown plugin "${pluginType.id}"`);
    }
  }

  return plugin;
}
