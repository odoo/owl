import { BDom, Blocks } from "../src/bdom";
import { App, UTILS } from "../src/app";
import { globalTemplates } from "../src/tags";
import { compileTemplate, Template } from "../src/compiler/index";

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function compile(template: string): Template {
  const templateFunction = compileTemplate(template);
  return templateFunction(Blocks, UTILS);
}

export function renderToBdom(template: string, context: any = {}): BDom {
  return compile(template)(context);
}

export function renderToString(template: string, context: any = {}): string {
  const fixture = makeTestFixture();
  const bdom = renderToBdom(template, context);
  bdom.mount(fixture);
  return fixture.innerHTML;
}

export class TestApp extends App {
  renderToString(name: string, context: any = {}): string {
    const renderFn = this.getTemplate(name);
    const bdom = renderFn(context);
    const fixture = makeTestFixture();
    bdom.mount(fixture);
    return fixture.innerHTML;
  }
}
