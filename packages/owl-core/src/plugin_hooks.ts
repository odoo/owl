import { OwlError } from "./owl_error";
import { PluginConstructor, PluginManager } from "./plugin_manager";
import { useScope } from "./scope";
import { types } from "./types";
import { assertType } from "./validation";

export type PluginInstance<T extends PluginConstructor> = Omit<InstanceType<T>, "setup">;

export function plugin<T extends PluginConstructor>(pluginType: T): PluginInstance<T> {
  const scope = useScope();

  let plugin = scope.pluginManager.getPluginById<InstanceType<T>>(pluginType.id);
  if (!plugin) {
    if (scope instanceof PluginManager) {
      plugin = scope.pluginManager.startPlugin(pluginType)!;
    } else {
      throw new OwlError(`Unknown plugin "${pluginType.id}"`);
    }
  }

  return plugin;
}

export function config(key: string): any;
export function config<T>(key: string, type: T): T;
export function config<T>(key: string, type: T, defaultValue: T): T;
export function config(key: string, type?: any, defaultValue?: any): any {
  const scope = useScope();
  if (!(scope instanceof PluginManager)) {
    throw new OwlError("Expected to be in a plugin scope");
  }
  if (scope.app.dev && type) {
    // default needs validation
    assertType(scope.config, types.object({ [key]: type }), "Config does not match the type");
  }
  const configValue = scope.config[key.endsWith("?") ? key.slice(0, -1) : key];
  return configValue === undefined ? defaultValue : configValue;
}
