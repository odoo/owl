import type { Block } from "./bdom";
import { STATUS } from "./status";
import { OwlNode } from "./owl_node";

export function makeChildFiber(node: OwlNode, parent: Fiber): Fiber {
  let current = node.fiber;
  if (current) {
    // current is necessarily a rootfiber here
    let root = parent.root;
    cancelFibers(root, current.children);
    current.children = [];
    current.parent = parent;
    root.counter++;
    current.root = root;
    return current;
  }
  return new Fiber(node, parent);
}

export function makeRootFiber(node: OwlNode): Fiber {
  let current = node.fiber;
  if (current) {
    let root = current.root;
    root.counter -= cancelFibers(root, current.children);
    current.children = [];
    root.counter++;
    current.bdom = null;
    return current;
  }
  return new RootFiber(node);
}

/**
 * @returns number of not-yet rendered fibers cancelled
 */
function cancelFibers(root: any, fibers: Fiber[]): number {
  let result = 0;
  for (let fiber of fibers) {
    fiber.node.fiber = null;
    fiber.root = root;
    if (!fiber.bdom) {
      result++;
    }
    result += cancelFibers(root, fiber.children);
  }
  return result;
}

export class Fiber {
  node: OwlNode;
  bdom: Block | null = null;
  root: RootFiber;
  parent: Fiber | null;
  children: Fiber[] = [];
  appliedToDom = false;

  constructor(node: OwlNode, parent: Fiber | null) {
    this.node = node;
    node.fiber = this;
    this.parent = parent;
    if (parent) {
      const root = parent.root;
      root.counter++;
      this.root = root;
      parent.children.push(this);
    } else {
      this.root = this as any;
    }
  }
}

export class RootFiber extends Fiber {
  counter: number = 1;
  error: Error | null = null;
  resolve: any;
  promise: Promise<any>;
  reject: any;

  // only add stuff in this if they have registered some hooks
  willPatch: Fiber[] = [];
  patched: Fiber[] = [];
  mounted: Fiber[] = [];

  constructor(node: OwlNode) {
    super(node, null);
    this.counter = 1;
    if (node.willPatch.length) {
      this.willPatch.push(this);
    }
    if (node.patched.length) {
      this.patched.push(this);
    }

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  complete() {
    const node = this.node;
    node.patchDom(() => node.bdom!.patch(this.bdom!), this);
  }
}

export class MountFiber extends RootFiber {
  target: HTMLElement;

  constructor(node: OwlNode, target: HTMLElement) {
    super(node);
    this.target = target;
    this.willPatch.length = 0;
    this.patched.length = 0;
    if (node.mounted.length) {
      this.mounted.push(this);
    }
  }
  complete() {
    const node = this.node;
    node.bdom = this.bdom;
    node.patchDom(() => node.bdom!.mount(this.target), this);
    node.status = STATUS.MOUNTED;
  }
}
