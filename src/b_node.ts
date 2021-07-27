import type { App } from "./app";
import { Block } from "./bdom";
import type { Component } from "./component";
import {
  Fiber,
  makeChildFiber,
  makeRootFiber,
  MountFiber,
  RootFiber,
  __internal__destroyed,
} from "./fibers";
import { STATUS } from "./status";

// -----------------------------------------------------------------------------
//  Component Block
// -----------------------------------------------------------------------------

let currentNode: BNode | null = null;

export function getCurrent(): BNode | null {
  return currentNode;
}

type LifecycleHook = Function;

export class BNode<T extends typeof Component = any> extends Block {
  parentClass?: any = null;
  classTarget?: HTMLElement;
  handlers: any = null;
  app: App;
  fiber: Fiber | null = null;
  component: InstanceType<T>;
  bdom: any;
  status: STATUS = STATUS.NEW;

  renderFn: Function;
  children: { [key: string]: BNode } = Object.create(null);
  slots: any = {};
  refs: any = {};

  willStart: LifecycleHook[] = [];
  willUpdateProps: LifecycleHook[] = [];
  willUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];
  willPatch: LifecycleHook[] = [];
  patched: LifecycleHook[] = [];
  destroyed: LifecycleHook[] = [];

  constructor(C: T, props: any, app: App) {
    super();
    currentNode = this;
    this.app = app;
    this.component = new C(props, app.env, this) as any;
    this.renderFn = app.getTemplate(C.template).bind(null, this.component, this);
    this.component.setup();
  }

  mountComponent(target: any): Promise<InstanceType<T>> {
    const fiber = new MountFiber(this, target);
    this.app.scheduler.addFiber(fiber);
    this.initiateRender(fiber);
    return fiber.promise.then(() => this.component);
  }

  async initiateRender(fiber: Fiber | MountFiber) {
    const component = this.component;
    const prom = Promise.all(this.willStart.map((f) => f.call(component)));
    await prom;
    if (this.status === STATUS.NEW && this.fiber === fiber) {
      this._render(fiber);
    }
  }

  async render() {
    if (this.fiber && !this.fiber.bdom) {
      return this.fiber.root.promise;
    }
    if (!this.bdom && !this.fiber) {
      // should find a way to return the future mounting promise
      return;
    }

    const fiber = makeRootFiber(this);
    this.app.scheduler.addFiber(fiber);
    await Promise.resolve();
    if (this.fiber === fiber) {
      this._render(fiber);
    }
    return fiber.root.promise;
  }

  _render(fiber: Fiber | RootFiber) {
    try {
      fiber.bdom = this.renderFn();
    } catch (e) {
      fiber.root.error = e;
      this.handleError(fiber);
    }
    fiber.root.counter--;
  }

  handleError(fiber: Fiber) {
    fiber.node.app.destroy();
  }

  destroy() {
    if (this.status === STATUS.MOUNTED) {
      callWillUnmount(this);
      this.bdom!.remove();
    }
    callDestroyed(this);

    function callWillUnmount(node: BNode) {
      const component = node.component;
      for (let cb of node.willUnmount) {
        cb.call(component);
      }
      for (let child of Object.values(node.children)) {
        if (child.status === STATUS.MOUNTED) {
          callWillUnmount(child);
        }
      }
    }

    function callDestroyed(node: BNode) {
      const component = node.component;
      node.status = STATUS.DESTROYED;
      for (let child of Object.values(node.children)) {
        callDestroyed(child);
      }
      for (let cb of node.destroyed) {
        cb.call(component);
      }
    }
  }

  /**
   *
   * @param name
   * @param props
   * @param key
   * @param owner the component in which the component was defined
   * @param parent the actual parent (may be different in case of slots)
   */
  getChild(name: string | typeof Component, props: any, key: string, owner: any) {
    let node: any = this.children[key];
    let isDynamic = typeof name !== "string";

    if (node && node.status < STATUS.MOUNTED) {
      node.destroy();
      node = undefined;
    }
    if (isDynamic && node && node.component.constructor !== name) {
      node = undefined;
    }

    const parentFiber = this.fiber!;
    if (node) {
      // update
      const fiber = makeChildFiber(node, parentFiber);
      if (node.willPatch.length) {
        parentFiber.root.willPatch.push(fiber);
      }
      if (node.patched.length) {
        parentFiber.root.patched.push(fiber);
      }
      node.updateAndRender(props, fiber);
    } else {
      // new component
      const C = isDynamic ? name : owner.constructor.components[name as any];
      node = new BNode(C, props, this.app);
      this.children[key] = node;

      const fiber = makeChildFiber(node, parentFiber);
      if (node.mounted.length) {
        parentFiber.root.mounted.push(fiber);
      }
      node.initiateRender(fiber);
    }
    return node;
  }

  async updateAndRender(props: any, fiber: Fiber) {
    const component = this.component;
    const prom = Promise.all(this.willUpdateProps.map((f) => f.call(component, props)));
    await prom;
    if (fiber !== this.fiber) {
      return;
    }
    this.component.props = props;
    this._render(fiber);
  }

  firstChildNode(): ChildNode | null {
    const bdom = this.bdom;
    return bdom ? bdom.firstChildNode() : null;
  }

  mountBefore(anchor: ChildNode) {
    const bdom = this.fiber!.bdom!;
    this.bdom = bdom;
    bdom.mountBefore(anchor);
    if (this.parentClass) {
      const el = this.firstChildNode();
      // this.parentClass = this.parentClass.trim().split(/\s+/);
      if (el instanceof HTMLElement) {
        this.addClass(el);
      }
    }
    this.status = STATUS.MOUNTED;
    this.fiber!.appliedToDom = true;
    this.fiber = null;
    if (this.handlers) {
      for (let i = 0; i < this.handlers.length; i++) {
        const handler = this.handlers[i];
        const eventType = handler[0];
        const el = this.component.el!;
        el.addEventListener(eventType, (ev: Event) => {
          const info = this.handlers![i];
          const [, callback] = info;
          callback(ev);
        });
      }
    }
  }

  moveBefore(anchor: ChildNode) {
    this.bdom!.moveBefore(anchor);
  }

  addClass(el: HTMLElement) {
    this.classTarget = el;
    for (let cl in this.parentClass) {
      el.classList.add(cl);
    }
  }

  removeClass(el: HTMLElement) {
    for (let cl in this.parentClass) {
      el.classList.remove(cl);
    }
  }

  patch() {
    this.bdom!.patch(this!.fiber!.bdom!);
    if (this.parentClass) {
      const el = this.firstChildNode();
      if (el !== this.classTarget) {
        if (el && this.classTarget) {
          this.removeClass(this.classTarget);
          this.addClass(el as any);
        } else if (el) {
          this.addClass(el as any);
        } else {
          this.removeClass(this.classTarget!);
          this.classTarget = undefined;
        }
      }
    }
    this.fiber!.appliedToDom = true;
    this.fiber = null;
  }

  beforeRemove() {
    visitRemovedNodes(this);
  }

  remove() {
    const bdom = this.bdom!;
    bdom.remove();
  }
}

function visitRemovedNodes(node: BNode) {
  if (node.status === STATUS.MOUNTED) {
    const component = node.component;
    for (let cb of node.willUnmount) {
      cb.call(component);
    }
  }
  for (let child of Object.values(node.children)) {
    visitRemovedNodes(child);
  }
  node.status = STATUS.DESTROYED;
  if (node.destroyed.length) {
    __internal__destroyed.push(node);
  }
}
