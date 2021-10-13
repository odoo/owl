import {
  App,
  Component,
  onDestroyed,
  onMounted,
  onPatched,
  onRender,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  onWillUpdateProps,
  status,
  useComponent,
} from "../src";
import { BDom } from "../src/blockdom";
import { blockDom } from "../src";
import { CompileOptions, compileTemplate, Template } from "../src/qweb/compiler";
import { globalTemplates, TemplateSet, UTILS } from "../src/qweb/template_helpers";
import { xml } from "../src/tags";

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

export function snapshotTemplateCode(template: string, options?: CompileOptions) {
  expect(compileTemplate(template, options).toString()).toMatchSnapshot();
}

export function snapshotApp(app: App) {
  const Root = app.Root;
  const template = app.rawTemplates[Root.template];
  snapshotTemplateCode(template, {
    translateFn: app.translateFn,
    translatableAttributes: app.translatableAttributes,
  });
}

export async function nextTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

interface Deferred extends Promise<any> {
  resolve(val?: any): void;
  reject(): void;
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

/**
 * Return the global template xml string corresponding to the given name
 */
// export function fromName(name: string): string {
//   return globalTemplates[name];
// }

export function trim(str: string): string {
  return str.replace(/\s/g, "");
}

export function addTemplate(name: string, template: string): string {
  globalTemplates[name] = template;
  return name;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function compile(template: string): Template {
  // register here the template globally so snapshotEverything
  // can get it
  globalTemplates[template] = template;
  const templateFunction = compileTemplate(template);
  return templateFunction(blockDom, UTILS);
}

export function renderToBdom(template: string, context: any = {}, node: any = {}): BDom {
  return compile(template)(context, node);
}

export function renderToString(template: string, context: any = {}): string {
  const fixture = makeTestFixture();
  const bdom = renderToBdom(template, context);
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
  const consolewarn = console.warn;

  const originalAddTemplate = TemplateSet.prototype.addTemplate;
  TemplateSet.prototype.addTemplate = function (name: string, template: string, options) {
    originalAddTemplate.call(this, name, template, options);
    // register it so snapshotEverything can get it
    globalTemplates[name] = template;
  };

  let globalSet: any;

  beforeAll(() => {
    globalSet = new Set(Object.keys(globalTemplates));
  });

  beforeEach(() => {
    xml.nextId = 9;
  });

  afterEach(() => {
    console.warn = () => {};
    for (let k in globalTemplates) {
      if (globalSet.has(k)) {
        // ignore generic templates
        continue;
      }
      try {
        snapshotTemplateCode(globalTemplates[k]);
      } catch (e) {
        // ignore error
      }
      delete globalTemplates[k];
    }
    console.warn = consolewarn;
  });
}

export function useLogLifecycle(steps: string[]) {
  const component = useComponent();
  const name = component.constructor.name;
  steps.push(`${name}:setup`);
  expect(name + ": " + status(component)).toBe(name + ": " + "new");

  onWillStart(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "new");
    steps.push(`${name}:willStart`);
  });

  onMounted(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    steps.push(`${name}:mounted`);
  });

  onWillUpdateProps(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    steps.push(`${name}:willUpdateProps`);
  });

  onRender(() => {
    steps.push(`${name}:render`);
  });

  onWillPatch(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    steps.push(`${name}:willPatch`);
  });

  onPatched(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    steps.push(`${name}:patched`);
  });

  onWillUnmount(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "mounted");
    steps.push(`${name}:willUnmount`);
  });

  onDestroyed(() => {
    expect(name + ": " + status(component)).toBe(name + ": " + "destroyed");
    steps.push(`${name}:destroyed`);
  });
}

export function children(w: Component): Component[] {
  const childrenMap = w.__owl__.children;
  return Object.keys(childrenMap).map((id) => childrenMap[id].component);
}

export function isDirectChildOf(child: Component, parent: Component): boolean {
  return children(parent).includes(child);
}
