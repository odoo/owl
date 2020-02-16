import { h, VNode } from "../vdom/index";
import { Component, MountPosition } from "./component";
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

  target: HTMLElement | DocumentFragment | null;
  position: MountPosition | null;

  scope: any;

  component: Component;
  vnode: VNode | null = null;

  root: Fiber;
  child: Fiber | null = null;
  sibling: Fiber | null = null;
  lastChild: Fiber | null = null;
  parent: Fiber | null = null;

  error?: Error;

  constructor(
    parent: Fiber | null,
    component: Component,
    force: boolean,
    target: HTMLElement | DocumentFragment | null,
    position: MountPosition | null
  ) {
    this.component = component;
    this.force = force;
    this.target = target;
    this.position = position;

    const __owl__ = component.__owl__;
    this.scope = __owl__.scope;

    this.root = parent ? parent.root : this;
    this.parent = parent;

    let oldFiber = __owl__.currentFiber;
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

    __owl__.currentFiber = this;
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
      oldFiber.lastChild = null;
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
    this.shouldPatch = oldFiber.shouldPatch;
    if (oldFiber === oldFiber.root) {
      oldFiber.counter++;
    }
    if (oldFiber.parent && !this.parent) {
      // re-map links
      this.parent = oldFiber.parent;
      this.root = this.parent.root;
      this.sibling = oldFiber.sibling;
      if (this.parent.lastChild === oldFiber) {
        this.parent.lastChild = this;
      }
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
    let component = this.component;
    this.isCompleted = true;
    if (!this.target && !component.__owl__.isMounted) {
      return;
    }

    // build patchQueue
    const patchQueue: Fiber[] = [];
    const doWork: (Fiber) => Fiber | null = function(f) {
      patchQueue.push(f);
      return f.child;
    };
    this._walk(doWork);
    const patchLen = patchQueue.length;

    // call willPatch hook on each fiber of patchQueue
    for (let i = 0; i < patchLen; i++) {
      const fiber = patchQueue[i];
      if (fiber.shouldPatch) {
        component = fiber.component;
        if (component.__owl__.willPatchCB) {
          component.__owl__.willPatchCB();
        }
        component.willPatch();
      }
    }

    // call __patch on each fiber of (reversed) patchQueue
    for (let i = patchLen - 1; i >= 0; i--) {
      const fiber = patchQueue[i];
      component = fiber.component;
      if (fiber.target && i === 0) {
        let target;
        if (fiber.position === "self") {
          target = fiber.target;
          if ((target as HTMLElement).tagName.toLowerCase() !== fiber.vnode!.sel) {
            throw new Error(
              `Cannot attach '${component.constructor.name}' to target node (not same tag name)`
            );
          }
        } else {
          target = component.__owl__.vnode || document.createElement(fiber.vnode!.sel!);
        }
        component.__patch(target!, fiber.vnode!);
      } else {
        if (fiber.shouldPatch) {
          component.__patch(component.__owl__.vnode!, fiber.vnode!);
        } else {
          component.__patch(document.createElement(fiber.vnode!.sel!), fiber.vnode!);
          component.__owl__.pvnode!.elm = component.__owl__.vnode!.elm;
        }
      }
      component.__owl__.currentFiber = null;
    }

    // insert into the DOM (mount case)
    let inDOM = false;
    if (this.target) {
      switch (this.position) {
        case "first-child":
          this.target.prepend(this.component.el!);
          break;
        case "last-child":
          this.target.appendChild(this.component.el!);
          break;
      }
      inDOM = document.body.contains(this.component.el);
      this.component.env.qweb.trigger("dom-appended");
    }

    // call patched/mounted hook on each fiber of (reversed) patchQueue
    for (let i = patchLen - 1; i >= 0; i--) {
      const fiber = patchQueue[i];
      component = fiber.component;
      if (fiber.shouldPatch && !this.target) {
        component.patched();
        if (component.__owl__.patchedCB) {
          component.__owl__.patchedCB();
        }
      } else if (this.target ? inDOM : true) {
        component.__callMounted();
      }
    }
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
