import {
  ComputationAtom,
  ComputationState,
  createComputation,
  disposeComputation,
  getCurrentComputation,
  isAbortError,
  OwlError,
  Scope,
  scopeStack,
  setComputation,
  useScope,
} from "@odoo/owl-core";
import type { App } from "./app";
import { BDom, VNode } from "./blockdom";
import { Component, ComponentConstructor } from "./component";
import { PluginManager } from "@odoo/owl-core";
import { fibersInError, handleError } from "./rendering/error_handling";
import { Fiber, makeRootFiber, MountFiber } from "./rendering/fibers";
import { STATUS } from "./status";

// -----------------------------------------------------------------------------
//  Component VNode class
// -----------------------------------------------------------------------------

type LifecycleHook = Function;

export class ComponentNode extends Scope implements VNode<ComponentNode> {
  fiber: Fiber | null = null;
  component!: Component;
  bdom: BDom | null = null;
  componentName: string;
  forceNextRender: boolean = false;
  parentKey: string | null;
  props: Record<string, any>;
  defaultProps: Record<string, any> | null = null;
  renderFn!: Function;
  parent: ComponentNode | null;
  children: { [key: string]: ComponentNode } = Object.create(null);

  willUpdateProps: LifecycleHook[] = [];
  willUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];
  willPatch: LifecycleHook[] = [];
  patched: LifecycleHook[] = [];
  signalComputation: ComputationAtom;
  // Depth in the component tree (root = 0). Used as the priority for
  // signalComputation so that when multiple components schedule re-renders in
  // the same microtask batch, ancestors run before descendants.
  depth: number;

  pluginManager: PluginManager;

  constructor(
    C: ComponentConstructor,
    props: Record<string, any>,
    app: App,
    parent: ComponentNode | null,
    parentKey: string | null
  ) {
    super(app);
    this.parent = parent;
    this.parentKey = parentKey;
    this.pluginManager = parent ? parent.pluginManager : app.pluginManager;
    this.componentName = C.name;
    this.depth = parent ? parent.depth + 1 : 0;
    this.signalComputation = createComputation(
      () => this.render(false),
      false,
      ComputationState.EXECUTED,
      this.depth
    );
    this.props = props;
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    scopeStack.push(this);
    try {
      this.component = new C(this);
      const ctx = { this: this.component, __owl__: this };
      this.renderFn = app.getTemplate(C.template).bind(this.component, ctx, this);
      this.component.setup();
    } finally {
      scopeStack.pop();
      setComputation(previousComputation);
    }
  }

  decorate(f: Function, hookName: string): Function {
    const component = this.component;
    const scope = this;
    if (this.app.dev) {
      const name = `${this.componentName}.${hookName}`;
      // Create a named wrapper so the name appears in stack traces.
      // V8 uses computed property keys as inferred function names.
      const wrapper = {
        [name](...args: any[]) {
          return f.call(component, scope, ...args);
        },
      };
      return wrapper[name];
    }
    return f.bind(component, scope);
  }

  initiateRender(fiber: Fiber | MountFiber) {
    this.fiber = fiber;
    if (this.mounted.length) {
      fiber.root!.mounted.push(fiber);
    }
    const component = this.component;
    let prev = getCurrentComputation();
    setComputation(undefined);
    let promises: any[];
    try {
      promises = this.willStart.map((f) => f.call(component));
    } catch (e) {
      setComputation(prev);
      handleError({ node: this, error: e });
      return;
    }
    setComputation(prev);
    // Fast path: every willStart hook returned synchronously. We can complete
    // willStart inline, which keeps a child fiber's render inside its parent's
    // render pass — total render+commit lands in a single tick instead of
    // leaking into a second one through `await Promise.all`'s microtask.
    if (promises.every((p) => !p || typeof p.then !== "function")) {
      this._completeWillStart(fiber);
      return;
    }
    Promise.all(promises).then(
      () => this._completeWillStart(fiber),
      (e) => {
        if (isAbortError(e) && this.status > STATUS.MOUNTED) {
          return;
        }
        handleError({ node: this, error: e });
      }
    );
  }

  private _completeWillStart(fiber: Fiber | MountFiber) {
    if (this.status === STATUS.NEW && this.fiber === fiber) {
      if (fiber.parent) {
        // Child fiber created during a parent render: render synchronously so
        // the parent's commit waits on us via the root counter.
        fiber.render();
      } else {
        // Root fiber (mount path): the fiber was already enqueued by prepare()
        // with `pending = true` to preserve ordering across roots. Clear the
        // flag and ensure the scheduler will pick us up at the next tick.
        fiber.pending = false;
        this.app.scheduler.flush();
      }
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
    if (current) {
      // Re-render of an existing fiber — typically a child fiber invalidated
      // by its own signalComputation, or recovery after an error handler set
      // state. The fiber lives inside an in-flight root tree (scheduler.tasks
      // only holds roots), so the scheduler can't reach it on its own. We
      // wait one microtask to coalesce any cluster of state changes, then
      // render in place; the existing root will commit with the fresh bdom
      // at its own tick.
      //
      // Hold the scheduler back during the await: addFiber queued processTasks
      // already, but committing other roots before this fiber.render runs
      // would skip our pending counter decrements / orphan-cancels.
      this.app.scheduler.pendingFiberRenders++;
      try {
        await Promise.resolve();
        if (this.status >= STATUS.CANCELLED) {
          return;
        }
        if (this.fiber === fiber) {
          fiber.render();
        }
      } finally {
        this.app.scheduler.pendingFiberRenders--;
      }
    }
    // For brand-new root fibers, the scheduler picks the work up at the next
    // microtask tick — that's where signal-driven first-time renders get
    // batched into a single per-tick pass.
  }

  cancel() {
    this._cancel();
    delete this.parent!.children[this.parentKey!];
    this.app.scheduler.scheduleDestroy(this);
  }

  _cancel() {
    super.cancel();
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
    for (let childKey in this.children) {
      this.children[childKey]._destroy();
    }
    this.finalize((e) => handleError({ error: e, node: this }));
    disposeComputation(this.signalComputation);
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

/**
 * Returns the active scope narrowed to a ComponentNode, or throws.
 */
export function getComponentScope(): ComponentNode {
  const scope = useScope();
  if (!(scope instanceof ComponentNode)) {
    throw new OwlError("Expected to be in a component scope");
  }
  return scope;
}
