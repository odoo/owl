import type { App } from "./app";
import type { Block } from "./bdom";
import type { Component } from "./component";
import { EventBus } from "./event_bus";
import { Fiber, makeRootFiber, MountFiber, RootFiber } from "./fibers";
import { STATUS } from "./status";

let currentNode: OwlNode | null = null;

export function getCurrent(): OwlNode | null {
  return currentNode;
}

type LifecycleHook = Function;

export class OwlNode<T extends typeof Component = any> extends EventBus {
  app: App;
  bdom: null | Block = null;
  component: InstanceType<T>;
  fiber: Fiber | null = null;
  status: STATUS = STATUS.NEW;
  renderFn: Function;
  children: { [key: string]: OwlNode } = Object.create(null);
  slots: any = {};
  refs: any = {};

  willStart: LifecycleHook[] = [];
  willUpdateProps: LifecycleHook[] = [];
  willUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];
  willPatch: LifecycleHook[] = [];
  patched: LifecycleHook[] = [];
  destroyed: LifecycleHook[] = [];

  constructor(app: App, C: T, props: any) {
    super();
    this.app = app;
    currentNode = this;
    const component: InstanceType<T> = new C(props, app.env, this) as any;
    this.component = component;
    component.setup();
    this.renderFn = app.getTemplate(C.template).bind(null, component);
  }

  async mount(target: any): Promise<InstanceType<T>> {
    const fiber = new MountFiber(this, target);
    this.app.scheduler.addFiber(fiber);
    await this.initiateRender(fiber);
    return fiber.promise.then(() => this.component);
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

  async initiateRender(fiber: Fiber | MountFiber) {
    const component = this.component;
    const prom = Promise.all(this.willStart.map((f) => f.call(component)));
    await prom;
    if (this.status === STATUS.NEW && this.fiber === fiber) {
      this._render(fiber);
    }
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

  _render(fiber: Fiber | RootFiber) {
    fiber.bdom = this.renderFn();
    fiber.root.counter--;
  }

  destroy() {
    if (this.status === STATUS.MOUNTED) {
      callWillUnmount(this);
      this.bdom!.remove();
    }
    callDestroyed(this);

    function callWillUnmount(node: OwlNode) {
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

    function callDestroyed(node: OwlNode) {
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
}
