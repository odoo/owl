import type { Block } from "./bdom";
import { STATUS } from "./status";
import { OwlNode } from "./owl_node";

export function makeChildFiber(node: OwlNode, parent: Fiber): Fiber {
  // todo: remove this
  if ((window as any).debug) {
    console.log("childfiber for " + node.component.constructor.name);
  }
  let current = node.fiber;
  if (current) {
    // current is necessarily a rootfiber here
    let root = parent.root;
    cancelFibers(current.children);
    current.children = [];
    current.parent = parent;
    root.counter++;
    return current;
  }
  let result = new Fiber(node, parent);
  return result;
}

export function makeRootFiber(node: OwlNode): Fiber {
  // todo: remove this
  if ((window as any).debug) {
    console.log("rootfiber for " + node.component.constructor.name);
  }
  let current = node.fiber;
  if (current) {
    let root = current.root;
    root.counter -= cancelFibers(current.children);
    current.children = [];
    root.counter++;
    current.bdom = null;
    return current;
  }
  let result = new RootFiber(node);
  return result;
}

export function makeMountFiber(node: OwlNode, target: HTMLElement): MountFiber {
  if ((window as any).debug) {
    console.log("mountfiber for " + node.component.constructor.name);
  }
  let result = new MountFiber(node, target);
  return result;
}

/**
 * @returns number of not-yet rendered fibers cancelled
 */
function cancelFibers(fibers: Fiber[]): number {
  let result = 0;
  for (let fiber of fibers) {
    fiber.node.fiber = null;
    if (!fiber.bdom) {
      result++;
    }
    result += cancelFibers(fiber.children);
  }
  return result;
}

export class Fiber {
  node: OwlNode;
  bdom: Block | null = null;
  root: RootFiber;
  parent: Fiber | null;
  children: Fiber[] = [];

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
  promise: any;
  reject: any;
  toPatch: Fiber[];

  constructor(node: OwlNode) {
    super(node, null);
    this.counter = 1;
    this.error = null;
    this.toPatch = [this];

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  complete() {
    const node = this.node;
    // if (node.fiber !== fiber) {
    //   return;
    // }
    for (let fiber of this.toPatch) {
      let node = fiber.node;
      // because of the asynchronous nature of the rendering, some parts of the
      // UI may have been rendered, then deleted in a followup rendering, and we
      // do not want to call onBeforePatch in that case.
      if (node.fiber === fiber) {
        node.callBeforePatch();
      }
    }
    const mountedNodes: any[] = [];
    const patchedNodes: any[] = [node];
    node.bdom!.patch(this.bdom!, mountedNodes, patchedNodes);
    this.finalize(mountedNodes, patchedNodes);
    node.fiber = null;
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
    node.fiber = null;
  }
}
