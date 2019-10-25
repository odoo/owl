import { VNode } from "../vdom/index";
import { Component } from "./component";
/**
 * Fibers are small abstractions designed to contain all the internal state
 * associated to a "rendering work unit", relative to a specific component.
 *
 * A rendering will cause the creation of a fiber for each impacted components.
 */
export class Fiber {
  force: boolean;
  isCancelled: boolean = false;
  shouldPatch: boolean = true;
  isRendered: boolean = false;

  scope: any;
  vars: any;
  props: any;

  component: Component<any, any>;
  vnode: VNode | null = null;

  root: Fiber;
  child: Fiber | null = null;
  sibling: Fiber | null = null;
  parent: Fiber | null = null;

  counter: number = 0;

  constructor(parent: Fiber | null, component: Component<any, any>, props, scope, vars, force) {
    this.force = force;
    this.scope = scope;
    this.vars = vars;
    this.props = props;
    this.component = component;

    this.root = parent ? parent.root : this;
    this.parent = parent;

    let oldFiber = component.__owl__.currentFiber;
    if (oldFiber && !oldFiber.isCancelled) {
      this.__remapFiber(oldFiber);
    }

    this.root.counter++;

    component.__owl__.currentFiber = this;
  }

  __remapFiber(oldFiber: Fiber) {
    oldFiber.cancel();
    if (oldFiber === oldFiber.root) {
      oldFiber.root.counter++;
    }
    if (oldFiber.parent && !this.parent) {
      // re-map links
      this.parent = oldFiber.parent;
      this.root = this.parent.root;
      this.sibling = oldFiber.sibling;
      if (this.parent.child === oldFiber) {
        this.parent.child = this;
      } else {
        let current = this.parent.child!;
        while (true) {
          if (current.sibling === oldFiber) {
            current.sibling = this;
            break;
          }
          current = current.sibling!;
        }
      }
    }
  }

  /**
   * This function has been taken from
   * https://medium.com/react-in-depth/the-how-and-why-on-reacts-usage-of-linked-list-in-fiber-67f1014d0eb7
   */
  __walk(doWork: (f: Fiber) => Fiber | null) {
    let root = this;
    let current: Fiber = this;
    while (true) {
      const child = doWork(current);
      if (child) {
        current = child;
        continue;
      }
      if (current === root) {
        return;
      }
      while (!current.sibling) {
        if (!current.parent || current.parent === root) {
          return;
        }
        current = current.parent;
      }
      current = current.sibling;
    }
  }

  /**
   * Apply the given patch queue from a fiber.
   *   1) Call 'willPatch' on the component of each patch
   *   2) Call '__patch' on the component of each patch
   *   3) Call 'patched' on the component of each patch, in reverse order
   */
  __applyPatchQueue() {
    const patchQueue: Fiber[] = [];
    const doWork: (Fiber) => Fiber | null = function(f) {
      if (f.shouldPatch) {
        patchQueue.push(f);
      }
      return f.child;
    };
    this.__walk(doWork);
    let component: Component<any, any> = this.component;
    this.shouldPatch = false;
    const patchLen = patchQueue.length;
    try {
      for (let i = 0; i < patchLen; i++) {
        component = patchQueue[i].component;
        if (component.__owl__.willPatchCB) {
          component.__owl__.willPatchCB();
        }
        component.willPatch();
      }
    } catch (e) {
      console.error(e);
    }
    try {
      for (let i = 0; i < patchLen; i++) {
        const fiber = patchQueue[i];
        component = fiber.component;
        component.__patch(fiber.vnode);
      }
    } catch (e) {
      this.handleError(e);
    }
    try {
      for (let i = patchLen - 1; i >= 0; i--) {
        component = patchQueue[i].component;
        component.patched();
        if (component.__owl__.patchedCB) {
          component.__owl__.patchedCB();
        }
      }
    } catch (e) {
      console.error(e);
    }
    this.shouldPatch = true;
  }

  cancel() {
    this.__walk(f => {
      if (!f.isRendered) {
        f.root.counter--;
      }
      f.isCancelled = true;
      return f.child;
    });
  }

  handleError(e: Error) {}
}
