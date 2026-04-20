import { OwlError } from "../common/owl_error";
import { ComponentNode, getComponentScope } from "./component_node";
import { onWillDestroy, onWillStart } from "./lifecycle_hooks";
import { startPlugins, PluginConstructor, PluginManager } from "./plugin_manager";
import { Resource } from "./resource";
import { useScope } from "./scope";
import { STATUS } from "./status";
import { types } from "./types";
import { assertType } from "./validation";

export type PluginInstance<T extends PluginConstructor> = Omit<InstanceType<T>, "setup">;

export function plugin<T extends PluginConstructor>(pluginType: T): PluginInstance<T> {
  const scope = useScope();
  const manager = scope instanceof ComponentNode ? scope.pluginManager : (scope as PluginManager);

  let plugin = manager.getPluginById<InstanceType<T>>(pluginType.id);
  if (!plugin) {
    if (scope instanceof PluginManager) {
      plugin = manager.startPlugin(pluginType)!;
    } else {
      throw new OwlError(`Unknown plugin "${pluginType.id}"`);
    }
  }

  return plugin;
}

export function config<T = any>(name: string, type?: T): T {
  const scope = useScope();
  if (!(scope instanceof PluginManager)) {
    throw new OwlError("Expected to be in a plugin scope");
  }
  if (scope.app.dev && type) {
    assertType(scope.config, types.object({ [name]: type }), "Config does not match the type");
  }
  return scope.config[name.endsWith("?") ? name.slice(0, -1) : name];
}

export function providePlugins(
  pluginConstructors: PluginConstructor[] | Resource<PluginConstructor>,
  config?: Record<string, any>
) {
  const node = getComponentScope();

  const manager = new PluginManager(node.app, { parent: node.pluginManager, config });
  node.pluginManager = manager;
  onWillDestroy(() => manager.destroy());

  startPlugins(manager, pluginConstructors);

  if (manager.status < STATUS.MOUNTED) {
    // Provided plugins registered onWillStart — defer the owning component's
    // first render until they resolve.
    onWillStart(() => manager.ready);
  }
}
