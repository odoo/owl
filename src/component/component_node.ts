import type { App, Env } from "../app/app";
import { BDom, VNode } from "../blockdom";
import { Component } from "./component";
import {
  Fiber,
  makeChildFiber,
  makeRootFiber,
  MountFiber,
  MountOptions,
  RootFiber,
} from "./fibers";
import { handleError, fibersInError } from "./error_handling";
import { applyDefaultProps } from "./props_validation";
import { STATUS } from "./status";
import { applyStyles } from "./style";

export function component(
  name: string | typeof Component,
  props: any,
  key: string,
  ctx: ComponentNode,
  parent: any
): ComponentNode {
  let node: any = ctx.children[key];
  let isDynamic = typeof name !== "string";

  if (node) {
    if (node.status < STATUS.MOUNTED) {
      node.destroy();
      node = undefined;
    } else if (node.status === STATUS.DESTROYED) {
      node = undefined;
    }
  }
  if (isDynamic && node && node.component.constructor !== name) {
    node = undefined;
  }

  const parentFiber = ctx.fiber!;
  if (node) {
    node.updateAndRender(props, parentFiber);
  } else {
    // new component
    let C;
    if (isDynamic) {
      C = name;
    } else {
      C = parent.constructor.components[name as any];
      if (!C) {
        throw new Error(`Cannot find the definition of component "${name}"`);
      }
    }
    node = new ComponentNode(C, props, ctx.app, ctx);
    ctx.children[key] = node;

    const fiber = makeChildFiber(node, parentFiber);
    node.initiateRender(fiber);
  }
  return node;
}

// -----------------------------------------------------------------------------
//  Component VNode
// -----------------------------------------------------------------------------

let currentNode: ComponentNode | null = null;

export function getCurrent(): ComponentNode | null {
  return currentNode;
}

type LifecycleHook = Function;

export class ComponentNode<T extends typeof Component = typeof Component>
  implements VNode<ComponentNode>
{
  el?: HTMLElement | Text | undefined;
  app: App;
  fiber: Fiber | null = null;
  component: InstanceType<T>;
  bdom: BDom | null = null;
  status: STATUS = STATUS.NEW;

  renderFn: Function;
  parent: ComponentNode | null;
  level: number;
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

  constructor(C: T, props: any, app: App, parent?: ComponentNode) {
    currentNode = this;
    this.app = app;
    this.parent = parent || null;
    this.level = parent ? parent.level + 1 : 0;
    applyDefaultProps(props, C);
    const env = (parent && parent.childEnv) || app.env;
    this.childEnv = env;
    this.component = new C(props, env, this) as any;
    this.renderFn = app.getTemplate(C.template).bind(this.component, this.component, this);
    if (C.style) {
      applyStyles(C);
    }
    this.component.setup();
  }

  mountComponent(target: any, options?: MountOptions) {
    const fiber = new MountFiber(this, target, options);
    this.app.scheduler.addFiber(fiber);
    this.initiateRender(fiber);
  }

  async initiateRender(fiber: Fiber | MountFiber) {
    this.fiber = fiber;
    if (this.mounted.length) {
      fiber.root.mounted.push(fiber);
    }
    const component = this.component;
    try {
      await Promise.all(this.willStart.map((f) => f.call(component)));
    } catch (e) {
      handleError({ node: this, error: e });
      return;
    }
    if (this.status === STATUS.NEW && this.fiber === fiber) {
      this._render(fiber);
    }
  }

  async render() {
    let current = this.fiber;
    if (current && current.root.locked) {
      await Promise.resolve();
      // situation may have changed after the microtask tick
      current = this.fiber;
    }
    if (current && !current.bdom && !fibersInError.has(current)) {
      return;
    }
    if (!this.bdom && !current) {
      return;
    }

    const fiber = makeRootFiber(this);
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
    if (this.fiber && (current || !fiber.parent)) {
      this._render(fiber);
    }
  }

  _render(fiber: Fiber | RootFiber) {
    try {
      fiber.bdom = this.renderFn();
      fiber.root.counter--;
    } catch (e) {
      handleError({ node: this, error: e });
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
    for (let cb of this.willDestroy) {
      cb.call(component);
    }
    this.status = STATUS.DESTROYED;
  }

  async updateAndRender(props: any, parentFiber: Fiber) {
    // update
    const fiber = makeChildFiber(this, parentFiber);
    this.fiber = fiber;
    const component = this.component;
    applyDefaultProps(props, component.constructor as any);
    const prom = Promise.all(this.willUpdateProps.map((f) => f.call(component, props)));
    await prom;
    if (fiber !== this.fiber) {
      return;
    }
    component.props = props;
    this._render(fiber);
    const parentRoot = parentFiber.root;
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
    this.fiber = null;
  }

  moveBefore(other: ComponentNode | null, afterNode: Node | null) {
    this.bdom!.moveBefore(other ? other.bdom : null, afterNode);
  }

  patch() {
    this.bdom!.patch(this!.fiber!.bdom!, false);
    this.fiber!.appliedToDom = true;
    this.fiber = null;
  }

  beforeRemove() {
    this._destroy();
  }

  remove() {
    this.bdom!.remove();
  }
}
