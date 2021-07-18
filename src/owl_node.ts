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
  children: { [key: string]: OwlNode } = {};
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
    this.status = STATUS.WILLSTARTED;
    await prom;
    if (this.status === STATUS.WILLSTARTED && this.fiber === fiber) {
      this._render(fiber);
    }
  }

  callWillUnmount() {
    const component = this.component;
    for (let cb of this.willUnmount) {
      cb.call(component);
    }
    for (let child of Object.values(this.children)) {
      if (child.status === STATUS.MOUNTED) {
        child.callWillUnmount();
      }
    }
  }

  callDestroyed() {
    const component = this.component;
    for (let cb of this.destroyed) {
      cb.call(component);
    }
    for (let child of Object.values(this.children)) {
      child.callDestroyed();
    }
  }

  callWillPatch() {
    const component = this.component;
    for (let cb of this.willPatch) {
      cb.call(component);
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
    // this.fiber = fiber;
    fiber.bdom = this.renderFn();
    fiber.root.counter--;
  }

  destroy() {
    switch (this.status) {
      case STATUS.MOUNTED:
        this.callWillUnmount();
        this.bdom!.remove();
        break;
    }

    this.callDestroyed();
    this.status = STATUS.DESTROYED;
  }
}
