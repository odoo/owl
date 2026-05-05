import { onWillDestroy, onWillStart, PluginConstructor, PluginManager, Resource, startPlugins, STATUS } from "@odoo/owl-core";
import { getComponentScope } from "./component_node";

export { config, plugin, type PluginInstance } from "@odoo/owl-core";

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

export function providePluginManager(manager: PluginManager): void {
  const node = getComponentScope();
  node.pluginManager = manager;
}
