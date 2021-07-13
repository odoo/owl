import type { OwlNode } from "./owl_node";

export class Component {
  static template: string = "";

  props: any;
  env: any;
  __owl__: OwlNode;

  constructor(props: any, env: any, node: OwlNode) {
    this.props = props;
    this.env = env;
    this.__owl__ = node;
  }
  get el() {
    const node = this.__owl__;
    return node.bdom ? node.bdom.el : null;
  }

  setup() {}

  render(): Promise<void> {
    return this.__owl__.render();
  }
}
