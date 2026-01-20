import { diff } from "jest-diff";
import {
  blockDom,
  Component,
  onMounted,
  onPatched,
  onWillDestroy,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  onWillUpdateProps,
  status,
  useComponent,
  xml,
  computed,
  effect,
} from "../src";
import { helpers } from "../src/runtime/rendering/template_helpers";
import { TemplateSet, globalTemplates } from "../src/runtime/template_set";
import { BDom } from "../src/runtime/blockdom";
import { compile } from "../src/compiler";
import { OwlError } from "../src/common/owl_error";

const mount = blockDom.mount;

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

// todo: investigate why two ticks are needed
export async function waitScheduler() {
  await nextMicroTick();
  await nextMicroTick();
}

let lastFixture: any = null;

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  if (lastFixture) {
    lastFixture.remove();
  }
  lastFixture = fixture;
  return fixture;
}

beforeEach(() => {
  xml.nextId = 999;
});
export async function nextTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

interface Deferred<T = any> extends Promise<T> {
  resolve(val?: T): void;
  reject(val?: T): void;
}

export function makeDeferred<T = any>(): Deferred<T> {
  let resolve, reject;
  let def = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  (def as any).resolve = resolve;
  (def as any).reject = reject;
  return <Deferred<T>>def;
}

export function trim(str: string): string {
  return str.replace(/\s/g, "");
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

let shouldSnapshot = false;
let snapshottedTemplates: Set<string> = new Set();

export function snapshotTemplate(template: string) {
  const fn = compile(template);
  expect(fn.toString()).toMatchSnapshot();
}

export function renderToBdom(template: string, context: any = {}, node?: any): BDom {
  if (!node) {
    if (!context.__owl__) {
      context.__owl__ = { component: context };
    } else {
      context.__owl__.component = context;
    }
  }
  const fn = compile(template);
  if (shouldSnapshot && !snapshottedTemplates.has(template)) {
    snapshottedTemplates.add(template);
    expect(fn.toString()).toMatchSnapshot();
  }
  const app = {
    createComponent() {},
    createDynamicComponent() {},
  };
  return fn(app as any, blockDom, helpers).call(context, context, node);
}

export function renderToString(template: string, context: any = {}, node?: any): string {
  const fixture = makeTestFixture();
  const bdom = renderToBdom(template, context, node);
  mount(bdom, fixture);
  return fixture.innerHTML;
}

export class TestContext extends TemplateSet {
  renderToString(name: string, context: any = {}): string {
    const renderFn = this.getTemplate(name);
    const bdom = renderFn(context, {});
    const fixture = makeTestFixture();
    mount(bdom, fixture);
    return fixture.innerHTML;
  }
}
export function render(c: Component, deep: boolean = false) {
  return c.__owl__.render(deep)
}

export function snapshotEverything() {
  if (shouldSnapshot) {
    // this function has already been called
    return;
  }
  const globalTemplateNames = new Set(Object.keys(globalTemplates));
  shouldSnapshot = true;
  beforeEach(() => {
    snapshottedTemplates.clear();
  });

  const originalCompileTemplate = TemplateSet.prototype._compileTemplate;
  TemplateSet.prototype._compileTemplate = function (name: string, template: string | Element) {
    const fn = originalCompileTemplate.call(this, "", template);
    if (!globalTemplateNames.has(name)) {
      expect(fn.toString()).toMatchSnapshot();
    }
    return fn;
  };
}

export const steps: string[] = [];

export function logStep(step: string) {
  steps.push(step);
}
export function useLogLifecycle(key?: string, skipAsyncHooks: boolean = false) {
  const component = useComponent();
  const componentStatus = status();
  let name = component.constructor.name;
  if (key) {
    name = `${name} (${key})`;
  }
  logStep(`${name}:setup`);
  expect(name + ": " + componentStatus()).toBe(name + ": " + "new");

  if (!skipAsyncHooks) {
    onWillStart(() => {
      expect(name + ": " + componentStatus()).toBe(name + ": " + "new");
      logStep(`${name}:willStart`);
    });
  }

  onMounted(() => {
    expect(name + ": " + componentStatus()).toBe(name + ": " + "mounted");
    logStep(`${name}:mounted`);
  });

  if (!skipAsyncHooks) {
    onWillUpdateProps(() => {
      expect(name + ": " + componentStatus()).toBe(name + ": " + "mounted");
      logStep(`${name}:willUpdateProps`);
    });
  }

  onWillPatch(() => {
    expect(name + ": " + componentStatus()).toBe(name + ": " + "mounted");
    logStep(`${name}:willPatch`);
  });

  onPatched(() => {
    expect(name + ": " + componentStatus()).toBe(name + ": " + "mounted");
    logStep(`${name}:patched`);
  });

  onWillUnmount(() => {
    expect(name + ": " + componentStatus()).toBe(name + ": " + "mounted");
    logStep(`${name}:willUnmount`);
  });

  onWillDestroy(() => {
    expect(componentStatus()).not.toBe("destroyed");
    logStep(`${name}:willDestroy`);
  });
}

export function children(w: Component): Component[] {
  const childrenMap = w.__owl__.children;
  return Object.keys(childrenMap).map((id) => childrenMap[id].component);
}

export function isDirectChildOf(child: Component, parent: Component): boolean {
  return children(parent).includes(child);
}

export function elem(component: Component): any {
  return component.__owl__.firstNode();
}

export async function editInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
  input.dispatchEvent(new Event("change"));
  return nextTick();
}

export function expectSpy(
  spy: jest.Mock,
  count: number,
  opt: { args?: any[]; result?: any } = {}
): void {
  expect(spy).toHaveBeenCalledTimes(count);
  if ("args" in opt) expect(spy).lastCalledWith(...opt.args!);
  if ("result" in opt) expect(spy).toHaveReturnedWith(opt.result);
}

afterEach(() => {
  if (steps.length) {
    steps.splice(0);
    throw new OwlError("Remaining steps! Should be checked by a .toBeLogged() assertion!");
  }
});

expect.extend({
  toBeLogged(expected) {
    const options = {
      comment: "steps equality",
      isNot: this.isNot,
      promise: this.promise,
    };

    const currentSteps = steps.splice(0);
    const pass = this.equals(currentSteps, expected);

    const message = pass
      ? () =>
          this.utils.matcherHint("toEqual", undefined, undefined, options) +
          "\n\n" +
          `Expected: not ${this.utils.printExpected(expected)}\n` +
          `Received: ${this.utils.printReceived(currentSteps)}`
      : () => {
          const diffString = diff(expected, currentSteps, {
            expand: this.expand,
          });
          return (
            this.utils.matcherHint("toBe", undefined, undefined, options) +
            "\n\n" +
            (diffString && diffString.includes("- Expect")
              ? `Difference:\n\n${diffString}`
              : `Expected: ${this.utils.printExpected(expected)}\n` +
                `Received: ${this.utils.printReceived(currentSteps)}`)
          );
        };

    return { actual: currentSteps, message, pass };
  },
});

export function nextAppError(app: any) {
  const { handleError } = app;
  const rootPromises = [...app.roots].map((r) => r.promise);

  let settled = false;

  const done = (error: any, restore = true) => {
    if (settled) return;
    settled = true;
    if (restore) app.handleError = handleError;
    resolve(error);
  };

  let resolve: (value: any) => void;
  const result = new Promise((res) => (resolve = res));

  app.handleError = (...args: Parameters<typeof handleError>) => {
    try {
      handleError.call(app, ...args);
    } catch (e) {
      done(e);
    }
  };

  for (const p of rootPromises) {
    p.catch((err: any) => done(err));
  }

  return result;
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeLogged(): R;
    }
  }
}

export type SpyComputed<T> = (() => T) & { spy: jest.Mock<any, T[]> };
export function spyComputed<T>(fn: () => T): SpyComputed<T> {
  const spy = jest.fn(fn);
  const d = computed(spy) as SpyComputed<T>;
  d.spy = spy;
  return d;
}

export type SpyEffect<T> = (() => () => void) & { spy: jest.Mock<any, T[]> };
export function spyEffect<T>(fn: () => T): SpyEffect<T> {
  const spy = jest.fn(fn);
  const unsubscribeWrapper = () => effect(spy);
  const wrapped = Object.assign(unsubscribeWrapper, { spy }) as SpyEffect<T>;
  return wrapped;
}
