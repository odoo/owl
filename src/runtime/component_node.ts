import { OwlError } from "../common/owl_error";
import type { App } from "./app";
import { BDom, VNode } from "./blockdom";
import { Component, ComponentConstructor } from "./component";
import { PluginManager } from "./plugin_manager";
import {
  Atom,
  Computation,
  ComputationState,
  getCurrentComputation,
  runWithComputation,
  setComputation,
  untrack,
} from "./reactivity/computations";
import { fibersInError } from "./rendering/error_handling";
import { Fiber, makeChildFiber, makeRootFiber, MountFiber, MountOptions } from "./rendering/fibers";
import { STATUS } from "./status";

let currentNode: ComponentNode | null = null;

export function saveCurrent() {
  let n = currentNode;
  return () => {
    currentNode = n;
  };
}

export function getCurrent(): ComponentNode {
  if (!currentNode) {
    throw new OwlError("No active component (a hook function should only be called in 'setup')");
  }
  return currentNode;
}

// -----------------------------------------------------------------------------
//  Component VNode class
// -----------------------------------------------------------------------------

type LifecycleHook = Function;

export class ComponentNode implements VNode<ComponentNode> {
  el?: HTMLElement | Text | undefined;
  app: App;
  fiber: Fiber | null = null;
  component: Component;
  bdom: BDom | null = null;
  status: STATUS = STATUS.NEW;
  forceNextRender: boolean = false;
  parentKey: string | null;
  name: string; // TODO: remove
  props: Record<string, any>;

  renderFn: Function;
  parent: ComponentNode | null;
  children: { [key: string]: ComponentNode } = Object.create(null);

  willStart: LifecycleHook[] = [];
  willUpdateProps: LifecycleHook[] = [];
  willUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];
  willPatch: LifecycleHook[] = [];
  patched: LifecycleHook[] = [];
  willDestroy: LifecycleHook[] = [];
  signalComputation: Computation;

  pluginManager: PluginManager;

  constructor(
    C: ComponentConstructor,
    props: Record<string, any>,
    app: App,
    parent: ComponentNode | null,
    parentKey: string | null
  ) {
    this.name = C.name;
    currentNode = this;
    this.app = app;
    this.parent = parent;
    this.parentKey = parentKey;
    this.pluginManager = parent ? parent.pluginManager : app.pluginManager;
    this.signalComputation = {
      value: undefined,
      compute: () => this.render(false),
      sources: new Set<Atom>(),
      state: ComputationState.EXECUTED,
    };
    this.props = Object.assign({}, props);
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    this.component = new C(this);
    const ctx = { this: this.component, __owl__: this };
    this.renderFn = app.getTemplate(C.template).bind(this.component, ctx, this);
    this.component.setup();
    setComputation(previousComputation);
    currentNode = null;
  }

  mountComponent(target: any, options?: MountOptions) {
    const fiber = new MountFiber(this, target, options);
    this.app.scheduler.addFiber(fiber);
    this.initiateRender(fiber);
  }

  async initiateRender(fiber: Fiber | MountFiber) {
    this.fiber = fiber;
    if (this.mounted.length) {
      fiber.root!.mounted.push(fiber);
    }
    const component = this.component;
    try {
      let promises: Promise<any[]>[];
      runWithComputation(undefined!, () => {
        promises = this.willStart.map((f) => f.call(component));
      });
      await Promise.all(promises!);
    } catch (e) {
      this.app.handleError({ node: this, error: e });
      return;
    }
    if (this.status === STATUS.NEW && this.fiber === fiber) {
      fiber.render();
    }
  }

  async render(deep: boolean) {
    if (this.status >= STATUS.CANCELLED) {
      return;
    }
    let current = this.fiber;
    if (current && (current.root!.locked || (current as any).bdom === true)) {
      await Promise.resolve();
      // situation may have changed after the microtask tick
      current = this.fiber;
    }
    if (current) {
      if (!current.bdom && !fibersInError.has(current)) {
        if (deep) {
          // we want the render from this point on to be with deep=true
          current.deep = deep;
        }
        return;
      }
      // if current rendering was with deep=true, we want this one to be the same
      deep = deep || current.deep;
    } else if (!this.bdom) {
      return;
    }

    const fiber = makeRootFiber(this);
    fiber.deep = deep;
    this.fiber = fiber;

    this.app.scheduler.addFiber(fiber);
    await Promise.resolve();
    if (this.status >= STATUS.CANCELLED) {
      return;
    }
    // We only want to actually render the component if the following two
    // conditions are true:
    // * this.fiber: it could be null, in which case the render has been cancelled
    // * (current || !fiber.parent): if current is not null, this means that the
    //   render function was called when a render was already occurring. In this
    //   case, the pending rendering was cancelled, and the fiber needs to be
    //   rendered to complete the work.  If current is null, we check that the
    //   fiber has no parent.  If that is the case, the fiber was downgraded from
    //   a root fiber to a child fiber in the previous microtick, because it was
    //   embedded in a rendering coming from above, so the fiber will be rendered
    //   in the next microtick anyway, so we should not render it again.
    if (this.fiber === fiber && (current || !fiber.parent)) {
      fiber.render();
    }
  }

  cancel() {
    this._cancel();
    delete this.parent!.children[this.parentKey!];
    this.app.scheduler.scheduleDestroy(this);
  }

  _cancel() {
    this.status = STATUS.CANCELLED;
    const children = this.children;
    for (let childKey in children) {
      children[childKey]._cancel();
    }
  }

  destroy() {
    let shouldRemove = this.status === STATUS.MOUNTED;
    this._destroy();
    if (shouldRemove) {
      this.bdom!.remove();
    }
  }

  _destroy() {
    const component = this.component;
    if (this.status === STATUS.MOUNTED) {
      for (let cb of this.willUnmount) {
        cb.call(component);
      }
    }
    for (let child of Object.values(this.children)) {
      child._destroy();
    }
    if (this.willDestroy.length) {
      try {
        for (let cb of this.willDestroy) {
          cb.call(component);
        }
      } catch (e) {
        this.app.handleError({ error: e, node: this });
      }
    }
    this.status = STATUS.DESTROYED;
  }

  async updateAndRender(props: Record<string, any>, parentFiber: Fiber) {
    props = Object.assign({}, props);
    // update
    const fiber = makeChildFiber(this, parentFiber);
    this.fiber = fiber;
    const component = this.component;

    let prom: Promise<any[]>;
    untrack(() => {
      prom = Promise.all(this.willUpdateProps.map((f) => f.call(component, props)));
    });
    await prom!;
    if (fiber !== this.fiber) {
      return;
    }
    this.props = props;
    fiber.render();
    const parentRoot = parentFiber.root!;
    if (this.willPatch.length) {
      parentRoot.willPatch.push(fiber);
    }
    if (this.patched.length) {
      parentRoot.patched.push(fiber);
    }
  }

  /**
   * Finds a child that has dom that is not yet updated, and update it. This
   * method is meant to be used only in the context of repatching the dom after
   * a mounted hook failed and was handled.
   */
  updateDom() {
    if (!this.fiber) {
      return;
    }
    if (this.bdom === this.fiber!.bdom) {
      // If the error was handled by some child component, we need to find it to
      // apply its change
      for (let k in this.children) {
        const child = this.children[k];
        child.updateDom();
      }
    } else {
      // if we get here, this is the component that handled the error and rerendered
      // itself, so we can simply patch the dom
      this.bdom!.patch(this.fiber!.bdom, false);
      this.fiber!.appliedToDom = true;
      this.fiber = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Block DOM methods
  // ---------------------------------------------------------------------------

  firstNode(): Node | undefined {
    const bdom = this.bdom;
    return bdom ? bdom.firstNode() : undefined;
  }

  mount(parent: HTMLElement, anchor: ChildNode) {
    const bdom = this.fiber!.bdom!;
    this.bdom = bdom;
    bdom.mount(parent, anchor);
    this.status = STATUS.MOUNTED;
    this.fiber!.appliedToDom = true;
    this.children = this.fiber!.childrenMap;
    this.fiber = null;
  }

  moveBeforeDOMNode(node: Node | null, parent?: HTMLElement): void {
    this.bdom!.moveBeforeDOMNode(node, parent);
  }

  moveBeforeVNode(other: ComponentNode | null, afterNode: Node | null) {
    this.bdom!.moveBeforeVNode(other ? other.bdom : null, afterNode);
  }

  patch() {
    if (this.fiber && this.fiber.parent) {
      // we only patch here renderings coming from above. renderings initiated
      // by the component will be patched independently in the appropriate
      // fiber.complete
      this._patch();
    }
  }
  _patch() {
    let hasChildren = false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (let _k in this.children) {
      hasChildren = true;
      break;
    }
    const fiber = this.fiber!;
    this.children = fiber.childrenMap;
    this.bdom!.patch(fiber.bdom!, hasChildren);
    fiber.appliedToDom = true;
    this.fiber = null;
  }

  beforeRemove() {
    this._destroy();
  }

  remove() {
    this.bdom!.remove();
  }
}
