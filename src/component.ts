import type { App } from "./app";
import type { BDom } from "./bdom";
import { EventBus } from "./event_bus";
import { Fiber, MountFiber, RootFiber } from "./fibers";

export const enum STATUS {
  CREATED,
  WILLSTARTED, // willstart has been called
  RENDERED, // first render is completed (so, vnode is now defined)
  MOUNTED, // is ready, and in DOM. It has a valid el
  UNMOUNTED, // has a valid el, but is not in DOM
  DESTROYED,
}

export class OwlNode {
  app: App;
  bdom: null | BDom = null;
  component: Component;
  fiber: Fiber | null = null;
  status: STATUS = STATUS.CREATED;
  renderFn: Function;

  constructor(app: App, C: typeof Component, props: any) {
    this.app = app;
    const component = new C(props, app.env, this);
    this.component = component;
    this.renderFn = app.getTemplate(C.template).bind(null, component);
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
    return render(this.__owl__);
  }
}

export function mount<T extends typeof Component>(
  app: App,
  C: T,
  props: any,
  target: HTMLElement
): Promise<InstanceType<T>> {
  const node = new OwlNode(app, C, props);

  const fiber = new MountFiber(node, target);
  node.fiber = fiber;

  app.scheduler.addFiber(fiber);
  // rendering
  fiber.bdom = node.renderFn();
  fiber.counter--;

  return fiber.promise.then(() => node.component);
}

function render(node: OwlNode): Promise<void> {
  const fiber = new RootFiber(node);
  node.fiber = fiber;
  node.app.scheduler.addFiber(fiber);

  fiber.bdom = node.renderFn();
  fiber.counter--;

  return fiber.promise;
}
