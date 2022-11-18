import { diff } from "jest-diff";
import {
  blockDom,
  Component,
  onMounted,
  onPatched,
  onRendered,
  onWillDestroy,
  onWillPatch,
  onWillRender,
  onWillStart,
  onWillUnmount,
  onWillUpdateProps,
  status,
  useComponent,
  xml,
} from "../src";
import { helpers } from "../src/runtime/template_helpers";
import { TemplateSet, globalTemplates } from "../src/runtime/template_set";
import { BDom } from "../src/runtime/blockdom";
import { compile } from "../src/compiler";
import { OwlError } from "../src/runtime/error_handling";

const mount = blockDom.mount;

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
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

interface Deferred extends Promise<any> {
  resolve(val?: any): void;
  reject(val?: any): void;
}

export function makeDeferred(): Deferred {
  let resolve, reject;
  let def = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  (def as any).resolve = resolve;
  (def as any).reject = reject;
  return <Deferred>def;
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

const steps: string[] = [];

export function logStep(step: string) {
  steps.push(step);
}
export function useLogLifecycle(key?: string, skipAsyncHooks: boolean = false) {
  const component = useComponent();
  let name = component.constructor.name;
  if (key) {
    name = `${name} (${key})`;
  }
  logStep(`${name}:setup`);
  expect(name + ": " + status(component)).toBe(name + ": " + "new");

  if (!skipAsyncHooks) {
    onWillStart(() => {
      expect(name + ": " + status(component)).toBe(name + ": " + "new");
      logStep(`${name}:willStart`);
    });
  }

  onMounted(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    logStep(`${name}:mounted`);
  });

  if (!skipAsyncHooks) {
    onWillUpdateProps(() => {
      expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
      logStep(`${name}:willUpdateProps`);
    });
  }

  onWillRender(() => {
    logStep(`${name}:willRender`);
  });

  onRendered(() => {
    logStep(`${name}:rendered`);
  });

  onWillPatch(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    logStep(`${name}:willPatch`);
  });

  onPatched(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    logStep(`${name}:patched`);
  });

  onWillUnmount(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    logStep(`${name}:willUnmount`);
  });

  onWillDestroy(() => {
    expect(status(component)).not.toBe("destroyed");
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
  return new Promise((resolve) => {
    app.handleError = (...args: Parameters<typeof handleError>) => {
      try {
        handleError.call(app, ...args);
      } catch (e: any) {
        app.handleError = handleError;
        resolve(e);
      }
    };
  });
}

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeLogged(): R;
    }
  }
}
