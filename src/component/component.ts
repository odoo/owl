import type { ComponentNode } from "./component_node";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

export class Component<Props = any, Env = any> {
  static template: string = "";
  static props?: any;

  props: Props;
  env: Env;
  __owl__: ComponentNode;

  constructor(props: Props, env: Env, node: ComponentNode) {
    this.props = props;
    this.env = env;
    this.__owl__ = node;
  }

  setup() {}

  render(force: boolean = false) {
    this.__owl__.render(force);
  }
}
