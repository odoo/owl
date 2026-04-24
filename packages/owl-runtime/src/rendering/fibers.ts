import {
  ComputationState,
  getCurrentComputation,
  OwlError,
  removeSources,
  setComputation,
} from "@odoo/owl-core";
import { BDom, mount, type MountTarget } from "../blockdom";
import type { ComponentNode } from "../component_node";
import { STATUS } from "../status";
import { fibersInError, handleError } from "./error_handling";

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
      if (current instanceof RootFiber) {
        // it is possible that this fiber is a fiber that crashed while being
        // mounted, so the mounted list is possibly corrupted. We restore it to
        // its normal initial state (which is empty list or a list with a mount
        // fiber.
        current.mounted = current instanceof MountFiber ? [current] : [];
      }
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
      node.cancel();
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
  // Set to true while initiateRender is awaiting willStart on a *root* fiber
  // (mount path). The scheduler enqueues such fibers up front so task order
  // matches the order roots were prepared, but skips rendering them in the
  // rAF render pass until willStart resolves and clears this flag.
  pending: boolean = false;

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
    const node = this.node;
    const root = this.root;
    // An ancestor's render may have orphaned us — its template excluded this
    // node and nulled our root (via the orphan scan below). Bail before
    // running the user's template, which could read state no longer valid in
    // the detached subtree.
    if (!root) {
      return;
    }
    const c = getCurrentComputation();
    removeSources(node.signalComputation);
    setComputation(node.signalComputation);
    node.signalComputation.state = ComputationState.EXECUTED;
    // Snapshot the existing children so we can orphan any that are missing
    // from the template output. The template repopulates this.childrenMap
    // via makeChildFiber on each <Child/> it encounters.
    const previousChildren = node.children;
    try {
      (this.bdom as any) = true;
      this.bdom = node.renderFn();
    } catch (e) {
      // Fast path for the cascade: an ancestor `fiber.render` already ran
      // `handleError` for this error and `app._handleError` rethrew. Every
      // subsequent catch up the render stack would call `handleError` again
      // only to short-circuit on `app.destroyed`. Skip straight to the
      // rethrow instead.
      if (e && (e as any).__owlHandled) {
        setComputation(c);
        throw e;
      }
      try {
        handleError({ node, error: e });
      } catch (rethrown) {
        if (rethrown && typeof rethrown === "object") {
          (rethrown as any).__owlHandled = true;
        }
        setComputation(c);
        throw rethrown;
      }
    }
    setComputation(c);
    // Anything in the old children map but not the new one is an orphan. An
    // independent render effect still pending on it would evaluate the user
    // template against state this parent is about to discard. Null out the
    // orphan's pending fiber so:
    //   - component_node.render's continuation skips fiber.render()
    //     (`this.fiber === fiber` becomes false)
    //   - processTasks skips the stale entry in this.tasks
    //     (`fiber.root !== fiber` branch, since we null fiber.root too)
    //   - a later fiber.render() call on the orphan hits the `if (!root)`
    //     guard above and no-ops
    // Real destruction and DOM teardown still happens at commit via
    // bdom.patch → beforeRemove → _destroy, so willUnmount fires correctly
    // (status is still MOUNTED until commit).
    const newChildren = this.childrenMap;
    for (const key in previousChildren) {
      if (!(key in newChildren)) {
        const orphan = previousChildren[key];
        const orphanFiber = orphan.fiber;
        if (orphanFiber) {
          orphanFiber.root = null;
          orphan.fiber = null;
        }
      }
    }
    const newCounter = root.counter - 1;
    root.counter = newCounter;
    if (newCounter === 0) {
      node.app.scheduler.flush();
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
    let mountedFibers = this.mounted;
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
      // if mountedFibers is not empty, this means that a crash occured while
      // calling the mounted hooks of some component. So, there may still be
      // some component that have been mounted, but for which the mounted hooks
      // have not been called. Here, we remove the willUnmount hooks for these
      // specific component to prevent a worse situation (willUnmount being
      // called even though mounted has not been called)
      for (let fiber of mountedFibers) {
        fiber.node.willUnmount = [];
      }
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
  // If set, the bdom is inserted immediately before this node inside `target`
  // (ignoring `position`). Used by Suspense to anchor its sub-root next to
  // an in-template text node instead of requiring a dedicated wrapper.
  afterNode?: Node | null;
}

export class MountFiber extends RootFiber {
  target: MountTarget | null;
  position: Position;
  afterNode: Node | null = null;
  // true once the render phase finishes (counter reaches 0). If target is
  // set at that point, we mount immediately; otherwise we signal readiness
  // via onPrepared and wait for commit() to supply a target.
  prepared = false;
  onPrepared: (() => void) | null = null;

  constructor(node: ComponentNode, target: MountTarget | null, options: MountOptions = {}) {
    super(node, null);
    this.target = target;
    this.position = options.position || "last-child";
    this.afterNode = options.afterNode ?? null;
  }

  complete() {
    this.prepared = true;
    if (this.target) {
      this._mount();
    } else {
      // Prepare-only: the render phase is done, but no target has been
      // supplied yet. Signal readiness and let the scheduler drop this
      // fiber from its tasks — commit() will run _mount() when called.
      this.appliedToDom = true;
      this.onPrepared?.();
    }
  }

  commit(target: MountTarget, options: MountOptions = {}) {
    this.target = target;
    this.position = options.position || "last-child";
    this.afterNode = options.afterNode ?? null;
    if (this.prepared) {
      this._mount();
    }
    // Otherwise the render phase is still in flight. complete() will fire
    // when the counter reaches 0 and pick up the now-set target.
  }

  private _mount() {
    let current: Fiber | undefined = this;
    try {
      const node = this.node;
      node.children = this.childrenMap;
      (node.app.constructor as any).validateTarget(this.target!);
      if (node.bdom) {
        // this is a complicated situation: if we mount a fiber with an existing
        // bdom, this means that this same fiber was already completed, mounted,
        // but a crash occurred in some mounted hook. Then, it was handled and
        // the new rendering is being applied.
        node.updateDom();
      } else {
        node.bdom = this.bdom;
        if (this.afterNode) {
          mount(node.bdom!, this.target!, this.afterNode);
        } else if (this.position === "last-child" || this.target!.childNodes.length === 0) {
          mount(node.bdom!, this.target!);
        } else {
          const firstChild = this.target!.childNodes[0];
          mount(node.bdom!, this.target!, firstChild);
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
