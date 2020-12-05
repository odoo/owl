import { App } from "./app";
import { BDom, Block, Blocks } from "./bdom";
import { ChildFiber, Fiber, MountingFiber, RootFiber } from "./fibers";

// -----------------------------------------------------------------------------
//  Component
// -----------------------------------------------------------------------------

export interface ComponentData {
  bdom: null | BDom;
  render: () => BDom;
  fiber: Fiber | null;
  willStartCB: Function;
  mountedCB: Function;
  isMounted: boolean;
  children: { [key: string]: Component };
  slots?: any;
  app: App;
}

export class Component {
  static template: string;
  __owl__: ComponentData = currentData;
  props: any;
  env: any = currentEnv;

  constructor(props: any) {
    current = this;
    const __owl__ = currentData;
    __owl__.willStartCB = this.willStart.bind(this);
    __owl__.mountedCB = this.mounted.bind(this);
    this.props = props;
  }

  setup() {}
  async willStart(): Promise<void> {}
  async willUpdateProps(props: any): Promise<void> {}
  mounted() {}

  get el(): ChildNode | null {
    const bdom = this.__owl__.bdom;
    return bdom ? bdom.el : null;
  }

  async render(): Promise<void> {
    const __owl__ = this.__owl__;
    const fiber = new RootFiber(__owl__!);
    __owl__.app.scheduler.addFiber(fiber);
    internalRender(this, fiber);
    await fiber.promise;
  }
}

// -----------------------------------------------------------------------------
//  Component Block
// -----------------------------------------------------------------------------

class BComponent extends Block {
  component: Component;
  handlers?: any[];

  constructor(name: string, props: any, key: string, ctx: any) {
    super();
    const parentData: ComponentData = ctx.__owl__;
    let component = parentData.children[key];
    if (component) {
      // update
      const fiber = new ChildFiber(component.__owl__, parentData.fiber!);
      const parentFiber = parentData.fiber!;
      parentFiber.child = fiber; // wrong!
      updateAndRender(component, fiber, props);
    } else {
      // new component
      const components = ctx.constructor.components || ctx.components;
      const C = components[name];
      component = prepare(C, props, parentData.app);
      parentData.children[key] = component;
      const fiber = new ChildFiber(component.__owl__, parentData.fiber!);
      const parentFiber = parentData.fiber!;
      parentFiber.child = fiber; // wrong!
      internalRender(component, fiber);
    }
    this.component = component;
  }

  firstChildNode(): ChildNode | null {
    const bdom = this.component.__owl__.bdom;
    return bdom ? bdom.firstChildNode() : null;
  }

  mountBefore(anchor: ChildNode) {
    this.component.__owl__!.bdom = this.component.__owl__!.fiber!.bdom;
    this.component.__owl__!.bdom!.mountBefore(anchor);
  }
  patch() {
    this.component.__owl__!.bdom!.patch(this.component.__owl__!.fiber!.bdom);
  }
}

export class BComponentH extends BComponent {
  handlers: any[];
  constructor(handlers: number, name: string, props: any, key: string, ctx: any) {
    super(name, props, key, ctx);
    this.handlers = new Array(handlers);
  }

  mountBefore(anchor: ChildNode) {
    super.mountBefore(anchor);
    this.setupHandlers();
  }

  setupHandlers() {
    for (let i = 0; i < this.handlers.length; i++) {
      const handler = this.handlers[i];
      const eventType = handler[0];
      const el = this.component.el!;
      el.addEventListener(eventType, () => {
        const info = this.handlers![i];
        const [, callback, ctx] = info;
        if (ctx.__owl__ && !ctx.__owl__.isMounted) {
          return;
        }
        callback();
      });
    }
  }
}

async function updateAndRender(component: Component, fiber: ChildFiber, props: any) {
  const componentData = component.__owl__;
  componentData.fiber = fiber;
  await component.willUpdateProps(props);
  component.props = props;
  fiber.bdom = componentData.render();
  fiber.root.counter--;
}

Blocks.BComponent = BComponent;
Blocks.BComponentH = BComponentH;

type Env = any;

interface MountParameters {
  env?: Env;
  target: HTMLElement | DocumentFragment;
  props?: any;
  app?: App | Component;
}

interface Type<T> extends Function {
  new (...args: any[]): T;
}

let current: Component | null = null;
let currentData: ComponentData;
let currentEnv: any;

export function mount<T extends Type<Component>>(
  C: T | Component,
  params: MountParameters
): Promise<InstanceType<T>>;
export async function mount(C: any, params: MountParameters) {
  if (!(params.target instanceof HTMLElement || params.target instanceof DocumentFragment)) {
    throw new Error("Cannot mount component: the target is not a valid DOM element");
  }
  if (C instanceof Component) {
    // we move component elsewhere
    C.__owl__.bdom!.move(params.target);
    return;
  }
  const { target, props, env, app } = params;
  currentEnv = env || {};
  const componentApp = app ? (app instanceof App ? app : app.__owl__.app) : new App();
  const component = prepare(C, props || {}, componentApp);
  const __owl__ = component.__owl__!;
  const fiber = new MountingFiber(__owl__, target);
  __owl__.app.scheduler.addFiber(fiber);
  internalRender(component, fiber);
  await fiber.promise;
  return component;
}

function prepare(C: any, props: any, app: App): Component {
  let component: Component;
  let template: string = (C as any).template;
  if (!template) {
    throw new Error(`Could not find template for component "${C.name}"`);
  }
  const __owl__: ComponentData = {
    render: null as any,
    bdom: null,
    fiber: null,
    willStartCB: null as any,
    mountedCB: null as any,
    isMounted: false,
    children: {},
    app,
  };
  currentData = __owl__;

  component = new C(props);
  component.setup();
  __owl__.render = app.getTemplate(template).bind(null, component);
  return component;
}

async function internalRender(c: Component, fiber: Fiber) {
  const __owl__ = c.__owl__!;
  __owl__.fiber = fiber;
  await __owl__.willStartCB();
  fiber.bdom = __owl__.render();
  fiber.root.counter--;
}

export function useComponent(): Component {
  return current!;
}

export function useComponentData(): ComponentData {
  return currentData;
}
