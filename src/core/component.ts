import type { App } from "./app";
import type { Block } from "../bdom";
import { EventBus } from "./event_bus";
import { ChildFiber, MountFiber, RootFiber } from "./fibers";

export const enum STATUS {
  NEW,
  WILLSTARTED, // willstart has been called
  CREATED, // after first render is complete
  MOUNTED, // is ready, and in DOM. It has a valid el
  UNMOUNTED, // has a valid el, but is no longer in DOM
  DESTROYED,
}

export class OwlNode {
  app: App;
  bdom: null | Block = null;
  component: Component;
  fiber: ChildFiber | RootFiber | null = null;
  status: STATUS = STATUS.NEW;
  renderFn: Function;
  children: { [key: string]: OwlNode } = {};

  constructor(app: App, C: typeof Component, props: any) {
    this.app = app;
    const component = new C(props, app.env, this);
    this.component = component;
    this.renderFn = app.getTemplate(C.template).bind(null, component);
  }

  mount(target: any) {
    const fiber = new MountFiber(this, target);
    this.fiber = fiber;

    this.app.scheduler.addFiber(fiber);
    // rendering
    fiber.bdom = this.renderFn();
    fiber.counter--;

    return fiber.promise.then(() => this.component);
  }
  render() {
    const fiber = new RootFiber(this);
    this.fiber = fiber;
    this.app.scheduler.addFiber(fiber);

    fiber.bdom = this.renderFn();
    fiber.counter--;

    return fiber.promise;
  }

  async initiateRender() {
    await Promise.resolve(); // should be willStart stuff
    const fiber = this.fiber!;
    fiber.bdom = this.renderFn();
    fiber.root.counter--;
  }
}

export class Component extends EventBus {
  static template: string = "";

  props: any;
  env: any;
  __owl__: OwlNode;

  constructor(props: any, env: any, node: OwlNode) {
    super();
    this.props = props;
    this.env = env;
    this.__owl__ = node;
    this.setup();
  }
  get el() {
    const node = this.__owl__;
    return node.bdom ? node.bdom.el : null;
  }

  setup() {}

  render(): Promise<void> {
    return this.__owl__.render();
  }
}
