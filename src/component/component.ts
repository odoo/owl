import type { Env } from "../app/app";
import type { ComponentNode } from "./component_node";

export type Props = { [key: string]: any };

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

export class Component {
  static template: string = "";
  static style: string = "";
  static props?: any;

  props: any;
  env: Env;
  __owl__: ComponentNode;

  constructor(props: any, env: Env, node: ComponentNode) {
    this.props = props;
    this.env = env;
    this.__owl__ = node;
  }
  get el(): HTMLElement | Text | undefined {
    const node = this.__owl__;
    return node.bdom ? (node.bdom.firstNode() as any) : undefined;
  }

  setup() {}

  render(): Promise<void> {
    return this.__owl__.render();
  }
}
