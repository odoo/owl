import { Schema } from "./validation";
import type { ComponentNode } from "./component_node";
import type { PluginManager } from "./plugins";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

export type Props = { [key: string]: any };

interface StaticComponentProperties {
  template: string;
  defaultProps?: any;
  props?: Schema;
  components?: { [componentName: string]: ComponentConstructor };
}

export type ComponentConstructor<P extends Props = any, Plugins = any, E = any> = (new (
  props: P,
  env: E,
  plugins: Plugins,
  node: ComponentNode
) => Component<P, Plugins, E>) &
  StaticComponentProperties;

export class Component<Props = any, Plugins = PluginManager["plugins"], Env = any> {
  static template: string = "";
  static props?: Schema;
  static defaultProps?: any;

  props: Props;
  env: Env;
  plugins: Plugins;
  __owl__: ComponentNode;

  constructor(props: Props, env: Env, plugins: Plugins, node: ComponentNode) {
    this.props = props;
    this.env = env;
    this.plugins = plugins;
    this.__owl__ = node;
  }

  setup() {}

  render(deep: boolean = false) {
    this.__owl__.render(deep === true);
  }
}
