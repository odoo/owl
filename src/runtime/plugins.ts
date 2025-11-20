// import { PluginCtor } from "./component";
import { getCurrent } from "./component_node";
import { onWillDestroy } from "./lifecycle_hooks";
import { reactive } from "./reactivity";
import { derived } from "./signals";

export interface PluginCtor {
  new (deps: any): Plugin<any>;
  id: string;
  dependencies: string[];
}

interface PluginMetaData {
  isDestroyed: boolean;
  //   manager: PluginManager;
}

export class Plugin<Deps = { [name: string]: Plugin }> {
  static id: string = "";
  static dependencies: string[] = [];

  readonly plugins: Deps = {} as any;

  // can act and replace another plugin
  // static replaceOtherPlugin: null | string = null;

  // can define the type of resources, and some information, such as, is the
  // resource global or not
  static resources = {};

  resources: { [name: string]: any } = {};

  __meta__: PluginMetaData = { isDestroyed: false };

  setup() {}

  destroy() {}

  get isDestroyed(): boolean {
    return this.__meta__.isDestroyed;
  }
  // getResource(name: string) {
  //   // todo
  // }

  // dispatchTo(resourceName, ...args) {
  //   for (let handler of this.getResource(name)) {
  //     if (typeof handler === "function") {
  //       handler(...args);
  //     } else {
  //       throw new Error("resource value should be a function")
  //     }
  //   }
  // }
}

export class PluginManager {
  _parent: PluginManager | null;
  _children: PluginManager[] = [];
  plugins: { [id: string]: Plugin };
  resources: { [id: string]: any };

  constructor(parent: PluginManager | null, Plugins: PluginCtor[] | (() => PluginCtor[])) {
    this._parent = parent;
    parent?._children.push(this);
    this.plugins = parent ? Object.create(parent.plugins) : {};
    this.resources = parent ? Object.create(parent.resources) : {};

    // instantiate all plugins
    const plugins = [];
    const PLUGINS = Array.isArray(Plugins) ? Plugins : Plugins();
    for (let P of toposort(PLUGINS, this.plugins)) {
      if ((P as any).resources) {
        for (let r in (P as any).resources) {
          const sources: { [key: string]: Plugin } = reactive({});
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
      }
      const p = new (P as any)();
      plugins.push(p);
      this.plugins[P.id] = p;
      for (let dep of P.dependencies) {
        p.plugins[dep] = this.plugins[dep];
      }
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
  }

  destroy() {
    for (let children of this._children) {
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
    while (plugins.length) {
      const plugin = plugins.pop()!;
      plugin.destroy();
      plugin.__meta__.isDestroyed = true;
    }
  }

  getPlugin(name: string): Plugin | null {
    return this.plugins[name] || null;
  }

  getResource(name: string): any[] {
    return this.resources[name].fn();
  }
}

function toposort(Plugins: PluginCtor[], plugins: { [id: string]: Plugin }): PluginCtor[] {
  const visited = new Set<string>();
  const temp = new Set<string>();
  const sorted: typeof Plugin[] = [];

  const mapping: Record<string, typeof Plugin> = {};
  for (const P of Plugins) {
    if (!P.id.length) {
      throw new Error(`Plugin ${P.name} has no id`);
    }
    if (P.id in mapping) {
      throw new Error("A plugin with the same ID is already defined");
    }
    mapping[P.id] = P as any;
  }

  const visit = (P: typeof Plugin) => {
    if (visited.has(P.id)) return;
    if (temp.has(P.id)) {
      throw new Error(`Circular dependency: ${P.id}`);
    }
    temp.add(P.id);
    for (const dep of P.dependencies || []) {
      const Dep = mapping[dep];
      if (Dep) {
        visit(Dep);
      } else {
        if (!(dep in plugins)) {
          throw new Error(`Missing dependency "${dep}" for plugin "${P.id}"`);
        }
      }
    }
    temp.delete(P.id);
    visited.add(P.id);
    sorted.push(P);
  };

  for (const P of Plugins) {
    visit(P as any);
  }
  return sorted;
}

export function usePlugins(Plugins: PluginCtor[]) {
  const node = getCurrent();

  const manager = new PluginManager(node.pluginManager, Plugins);
  node.pluginManager = manager;
  node.component.plugins = manager.plugins;
  onWillDestroy(() => manager.destroy());
}
