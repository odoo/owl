import type { ComponentNode } from "./component_node";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

export class Component {
  static template: string = "";

  props: any;
  env: any;
  __owl__: ComponentNode;

  constructor(props: any, env: any, node: ComponentNode) {
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
