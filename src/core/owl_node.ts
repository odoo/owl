import type { App } from "./app";
import type { Block } from "../bdom";
import { ChildFiber, MountFiber, RootFiber } from "./fibers";
import type { Component } from "./component";
import { STATUS } from "../status";
import { EventBus } from "../event_bus";

let currentNode: OwlNode | null = null;

export function getCurrent(): OwlNode | null {
  return currentNode;
}

type LifecycleHook = Function;

export class OwlNode extends EventBus {
  app: App;
  bdom: null | Block = null;
  component: Component;
  fiber: ChildFiber | RootFiber | null = null;
  status: STATUS = STATUS.NEW;
  renderFn: Function;
  children: { [key: string]: OwlNode } = {};
  slots: any = {};
  refs: any = {};

  willStart: LifecycleHook[] = [];
  beforeUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];
  beforePatch: LifecycleHook[] = [];
  patched: LifecycleHook[] = [];

  constructor(app: App, C: typeof Component, props: any) {
    super();
    this.app = app;
    currentNode = this;
    const component = new C(props, app.env, this);
    component.setup();
    this.component = component;
    this.renderFn = app.getTemplate(C.template).bind(null, component);
  }

  async mount(target: any) {
    const fiber = new MountFiber(this, target);
    this.app.scheduler.addFiber(fiber);
    await this.initiateRender(fiber);
    return fiber.promise.then(() => this.component);
  }

  async render() {
    await Promise.resolve();
    const fiber = new RootFiber(this);
    this.app.scheduler.addFiber(fiber);
    this._render(fiber);
    return fiber.promise;
  }

  async initiateRender(fiber: ChildFiber | MountFiber) {
    const component = this.component;
    const prom = Promise.all(this.willStart.map((f) => f.call(component)));
    this.status = STATUS.WILLSTARTED;
    await prom;
    if (this.status === STATUS.WILLSTARTED) {
      this._render(fiber);
    }
  }

  callBeforeUnmount() {
    const component = this.component;
    for (let cb of this.beforeUnmount) {
      cb.call(component);
    }
    for (let child of Object.values(this.children)) {
      child.callBeforeUnmount();
    }
  }

  callBeforePatch() {
    const component = this.component;
    for (let cb of this.beforePatch) {
      cb.call(component);
    }
  }

  async updateAndRender(props: any, fiber: ChildFiber) {
    await Promise.resolve(); // willupdateprops
    this.component.props = props;
    this._render(fiber);
  }

  _render(fiber: ChildFiber | RootFiber) {
    this.fiber = fiber;
    fiber.bdom = this.renderFn();
    fiber.root.counter--;
  }

  destroy() {
    switch (this.status) {
      case STATUS.MOUNTED:
        this.callBeforeUnmount();
        this.bdom!.remove();
        break;
    }
    this.status = STATUS.DESTROYED;
  }
}
