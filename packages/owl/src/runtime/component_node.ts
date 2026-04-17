import { OwlError } from "../common/owl_error";
import type { App } from "./app";
import { BDom, VNode } from "./blockdom";
import { Component, ComponentConstructor } from "./component";
import { PluginManager } from "./plugin_manager";
import {
  ComputationAtom,
  ComputationState,
  createComputation,
  disposeComputation,
  getCurrentComputation,
  setComputation,
} from "./reactivity/computations";
import { fibersInError, handleError } from "./rendering/error_handling";
import { Fiber, makeRootFiber, MountFiber } from "./rendering/fibers";
import { isAbortError, Scope, scopeStack, useScope } from "./scope";
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

  willStart: LifecycleHook[] = [];
  willUpdateProps: LifecycleHook[] = [];
  willUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];
  willPatch: LifecycleHook[] = [];
  patched: LifecycleHook[] = [];
  signalComputation: ComputationAtom;

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
    this.signalComputation = createComputation(
      () => this.render(false),
      false,
      ComputationState.EXECUTED
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

  async initiateRender(fiber: Fiber | MountFiber) {
    this.fiber = fiber;
    if (this.mounted.length) {
      fiber.root!.mounted.push(fiber);
    }
    const component = this.component;
    let prev = getCurrentComputation();
    setComputation(undefined);
    try {
      let promises = this.willStart.map((f) => f.call(component));
      setComputation(prev);
      await Promise.all(promises!);
    } catch (e) {
      setComputation(prev);
      if (isAbortError(e) && this.status > STATUS.MOUNTED) {
        return;
      }
      handleError({ node: this, error: e });
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
