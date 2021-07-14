import type { Block } from "../bdom";
import { STATUS } from "../status";
import { OwlNode } from "./owl_node";

export class Fiber {
  node: OwlNode;
  bdom: Block | null = null;

  constructor(node: OwlNode) {
    this.node = node;
  }
}

export class ChildFiber extends Fiber {
  root: RootFiber;
  parent: Fiber;

  constructor(node: OwlNode, parent: ChildFiber | RootFiber) {
    super(node);
    this.parent = parent;
    const root = parent.root;
    root.counter++;
    this.root = root;
  }
}

export class RootFiber extends Fiber {
  counter = 1;
  error = null;
  resolve: any;
  promise: any;
  reject: any;
  root: RootFiber;
  toPatch: OwlNode[];

  constructor(node: OwlNode) {
    super(node);
    this.root = this;
    this.toPatch = [node];

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  complete() {
    for (let node of this.toPatch) {
      node.callBeforePatch();
    }
    const mountedNodes: any[] = [];
    const patchedNodes: any[] = [this.node];
    this.node.bdom!.patch(this.bdom!, mountedNodes, patchedNodes);
    this.finalize(mountedNodes, patchedNodes);
  }

  finalize(mounted: OwlNode[], patched: OwlNode[]) {
    let current;
    while ((current = mounted.pop())) {
      for (let cb of current.mounted) {
        cb();
      }
    }
    while ((current = patched.pop())) {
      for (let cb of current.patched) {
        cb();
      }
    }
  }
}

export class MountFiber extends RootFiber {
  target: HTMLElement;

  constructor(node: OwlNode, target: HTMLElement) {
    super(node);
    this.target = target;
    this.toPatch = [];
  }
  complete() {
    const node = this.node;
    node.bdom = this.bdom;
    const mountedNodes: any[] = [node];
    const patchedNodes: any[] = [];
    node.bdom!.mount(this.target, mountedNodes, patchedNodes);
    this.finalize(mountedNodes, patchedNodes);
    node.status = STATUS.MOUNTED;
  }
}
