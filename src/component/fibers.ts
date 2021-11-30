import { BDom, mount } from "../blockdom";
import type { ComponentNode } from "./component_node";
import { fibersInError, handleError } from "./error_handling";
import { STATUS } from "./status";

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
    if (fibersInError.has(current)) {
      fibersInError.delete(current);
      fibersInError.delete(root);
      current.appliedToDom = false;
    }
    return current;
  }
  const fiber = new RootFiber(node, null);
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

  // only add stuff in this if they have registered some hooks
  willPatch: Fiber[] = [];
  patched: Fiber[] = [];
  mounted: Fiber[] = [];

  complete() {
    const node = this.node;
    let current: Fiber | undefined = undefined;
    try {
      // Step 1: calling all willPatch lifecycle hooks
      for (current of this.willPatch) {
        // because of the asynchronous nature of the rendering, some parts of the
        // UI may have been rendered, then deleted in a followup rendering, and we
        // do not want to call onWillPatch in that case.
        let node = current.node;
        if (node.fiber === current) {
          const component = node.component;
          for (let cb of node.willPatch) {
            cb.call(component);
          }
        }
      }
      current = undefined;

      // Step 2: patching the dom
      node.bdom!.patch(this.bdom!, Object.keys(node.children).length > 0);
      this.appliedToDom = true;

      // Step 4: calling all mounted lifecycle hooks
      let mountedFibers = this.mounted;
      while ((current = mountedFibers.pop())) {
        current = current;
        if (current.appliedToDom) {
          for (let cb of current.node.mounted) {
            cb();
          }
        }
      }

      // Step 5: calling all patched hooks
      let patchedFibers = this.patched;
      while ((current = patchedFibers.pop())) {
        current = current;
        if (current.appliedToDom) {
          for (let cb of current.node.patched) {
            cb();
          }
        }
      }
      // unregistering the fiber
      node.fiber = null;
    } catch (e) {
      handleError({ fiber: current || this, error: e });
    }
  }
}

type Position = "first-child" | "last-child";

export interface MountOptions {
  position?: Position;
}

export class MountFiber extends RootFiber {
  target: HTMLElement;
  position: Position;
  resolve: any;
  promise: Promise<any>;
  reject: any;

  constructor(node: ComponentNode, target: HTMLElement, options: MountOptions = {}) {
    super(node, null);
    this.target = target;
    this.position = options.position || "last-child";
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
  complete() {
    let current: Fiber | undefined = this;
    try {
      const node = this.node;
      if (node.bdom) {
        // this is a complicated situation: if we mount a fiber with an existing
        // bdom, this means that this same fiber was already completed, mounted,
        // but a crash occurred in some mounted hook. Then, it was handled and
        // the new rendering is being applied.
        node.updateDom();
      } else {
        node.bdom = this.bdom;
        if (this.position === "last-child" || this.target.childNodes.length === 0) {
          mount(node.bdom!, this.target);
        } else {
          const firstChild = this.target.childNodes[0];
          mount(node.bdom!, this.target, firstChild);
        }
      }
      node.status = STATUS.MOUNTED;
      this.appliedToDom = true;
      let mountedFibers = this.mounted;
      while ((current = mountedFibers.pop())) {
        if (current.appliedToDom) {
          for (let cb of current.node.mounted) {
            cb();
          }
        }
      }
      node.fiber = null;
    } catch (e) {
      if (!handleError({ fiber: current as Fiber, error: e })) {
        this.reject(e);
      }
    }
    this.resolve();
  }
}
