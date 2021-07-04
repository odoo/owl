import type { Block } from "../bdom";
import type { OwlNode } from "./component";

export class Fiber {
  node: OwlNode;
  bdom: Block | null = null;

  constructor(node: OwlNode) {
    this.node = node;
  }
}

export class RootFiber extends Fiber {
  counter = 1;
  error = null;
  resolve: any;
  promise: any;
  reject: any;

  constructor(node: OwlNode) {
    super(node);
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  complete() {
    this.node.bdom!.patch(this.bdom!);
  }
}

export class MountFiber extends RootFiber {
  target: HTMLElement | DocumentFragment;

  constructor(node: OwlNode, target: HTMLElement) {
    super(node);
    this.target = target;
  }
  complete() {
    const node = this.node;
    node.bdom = this.bdom;
    node.bdom!.mount(this.target);
  }
}
