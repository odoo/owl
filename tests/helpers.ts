import { TemplateSet } from "../src/core/app";
import { Block, Blocks } from "../src/bdom";
import { compileTemplate, Template } from "../src/compiler/index";
import { globalTemplates } from "../src/tags";
import { UTILS } from "../src/core/template_utils";

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

  beforeEach(() => {
    for (let k in globalTemplates) {
      delete globalTemplates[k];
    }
  })
  afterEach(() => {
    for (let k in globalTemplates) {
      snapshotTemplateCode(globalTemplates[k]);
    }
  });
}