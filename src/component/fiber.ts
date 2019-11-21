import { h, VNode } from "../vdom/index";
import { Component } from "./component";
import { scheduler } from "./scheduler";

/**
 * Owl Fiber Class
 *
 * Fibers are small abstractions designed to contain all the internal state
 * associated with a "rendering work unit", relative to a specific component.
 *
 * A rendering will cause the creation of a fiber for each impacted components.
 *
 * Fibers capture all that necessary information, which is critical to owl
 * asynchronous rendering pipeline. Fibers can be cancelled, can be in different
 * states and in general determine the state of the rendering.
 */

export class Fiber {
  static nextId: number = 1;
  id: number = Fiber.nextId++;

  // The force attribute determines if a rendering should bypass the `shouldUpdate`
  // method potentially implemented by a component. It is usually set to false.
  force: boolean;

  // isCompleted means that the rendering corresponding to this fiber's work is
  // done, either because the component has been mounted or patched, or because
  // fiber has been cancelled.
  isCompleted: boolean = false;

  // the fibers corresponding to component updates (updateProps) need to call
  // the willPatch and patched hooks from the corresponding component. However,
  // fibers corresponding to a new component do not need to do that. So, the
  // shouldPatch hook is the boolean that we check whenever we need to apply
  // a patch.
  shouldPatch: boolean = true;

  // isRendered is the last state of a fiber. If true, this means that it has
  // been rendered and is inert (so, it should not be taken into account when
  // counting the number of active fibers).
  isRendered: boolean = false;

  // the counter number is a critical information. It is only necessary for a
  // root fiber.  For that fiber, this number counts the number of active sub
  // fibers.  When that number reaches 0, the fiber can be applied by the
  // scheduler.
  counter: number = 0;

  target: HTMLElement | null;

  scope: any;
  vars: any;

  component: Component<any, any>;
  vnode: VNode | null = null;

  root: Fiber;
  child: Fiber | null = null;
  sibling: Fiber | null = null;
  parent: Fiber | null = null;

  error?: Error;

  constructor(parent: Fiber | null, component: Component<any, any>, scope, vars, force, target) {
    this.force = force;
    this.scope = scope;
    this.vars = vars;
    this.component = component;
    this.target = target;

    this.root = parent ? parent.root : this;
    this.parent = parent;

    let oldFiber = component.__owl__.currentFiber;
    if (oldFiber && !oldFiber.isCompleted) {
      if (oldFiber.root === oldFiber && !parent) {
        // both oldFiber and this fiber are root fibers
        this._reuseFiber(oldFiber);
        return oldFiber;
      } else {
        this._remapFiber(oldFiber);
      }
    }

    this.root.counter++;

    component.__owl__.currentFiber = this;
  }

  /**
   * When the oldFiber is not completed yet, and both oldFiber and this fiber
   * are root fibers, we want to reuse the oldFiber instead of creating a new
   * one. Doing so will guarantee that the initiator(s) of those renderings will
   * be notified (the promise will resolve) when the last rendering will be done.
   *
   * This function thus assumes that oldFiber is a root fiber.
   */
  _reuseFiber(oldFiber: Fiber) {
    oldFiber.cancel(); // cancel children fibers
    oldFiber.isCompleted = false; // keep the root fiber alive
    oldFiber.isRendered = false; // the fiber has to be re-rendered
    if (oldFiber.child) {
      // remove relation to children
      oldFiber.child.parent = null;
      oldFiber.child = null;
    }
    oldFiber.counter = 1; // re-initialize counter
    oldFiber.id = Fiber.nextId++;
  }

  /**
   * In some cases, a rendering initiated at some component can detect that it
   * should be part of a larger rendering initiated somewhere up the component
   * tree.  In that case, it needs to cancel the previous rendering and
   * remap itself as a part of the current parent rendering.
   */
  _remapFiber(oldFiber: Fiber) {
    oldFiber.cancel();
    if (oldFiber === oldFiber.root) {
      oldFiber.counter++;
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
  _walk(doWork: (f: Fiber) => Fiber | null) {
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
   * Successfully complete the work of the fiber: call the mount or patch hooks
   * and patch the DOM. This function is called once the fiber and its children
   * are ready, and the scheduler decides to process it.
   */
  complete() {
    const component = this.component;
    if (this.target) {
      component.__patch(this.vnode);
      this.target.appendChild(component.el!);
      if (document.body.contains(this.target)) {
        component.__callMounted();
      }
    } else if (component.__owl__.isMounted) {
      const patchQueue: Fiber[] = [];
      const doWork: (Fiber) => Fiber | null = function(f) {
        if (f.shouldPatch) {
          patchQueue.push(f);
          return f.child;
        }
      };
      this._walk(doWork);
      let component: Component<any, any> = this.component;
      const patchLen = patchQueue.length;
      for (let i = 0; i < patchLen; i++) {
        component = patchQueue[i].component;
        if (component.__owl__.willPatchCB) {
          component.__owl__.willPatchCB();
        }
        component.willPatch();
      }
      for (let i = 0; i < patchLen; i++) {
        const fiber = patchQueue[i];
        component = fiber.component;
        component.__patch(fiber.vnode);
        component.__owl__.currentFiber = null;
      }
      for (let i = patchLen - 1; i >= 0; i--) {
        component = patchQueue[i].component;
        component.patched();
        if (component.__owl__.patchedCB) {
          component.__owl__.patchedCB();
        }
      }
    }
    this.isCompleted = true;
  }

  /**
   * Cancel a fiber and all its children.
   */
  cancel() {
    this._walk(f => {
      if (!f.isRendered) {
        f.root.counter--;
      }
      f.isCompleted = true;
      return f.child;
    });
  }

  /**
   * This is the global error handler for errors occurring in Owl main lifecycle
   * methods.  Caught errors are triggered on the QWeb instance, and are
   * potentially given to some parent component which implements `catchError`.
   *
   * If there are no such component, we destroy everything. This is better than
   * being in a corrupted state.
   */
  handleError(error: Error) {
    let component = this.component;
    this.vnode = component.__owl__.vnode || h("div");

    const qweb = component.env.qweb;
    let root = component;
    let canCatch = false;
    while (component && !(canCatch = !!component.catchError)) {
      root = component;
      component = component.__owl__.parent!;
    }
    qweb.trigger("error", error);

    if (canCatch) {
      component.catchError!(error);
    } else {
      // the 3 next lines aim to mark the root fiber as being in error, and
      // to force it to end, without waiting for its children
      this.root.counter = 0;
      this.root.error = error;
      scheduler.flush();
      root.destroy();
    }
  }
}
