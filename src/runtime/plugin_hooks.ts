import { OwlError } from "../common/owl_error";
import { getContext } from "./context";
import { onWillDestroy } from "./lifecycle_hooks";
import { startPlugins, PluginConstructor, PluginManager } from "./plugin_manager";
import { Resource } from "./resource";
import { types } from "./types";
import { assertType } from "./validation";

export type PluginInstance<T extends PluginConstructor> = Omit<InstanceType<T>, "setup">;

export function plugin<T extends PluginConstructor>(pluginType: T): PluginInstance<T> {
  const context = getContext();
  const manager = context.type === "component" ? context.node.pluginManager : context.manager;

  let plugin = manager.getPluginById<InstanceType<T>>(pluginType.id);
  if (!plugin) {
    if (context.type === "plugin") {
      plugin = manager.startPlugin(pluginType)!;
    } else {
      throw new OwlError(`Unknown plugin "${pluginType.id}"`);
    }
  }

  return plugin;
}

export function config<T = any>(name: string, type?: T): T {
  const { app, manager } = getContext("plugin");
  if (app.dev && type) {
    assertType(manager.config, types.object({ [name]: type }), "Config does not match the type");
  }
  return manager.config[name.endsWith("?") ? name.slice(0, -1) : name];
}

export function providePlugins(
  pluginConstructors: PluginConstructor[] | Resource<PluginConstructor>,
  config?: Record<string, any>
) {
  const { node } = getContext("component");

  const manager = new PluginManager(node.app, { parent: node.pluginManager, config });
  node.pluginManager = manager;
  onWillDestroy(() => manager.destroy());

  startPlugins(manager, pluginConstructors);
}
