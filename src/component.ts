import type { BNode } from "./b_node";

export class Component {
  static template: string = "";

  props: any;
  env: any;
  __owl__: BNode;

  constructor(props: any, env: any, node: BNode) {
    this.props = props;
    this.env = env;
    this.__owl__ = node;
  }
  get el(): HTMLElement | null {
    const node = this.__owl__;
    return node.bdom ? (node.bdom.el as any) : null;
  }

  setup() {}

  render(): Promise<void> {
    return this.__owl__.render();
  }
}
