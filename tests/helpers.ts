import {
  onBeforeDestroy,
  onBeforePatch,
  onBeforeUnmount,
  onMounted,
  onPatched,
  onWillStart,
  onWillUpdateProps,
  useComponent,
} from "../src";
import { TemplateSet } from "../src/app";
import { Block, Blocks } from "../src/bdom";
import { compileTemplate, Template } from "../src/compiler/index";
import { globalTemplates } from "../src/tags";
import { UTILS } from "../src/template_utils";

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

export function snapshotTemplateCode(template: string) {
  expect(compileTemplate(template).toString()).toMatchSnapshot();
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
export function fromName(name: string): string {
  return globalTemplates[name];
}

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
  return templateFunction(Blocks, UTILS);
}

export function renderToBdom(template: string, context: any = {}): Block {
  return compile(template)(context);
}

export function renderToString(template: string, context: any = {}): string {
  const fixture = makeTestFixture();
  const bdom = renderToBdom(template, context);
  bdom.mount(fixture, [], []);
  return fixture.innerHTML;
}

export class TestContext extends TemplateSet {
  renderToString(name: string, context: any = {}): string {
    const renderFn = this.getTemplate(name);
    const bdom = renderFn(context);
    const fixture = makeTestFixture();
    bdom.mount(fixture, [], []);
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
  onWillStart(() => steps.push(`${name}:willStart`));
  onWillUpdateProps(() => steps.push(`${name}:willUpdateProps`));
  onMounted(() => steps.push(`${name}:mounted`));
  onBeforePatch(() => steps.push(`${name}:beforePatch`));
  onPatched(() => steps.push(`${name}:patched`));
  onBeforeUnmount(() => steps.push(`${name}:beforeUnmount`));
  onBeforeDestroy(() => steps.push(`${name}:beforeDestroy`));
}
