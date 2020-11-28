import { BDom, Block, Blocks } from "./bdom";
import { TemplateSet } from "./qweb_compiler";
import { observe } from "./reactivity";

// -----------------------------------------------------------------------------
//  Global templates
// -----------------------------------------------------------------------------

let nextId = 1;
export const globalTemplates = new TemplateSet();

export function xml(strings: TemplateStringsArray, ...args: any[]) {
  const name = `__template__${nextId++}`;
  const value = String.raw(strings, ...args);
  globalTemplates.add(name, value);
  return name;
}

// -----------------------------------------------------------------------------
//  Component
// -----------------------------------------------------------------------------

interface ComponentData {
  bdom: null | BDom;
  render: () => BDom;
  fiber: Fiber | null;
  willStartCB: Function;
  mountedCB: Function;
  isMounted: boolean;
  children: { [key: string]: Component };
  slots?: any;
}

export class Component {
  static template: string;
  __owl__: ComponentData = currentData;
  props: any;

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
    const fiber = new RootFiber(this.__owl__!);
    scheduler.addFiber(fiber);
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
    const fiber = new ChildFiber(parentData, parentData.fiber!);
    let component = parentData.children[key];
    if (component) {
      // update
      updateAndRender(component, fiber, props);
    } else {
      // new component
      const components = ctx.constructor.components || ctx.components;
      const C = components[name];
      component = prepare(C, props);
      parentData.children[key] = component;
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

  setupHandler(index: number) {
    const eventType = this.handlers![index][0];
    const el = this.component.el!;
    el.addEventListener(eventType, () => {
      const info = this.handlers![index];
      const [, callback, ctx] = info;
      if (ctx.__owl__ && !ctx.__owl__.isMounted) {
        return;
      }
      callback();
    });
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

// -----------------------------------------------------------------------------
//  Scheduler
// -----------------------------------------------------------------------------

export class Scheduler {
  tasks: RootFiber[] = [];
  isRunning: boolean = false;
  requestAnimationFrame: Window["requestAnimationFrame"];

  constructor(requestAnimationFrame: Window["requestAnimationFrame"]) {
    this.requestAnimationFrame = requestAnimationFrame;
  }

  start() {
    this.isRunning = true;
    this.scheduleTasks();
  }

  stop() {
    this.isRunning = false;
  }

  addFiber(fiber: RootFiber) {
    this.tasks.push(fiber);
    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Process all current tasks. This only applies to the fibers that are ready.
   * Other tasks are left unchanged.
   */
  flush() {
    let tasks = this.tasks;
    this.tasks = [];
    tasks = tasks.filter((fiber) => {
      if (fiber.counter === 0) {
        if (!fiber.error) {
          fiber.complete();
        }
        fiber.resolve();
        return false;
      }
      return true;
    });
    this.tasks = tasks.concat(this.tasks);
    if (this.tasks.length === 0) {
      this.stop();
    }
  }

  scheduleTasks() {
    this.requestAnimationFrame(() => {
      this.flush();
      if (this.isRunning) {
        this.scheduleTasks();
      }
    });
  }
}

const scheduler = new Scheduler(window.requestAnimationFrame.bind(window));

// -----------------------------------------------------------------------------
//  Internal rendering stuff
// -----------------------------------------------------------------------------

class BaseFiber {
  bdom: BDom | null = null;
  error?: Error;
  __owl__: ComponentData;
  constructor(__owl__: ComponentData) {
    this.__owl__ = __owl__;
  }
}

type Fiber = ChildFiber | RootFiber;

class ChildFiber extends BaseFiber {
  bdom: BDom | null = null;
  error?: Error;
  root: RootFiber;
  parent: BaseFiber;

  constructor(__owl__: ComponentData, parent: Fiber) {
    super(__owl__);
    this.parent = parent;
    const root = parent.root;
    root.counter++;
    root.childNumber++;
    this.root = root;
  }
}

class RootFiber extends BaseFiber {
  counter: number = 1;
  childNumber: number = 1;
  root: RootFiber = this;

  resolve!: () => void;
  reject!: (error: Error) => void;
  promise = new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

  complete() {
    this.__owl__!.bdom!.patch(this.bdom);
  }
}

class MountingFiber extends RootFiber {
  target: HTMLElement | DocumentFragment;

  constructor(__owl__: ComponentData, target: HTMLElement | DocumentFragment) {
    super(__owl__);
    this.target = target;
  }
  complete() {
    this.__owl__!.bdom! = this.__owl__!.fiber!.bdom!;
    this.__owl__!.bdom!.mount(this.target);
    if (document.body.contains(this.target)) {
      this.__owl__.mountedCB();
      this.__owl__.isMounted = true;
    }
  }
}

type Env = any;

interface MountParameters {
  env?: Env;
  target: HTMLElement | DocumentFragment;
  props?: any;
}

interface Type<T> extends Function {
  new (...args: any[]): T;
}

let current: Component | null = null;
let currentData: ComponentData;

export function mount<T extends Type<Component>>(
  C: T,
  params: MountParameters
): Promise<InstanceType<T>>;
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
  const { target, props } = params;
  const component = prepare(C, props || {});
  const fiber = new MountingFiber(component.__owl__!, target);
  scheduler.addFiber(fiber);
  internalRender(component, fiber);
  await fiber.promise;
  return component;
}

function prepare(C: any, props: any): Component {
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
  };
  currentData = __owl__;

  component = new C(props);
  component.setup();
  __owl__.render = globalTemplates.getFunction(template).bind(null, component);
  return component;
}

async function internalRender(c: Component, fiber: Fiber) {
  const __owl__ = c.__owl__!;
  __owl__.fiber = fiber;
  await __owl__.willStartCB();
  fiber.bdom = __owl__.render();
  fiber.root.counter--;
}

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function useState<T>(state: T): T {
  const component: Component = current!;
  return observe(state, () => component.render());
}

export function onWillStart(cb: any) {
  const component: Component = current!;
  const prev = currentData!.willStartCB;
  currentData!.willStartCB = () => {
    return Promise.all([prev.call(component), cb.call(component)]);
  };
}

export function onMounted(cb: any) {
  const component: Component = current!;
  const prev = currentData!.mountedCB;
  currentData!.mountedCB = () => {
    prev();
    cb.call(component);
  };
}
