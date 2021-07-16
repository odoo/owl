import { Component } from "./component";
import type { OwlNode } from "./owl_node";
import { xml } from "./tags";

export class NoUpdate extends Component {
  static template = xml`<t t-slot="default"/>`;

  constructor(props: any, env: any, node: OwlNode) {
    super(props, env, node);
    node._render = function (fiber: any) {
      if (!this.bdom) {
        this.bdom = this.renderFn();
        this.bdom!.patch = () => {};
      }
      fiber.bdom = this.bdom;
      fiber.root.counter--;
    };
  }
}
