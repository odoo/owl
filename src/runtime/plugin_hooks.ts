import { OwlError } from "../common/owl_error";
import { getContext } from "./context";
import { onWillDestroy } from "./lifecycle_hooks";
import { PluginConstructor, PluginManager } from "./plugin_manager";
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

declare const inputSymbol: unique symbol;
export type PluginInput<K extends string, T> = T & { [inputSymbol]: true };

export type GetPluginInputs<T> = {
  [P in keyof T as T[P] extends PluginInput<infer K, infer I /* magic! */>
    ? K
    : never]: T[P] extends PluginInput<string, infer I> ? I : never;
};

export function input<const K extends string, T>(name: K, type?: T): PluginInput<K, T> {
  const { app, manager } = getContext("plugin");
  const value = manager.inputs[name];
  if (app.dev) {
    assertType(value, type, "Plugin input value does not match the type");
  }
  return value;
}

type GetPluginsInputs<T extends PluginConstructor[]> = {
  [I in keyof T]: (x: GetPluginInputs<InstanceType<T[I]>>) => void;
} extends {
  [K: number]: (x: infer I) => void;
}
  ? I
  : never;
type PrettifyShape<T> = T extends Function ? T : { [K in keyof T]: T[K] };

export function providePlugins<const P extends PluginConstructor[]>(
  pluginConstructors: P,
  inputs?: PrettifyShape<GetPluginsInputs<P>>
) {
  const { node } = getContext("component");

  const manager = new PluginManager(node.app, { parent: node.pluginManager, inputs });
  node.pluginManager = manager;
  onWillDestroy(() => manager.destroy());

  manager.startPlugins(pluginConstructors);
}
