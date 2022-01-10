import type { ComponentNode } from "./component_node";

export type Props = { [key: string]: any };

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

export class Component<Props = any, Env = any> {
  static template: string = "";
  static props?: Props;

  props: Props;
  env: Env;
  __owl__: ComponentNode;

  constructor(props: Props, env: Env, node: ComponentNode) {
    this.props = props;
    this.env = env;
    this.__owl__ = node;
  }

  setup() {}

  render() {
    this.__owl__.render();
  }
}
