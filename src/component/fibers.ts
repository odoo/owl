import type { BDom } from "../blockdom";
import { mount } from "../blockdom";
import type { ComponentNode } from "./component_node";
import { STATUS } from "./status";
// import { mountBlock } from "./bdom/block";

export function makeChildFiber(node: ComponentNode, parent: Fiber): Fiber {
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

export function makeRootFiber(node: ComponentNode): Fiber {
  let current = node.fiber;
  if (current) {
    let root = current.root;
    root.counter -= cancelFibers(root, current.children);
    current.children = [];
    root.counter++;
    current.bdom = null;
    return current;
  }
  const fiber = new RootFiber(node);
  if (node.willPatch.length) {
    fiber.willPatch.push(fiber);
  }
  if (node.patched.length) {
    fiber.patched.push(fiber);
  }

  return fiber;
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
  node: ComponentNode;
  bdom: BDom | null = null;
  root: RootFiber;
  parent: Fiber | null;
  children: Fiber[] = [];
  appliedToDom = false;

  constructor(node: ComponentNode, parent: Fiber | null) {
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

  constructor(node: ComponentNode) {
    super(node, null);
    this.counter = 1;

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  complete() {
    const node = this.node;

    // Step 1: calling all willPatch lifecycle hooks
    for (let fiber of this.willPatch) {
      // because of the asynchronous nature of the rendering, some parts of the
      // UI may have been rendered, then deleted in a followup rendering, and we
      // do not want to call onWillPatch in that case.
      let node = fiber.node;
      if (node.fiber === fiber) {
        const component = node.component;
        for (let cb of node.willPatch) {
          cb.call(component);
        }
      }
    }

    // Step 2: patching the dom
    node.bdom!.patch(this.bdom!, Object.keys(node.children).length > 0);
    this.appliedToDom = true;

    // Step 3: calling all destroyed hooks
    for (let node of __internal__destroyed) {
      for (let cb of node.destroyed) {
        cb();
      }
    }
    __internal__destroyed.length = 0;

    // Step 4: calling all mounted lifecycle hooks
    let current;
    let mountedFibers = this.mounted;
    while ((current = mountedFibers.pop())) {
      if (current.appliedToDom) {
        for (let cb of current.node.mounted) {
          cb();
        }
      }
    }

    // Step 5: calling all patched hooks
    let patchedFibers = this.patched;
    while ((current = patchedFibers.pop())) {
      if (current.appliedToDom) {
        for (let cb of current.node.patched) {
          cb();
        }
      }
    }

    // unregistering the fiber
    node.fiber = null;
  }
}

export let __internal__destroyed: ComponentNode[] = [];

type Position = "first-child" | "last-child";

export interface MountOptions {
  position?: Position;
}

export class MountFiber extends RootFiber {
  target: HTMLElement;
  position: Position;

  constructor(node: ComponentNode, target: HTMLElement, options: MountOptions = {}) {
    super(node);
    this.target = target;
    this.position = options.position || "last-child";
  }
  complete() {
    const node = this.node;
    node.bdom = this.bdom;
    if (this.position === "last-child" || this.target.childNodes.length === 0) {
      mount(node.bdom!, this.target);
    } else {
      const firstChild = this.target.childNodes[0];
      mount(node.bdom!, this.target, firstChild);
    }
    node.status = STATUS.MOUNTED;
    this.appliedToDom = true;
    let current;
    let mountedFibers = this.mounted;
    while ((current = mountedFibers.pop())) {
      if (current.appliedToDom) {
        for (let cb of current.node.mounted) {
          cb();
        }
      }
    }
    node.fiber = null;
  }
}
