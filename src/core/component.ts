import { EventBus } from "./event_bus";
import type { OwlNode } from "./owl_node";

export class Component extends EventBus {
  static template: string = "";

  props: any;
  env: any;
  __owl__: OwlNode;

  constructor(props: any, env: any, node: OwlNode) {
    super();
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
