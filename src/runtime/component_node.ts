import type { App, Env } from "./app";
import { BDom, VNode } from "./blockdom";
import { Component, ComponentConstructor, Props } from "./component";
import { fibersInError, OwlError } from "./error_handling";
import { Fiber, makeChildFiber, makeRootFiber, MountFiber, MountOptions } from "./fibers";
import {
  clearReactivesForCallback,
  getSubscriptions,
  NonReactive,
  Reactive,
  reactive,
  TARGET,
} from "./reactivity";
import { STATUS } from "./status";
import { batched, Callback } from "./utils";

let currentNode: ComponentNode | null = null;

export function getCurrent(): ComponentNode {
  if (!currentNode) {
    throw new OwlError("No active component (a hook function should only be called in 'setup')");
  }
  return currentNode;
}

export function useComponent(): Component {
  return currentNode!.component;
}

/**
 * Apply default props (only top level).
 */
function applyDefaultProps<P extends object>(props: P, defaultProps: Partial<P>) {
  for (let propName in defaultProps) {
    if (props[propName] === undefined) {
      (props as any)[propName] = defaultProps[propName];
    }
  }
}
// -----------------------------------------------------------------------------
// Integration with reactivity system (useState)
// -----------------------------------------------------------------------------

const batchedRenderFunctions = new WeakMap<ComponentNode, Callback>();
/**
 * Creates a reactive object that will be observed by the current component.
 * Reading data from the returned object (eg during rendering) will cause the
 * component to subscribe to that data and be rerendered when it changes.
 *
 * @param state the state to observe
 * @returns a reactive object that will cause the component to re-render on
 *  relevant changes
 * @see reactive
 */
export function useState<T extends object>(state: T): Reactive<T> | NonReactive<T> {
  const node = getCurrent();
  let render = batchedRenderFunctions.get(node)!;
  if (!render) {
    render = batched(node.render.bind(node, false));
    batchedRenderFunctions.set(node, render);
    // manual implementation of onWillDestroy to break cyclic dependency
    node.willDestroy.push(clearReactivesForCallback.bind(null, render));
  }
  return reactive(state, render);
}

// -----------------------------------------------------------------------------
//  Component VNode class
// -----------------------------------------------------------------------------

type LifecycleHook = Function;

export class ComponentNode<P extends Props = any, E = any> implements VNode<ComponentNode<P, E>> {
  el?: HTMLElement | Text | undefined;
  app: App;
  fiber: Fiber | null = null;
  component: Component<P, E>;
  bdom: BDom | null = null;
  status: STATUS = STATUS.NEW;
  forceNextRender: boolean = false;
  parentKey: string | null;
  props: P;

  renderFn: Function;
  parent: ComponentNode | null;
  childEnv: Env;
  children: { [key: string]: ComponentNode } = Object.create(null);
  refs: any = {};

  willStart: LifecycleHook[] = [];
  willUpdateProps: LifecycleHook[] = [];
  willUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];
  willPatch: LifecycleHook[] = [];
  patched: LifecycleHook[] = [];
  willDestroy: LifecycleHook[] = [];

  constructor(
    C: ComponentConstructor<P, E>,
    props: P,
    app: App,
    parent: ComponentNode | null,
    parentKey: string | null
  ) {
    currentNode = this;
    this.app = app;
    this.parent = parent;
    this.props = props;
    this.parentKey = parentKey;
    const defaultProps = C.defaultProps;
    props = Object.assign({}, props);
    if (defaultProps) {
      applyDefaultProps(props, defaultProps);
    }
    const env = (parent && parent.childEnv) || app.env;
    this.childEnv = env;
    for (const key in props) {
      const prop = props[key];
      if (prop && typeof prop === "object" && prop[TARGET]) {
        props[key] = useState(prop);
      }
    }
    this.component = new C(props, env, this);
    this.renderFn = app.getTemplate(C.template).bind(this.component, this.component, this);
    this.component.setup();
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
      await Promise.all(this.willStart.map((f) => f.call(component)));
    } catch (e) {
      this.app.handleError({ node: this, error: e });
      return;
    }
    if (this.status === STATUS.NEW && this.fiber === fiber) {
      fiber.render();
    }
  }

  async render(deep: boolean) {
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
    if (this.status === STATUS.DESTROYED) {
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

  async updateAndRender(props: P, parentFiber: Fiber) {
    const rawProps = props;
    props = Object.assign({}, props);
    // update
    const fiber = makeChildFiber(this, parentFiber);
    this.fiber = fiber;
    const component = this.component;
    const defaultProps = (component.constructor as any).defaultProps;
    if (defaultProps) {
      applyDefaultProps(props, defaultProps);
    }

    currentNode = this;
    for (const key in props) {
      const prop = props[key];
      if (prop && typeof prop === "object" && prop[TARGET]) {
        props[key] = useState(prop);
      }
    }
    currentNode = null;
    const prom = Promise.all(this.willUpdateProps.map((f) => f.call(component, props)));
    await prom;
    if (fiber !== this.fiber) {
      return;
    }
    component.props = props;
    this.props = rawProps;
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

  moveBefore(other: ComponentNode | null, afterNode: Node | null) {
    this.bdom!.moveBefore(other ? other.bdom : null, afterNode);
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

  // ---------------------------------------------------------------------------
  // Some debug helpers
  // ---------------------------------------------------------------------------
  get name(): string {
    return this.component.constructor.name;
  }

  get subscriptions(): ReturnType<typeof getSubscriptions> {
    const render = batchedRenderFunctions.get(this);
    return render ? getSubscriptions(render) : [];
  }
}
