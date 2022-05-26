import { Schema } from "./validation";
import type { ComponentNode } from "./component_node";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

type Props = { [key: string]: any };

interface StaticComponentProperties {
  template: string;
  defaultProps?: any;
  props?: Schema;
  components?: { [componentName: string]: ComponentConstructor };
}

export type ComponentConstructor<P extends Props = any, E = any> = (new (
  props: P,
  env: E,
  node: ComponentNode
) => Component<P, E>) &
  StaticComponentProperties;

export class Component<Props = any, Env = any> {
  static template: string = "";
  static props?: any;
  static defaultProps?: any;

  props: Props;
  env: Env;
  __owl__: ComponentNode;

  constructor(props: Props, env: Env, node: ComponentNode) {
    this.props = props;
    this.env = env;
    this.__owl__ = node;
  }

  setup() {}

  render(deep: boolean = false) {
    this.__owl__.render(deep === true);
  }
}
