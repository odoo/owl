import { effect } from "./effect";
import { OwlError } from "./owl_error";
import { Resource } from "./resource";
import { Scope, scopeStack } from "./scope";
import { STATUS } from "./status";
import { untrack } from "./computations";

export interface PluginConstructor {
  new (...args: any[]): Plugin;
  id: string;
  sequence: number;
  /**
   * Optional factory producing a specialized view of the plugin for a
   * consumer scope. When defined, `usePlugin` returns
   * `scoped(plugin, scope)` instead of the plugin itself, where `scope` is
   * the caller's scope (a component node or a plugin manager). Typical use:
   * wrap async methods with `scope.run` so their results are guarded by the
   * consumer's lifetime, and expose the raw instance as an escape hatch:
   *
   * ```ts
   * class ORM extends Plugin {
   *   static scoped(self: ORM, scope: Scope): ORM {
   *     return Object.assign(Object.create(self), {
   *       read: scope.run.bind(scope, self.read),
   *     });
   *   }
   *   unscoped = this;
   *   read = async (...) => { ... };
   * }
   * ```
   *
   * Called once per `usePlugin` call — the returned view is not cached.
   * It is a static (not an instance method) so the scoped view, usually
   * created with `Object.create(plugin)`, does not inherit it.
   */
  scoped?(plugin: any, scope: Scope): object;
}

export class Plugin {
  private static _shadowId: string;
  static get id(): string {
    return this._shadowId ?? this.name;
  }
  static set id(shadowId: string) {
    this._shadowId = shadowId;
  }

  // Plugins passed to `startPlugins` are started in batches of equal sequence,
  // ascending (lower first), like Resource/Registry. Each batch's onWillStart
  // callbacks fully settle before the next batch is instantiated, so
  // foundational plugins (low sequence) are ready before later plugins even
  // run their setup. Explicit `plugin(X)` dependencies bypass batching and
  // start immediately.
  static sequence = 50;

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

  // Resolves once all batches of plugins have started and their willStart
  // callbacks have settled. The scope transitions to MOUNTED as the last step
  // of this chain. Consumers (the root's mount(), providePlugins) await this
  // before treating the manager as ready. `willStart` itself is inherited
  // from Scope.
  ready: Promise<void> = Promise.resolve();
  private hasPendingReady = false;

  constructor(app: any, options: PluginManagerOptions = {}) {
    super(app);
    this.config = options.config ?? {};
    this.pluginManager = this;

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
    const fresh = pluginConstructors.filter((ctor) => {
      if (!ctor.id || this.plugins.hasOwnProperty(ctor.id)) {
        // already started (or invalid): startPlugin throws on missing ids and
        // id conflicts, and is a no-op otherwise
        this.startPlugin(ctor);
        return false;
      }
      return true;
    });
    if (!fresh.length) {
      return;
    }
    // Sort ascending by sequence and group plugins of equal sequence into
    // batches. A batch's willStart callbacks all settle before the next batch
    // is even instantiated, so foundational (low sequence) plugins are fully
    // ready before later plugins run their setup.
    fresh.sort((p1, p2) => p1.sequence - p2.sequence);
    const batches: PluginConstructor[][] = [];
    for (const ctor of fresh) {
      const batch = batches[batches.length - 1];
      if (batch && batch[0].sequence === ctor.sequence) {
        batch.push(ctor);
      } else {
        batches.push([ctor]);
      }
    }

    // Instantiate one batch synchronously (its own scopeStack push/pop, never
    // spanning an await) and return its pending willStart promise, if any.
    const startBatch = (batch: PluginConstructor[]): Promise<unknown> | null => {
      scopeStack.push(this);
      try {
        for (const ctor of batch) {
          this.startPlugin(ctor);
        }
      } finally {
        scopeStack.pop();
      }
      const pending = this.willStart.splice(0);
      return pending.length ? Promise.all(pending.map((fn) => fn())) : null;
    };

    // Chain onto a still-pending `ready` (re-entrant call, e.g. a plugin added
    // to a Resource while startup is in flight) so new plugins wait for the
    // previous batches.
    let chain: Promise<unknown> | null = this.hasPendingReady ? this.ready : null;
    for (const batch of batches) {
      if (chain) {
        // Later batches are instantiated inside the previous batch's `then` so
        // that a rejection skips them entirely.
        chain = chain.then(() => startBatch(batch));
      } else {
        // No async work pending so far: start the batch synchronously.
        chain = startBatch(batch);
      }
    }
    if (!chain) {
      if (this.status < STATUS.MOUNTED) {
        // Fast path: no async init, transition synchronously so consumers that
        // read `status` right after `startPlugins` see MOUNTED immediately.
        this.status = STATUS.MOUNTED;
      }
      return;
    }
    this.hasPendingReady = true;
    const ready = (this.ready = chain.then(() => {
      if (this.status < STATUS.MOUNTED) {
        this.status = STATUS.MOUNTED;
      }
      if (this.ready === ready) {
        this.hasPendingReady = false;
      }
      // Note: no rejection handler here. On failure, `ready` stays rejected
      // and `hasPendingReady` stays true, so later startPlugins calls chain
      // onto the rejected promise and are skipped, and the error surfaces as
      // an unhandled rejection when no consumer awaits `ready`.
    }));
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
