import type { Env } from "../app/app";
import type { ComponentNode } from "./component_node";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

export class Component {
  static template: string = "";
  static props?: any;

  props: any;
  env: Env;
  __owl__: ComponentNode;

  constructor(props: any, env: Env, node: ComponentNode) {
    this.props = props;
    this.env = env;
    this.__owl__ = node;
  }

  setup() {}

  render() {
    this.__owl__.render();
  }
}
