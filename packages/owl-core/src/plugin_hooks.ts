import { OwlError } from "./owl_error";
import { PluginConstructor, PluginManager } from "./plugin_manager";
import { useScope } from "./scope";
import { getDefault, types, type Optional, type StripBrands, type WithDefault } from "./types";
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

export function config<T = any>(key: string): T;
export function config<T>(key: string, type: WithDefault<T>): T;
export function config<T>(key: string, type: Optional<T>): T | undefined;
export function config<T>(key: string, type: T): StripBrands<T>;
export function config(key: string, type?: any): any {
  const scope = useScope();
  if (!(scope instanceof PluginManager)) {
    throw new OwlError("Expected to be in a plugin scope");
  }
  if (scope.app.dev && type) {
    assertType(scope.config, types.object({ [key]: type }), "Config does not match the type");
  }
  const configValue = scope.config[key];
  return configValue === undefined ? getDefault(type)?.() : configValue;
}
