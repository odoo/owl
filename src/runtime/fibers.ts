import { BDom, mount } from "./blockdom";
import type { ComponentNode } from "./component_node";
import { fibersInError, handleError, OwlError } from "./error_handling";
import { STATUS } from "./status";

export function makeChildFiber(node: ComponentNode, parent: Fiber): Fiber {
  let current = node.fiber;
  if (current) {
    cancelFibers(current.children);
    current.root = null;
  }
  return new Fiber(node, parent);
}

export function makeRootFiber(node: ComponentNode): Fiber {
  let current = node.fiber;
  if (current) {
    let root = current.root!;
    // lock root fiber because canceling children fibers may destroy components,
    // which means any arbitrary code can be run in onWillDestroy, which may
    // trigger new renderings
    root.locked = true;
    root.setCounter(root.counter + 1 - cancelFibers(current.children));
    root.locked = false;
    current.children = [];
    current.childrenMap = {};
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

function throwOnRender() {
  throw new OwlError("Attempted to render cancelled fiber");
}

/**
 * @returns number of not-yet rendered fibers cancelled
 */
function cancelFibers(fibers: Fiber[]): number {
  let result = 0;
  for (let fiber of fibers) {
    let node = fiber.node;
    fiber.render = throwOnRender;
    if (node.status === STATUS.NEW) {
      node.destroy();
      delete node.parent!.children[node.parentKey!];
    }
    node.fiber = null;
    if (fiber.bdom) {
      // if fiber has been rendered, this means that the component props have
      // been updated. however, this fiber will not be patched to the dom, so
      // it could happen that the next render compare the current props with
      // the same props, and skip the render completely. With the next line,
      // we kindly request the component code to force a render, so it works as
      // expected.
      node.forceNextRender = true;
    } else {
      result++;
    }
    result += cancelFibers(fiber.children);
  }
  return result;
}

export class Fiber {
  node: ComponentNode;
  bdom: BDom | null = null;
  root: RootFiber | null; // A Fiber that has been replaced by another has no root
  parent: Fiber | null;
  children: Fiber[] = [];
  appliedToDom = false;
  deep: boolean = false;
  childrenMap: ComponentNode["children"] = {};

  constructor(node: ComponentNode, parent: Fiber | null) {
    this.node = node;
    this.parent = parent;
    if (parent) {
      this.deep = parent.deep;
      const root = parent.root!;
      root.setCounter(root.counter + 1);
      this.root = root;
      parent.children.push(this);
    } else {
      this.root = this as any;
    }
  }

  render() {
    // if some parent has a fiber => register in followup
    let prev = this.root!.node;
    let scheduler = prev.app.scheduler;
    let current = prev.parent;
    while (current) {
      if (current.fiber) {
        let root = current.fiber.root!;
        if (root.counter === 0 && prev.parentKey! in current.fiber.childrenMap) {
          current = root.node;
        } else {
          scheduler.delayedRenders.push(this);
          return;
        }
      }
      prev = current;
      current = current.parent;
    }

    // there are no current rendering from above => we can render
    this._render();
  }

  _render() {
    const node = this.node;
    const root = this.root;
    if (root) {
      try {
        (this.bdom as any) = true;
        this.bdom = node.renderFn();
      } catch (e) {
        handleError({ node, error: e });
      }
      root.setCounter(root.counter - 1);
    }
  }
}

export class RootFiber extends Fiber {
  counter: number = 1;

  // only add stuff in this if they have registered some hooks
  willPatch: Fiber[] = [];
  patched: Fiber[] = [];
  mounted: Fiber[] = [];
  // A fiber is typically locked when it is completing and the patch has not, or is being applied.
  // i.e.: render triggered in onWillUnmount or in willPatch will be delayed
  locked: boolean = false;

  complete() {
    const node = this.node;
    this.locked = true;
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
      node._patch();
      this.locked = false;

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
    } catch (e) {
      this.locked = false;
      handleError({ fiber: current || this, error: e });
    }
  }

  setCounter(newValue: number) {
    this.counter = newValue;
    if (newValue === 0) {
      this.node.app.scheduler.flush();
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

  constructor(node: ComponentNode, target: HTMLElement, options: MountOptions = {}) {
    super(node, null);
    this.target = target;
    this.position = options.position || "last-child";
  }
  complete() {
    let current: Fiber | undefined = this;
    try {
      const node = this.node;
      node.children = this.childrenMap;
      (node.app.constructor as any).validateTarget(this.target);
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

      // unregistering the fiber before mounted since it can do another render
      // and that the current rendering is obviously completed
      node.fiber = null;

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
    } catch (e) {
      handleError({ fiber: current as Fiber, error: e });
    }
  }
}
