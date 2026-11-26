import { vi, type Mock } from "vitest";

export function getConsoleOutput(): string[] {
  return (globalThis as any).__owl_console_output.splice(0);
}
import { diff } from "@vitest/utils/diff";
import {
  Component,
  onMounted,
  onWillDestroy,
  onWillStart,
  onWillUnmount,
  onWillUpdateProps,
  xml,
  effect,
} from "../src";
import { helpers } from "../src/rendering/template_helpers";
import { Content, create, Owner } from "../src/rendering/content";
import { TemplateSet, globalTemplates } from "../src/template_set";
import { createBlock } from "../src/blockdom";
import { compile } from "@odoo/owl-compiler";
import { OwlError, useScope } from "@odoo/owl-core";

const bdom = { createBlock };

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

/**
 * Instantiates a template once (outside of any component), in a new owner.
 */
export function renderToContent(template: string, context: any = {}, node?: any): Content {
  if (!node) {
    if (!context.__owl__) {
      context.__owl__ = { component: context };
    } else {
      context.__owl__.component = context;
    }
    node = null;
  }
  const fn = compile(template);
  if (shouldSnapshot && !snapshottedTemplates.has(template)) {
    snapshottedTemplates.add(template);
    expect(fn.toString()).toMatchSnapshot();
  }
  const app = {};
  const owner = new Owner(node, null);
  return create(owner, () => fn(app as any, bdom, helpers).call(context, context, node));
}

export const renderToBdom = renderToContent;

export function renderToString(template: string, context: any = {}, node?: any): string {
  const fixture = makeTestFixture();
  const content = renderToContent(template, context, node);
  content.mount(fixture, null);
  return fixture.innerHTML;
}

export class TestContext extends TemplateSet {
  renderToString(name: string, context: any = {}): string {
    const renderFn = this.getTemplate(name);
    const owner = new Owner(null as any, null);
    const content = create(owner, () => renderFn.call(context, context, null as any));
    const fixture = makeTestFixture();
    content.mount(fixture, null);
    return fixture.innerHTML;
  }
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

  const originalCompileTemplate = (TemplateSet.prototype as any)._compileTemplate;
  (TemplateSet.prototype as any)._compileTemplate = function (
    name: string,
    template: string | Element
  ) {
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
  const scope = useScope();
  let name = scope.componentName;
  if (key) {
    name = `${name} (${key})`;
  }
  logStep(`${name}:setup`);
  expect(name + ": " + scope.status).toBe(name + ": 0");

  if (!skipAsyncHooks) {
    onWillStart(() => {
      expect(name + ": " + scope.status).toBe(name + ": 0");
      logStep(`${name}:willStart`);
    });
  }

  onMounted(() => {
    expect(name + ": " + scope.status).toBe(name + ": 1");
    logStep(`${name}:mounted`);
  });

  if (!skipAsyncHooks) {
    onWillUpdateProps(() => {
      expect(name + ": " + scope.status).toBe(name + ": 1");
      logStep(`${name}:willUpdateProps`);
    });
  }

  onWillUnmount(() => {
    expect(name + ": " + scope.status).toBe(name + ": 1");
    logStep(`${name}:willUnmount`);
  });

  onWillDestroy(() => {
    expect(scope.status).not.toBe(2);
    logStep(`${name}:willDestroy`);
  });
}

export function children(w: Component): Component[] {
  return [...w.__owl__.children].map((node) => node.component);
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
  spy: Mock,
  count: number,
  opt: { args?: any[]; result?: any } = {}
): void {
  expect(spy).toHaveBeenCalledTimes(count);
  if ("args" in opt) expect(spy).toHaveBeenLastCalledWith(...opt.args!);
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

export function nextAppError(app: any): Promise<Error> {
  let resolve: (value: Error) => void;
  const result = new Promise<Error>((res) => (resolve = res));

  const original = app._handleError;
  app._handleError = (error: any) => {
    app._handleError = original;
    resolve(error);
  };

  // Also catch rejections from root mount promises
  for (const root of app.roots) {
    root.promise.catch((err: any) => {
      app._handleError = original;
      resolve(err);
    });
  }

  return result;
}

declare module "vitest" {
  interface Assertion {
    toBeLogged(): void;
  }
}

export type SpyEffect<T> = (() => () => void) & { spy: Mock };
export function spyEffect<T>(fn: () => T): SpyEffect<T> {
  const spy = vi.fn(fn);
  const unsubscribeWrapper = () => effect(spy);
  const wrapped = Object.assign(unsubscribeWrapper, { spy }) as SpyEffect<T>;
  return wrapped;
}
