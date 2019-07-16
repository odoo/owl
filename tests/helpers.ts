import { Env } from "../src/component/component";
import { EvalContext, QWeb } from "../src/qweb/qweb";
import { patch } from "../src/vdom";
import "../src/qweb/base_directives";
import "../src/qweb/extensions";
import "../src/component/directive";

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve));
}

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  return fixture;
}

export function normalize(str: string): string {
  return str.replace(/\s+/g, "");
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
  (<Deferred>def).resolve = resolve;
  (<Deferred>def).reject = reject;
  return <Deferred>def;
}

export function makeTestEnv(): Env {
  return {
    qweb: new QWeb()
  };
}

export function trim(str: string): string {
  return str.replace(/\s/g, "");
}

export function renderToDOM(
  qweb: QWeb,
  template: string,
  context: EvalContext = {},
  extra?: any
): HTMLElement | Text {
  const vnode = qweb.render(template, context, extra);

  // we snapshot here the compiled code. This is useful to prevent unwanted code
  // change.
  expect(qweb.templates[template].fn.toString()).toMatchSnapshot();

  if (vnode.sel === undefined) {
    return document.createTextNode(vnode.text!);
  }
  const node = document.createElement(vnode.sel!);
  const result = patch(node, vnode);
  return result.elm as HTMLElement;
}

/**
 * Render a template to an html string. The big difference with the
 * renderToString method in QWeb is that we use the renderToDom method, which
 * snapshots the resulting template function.  Doing so gives us a large body
 * of reference to evaluate changes in the generated QWeb code.
 *
 * Note that the result of renderToString is guaranteed to be the same as the
 * one from QWeb.
 */
export function renderToString(qweb: QWeb, t: string, context: EvalContext = {}): string {
  const node = renderToDOM(qweb, t, context);
  const result = node instanceof Text ? node.textContent! : node.outerHTML;
  if (result !== qweb.renderToString(t, context)) {
      throw new Error("HTML string returned by renderToString helper does not match QWeb render");
  }
  return result;
}

// hereafter, we define two helpers to patch/unpatch the nextFrame utils. This
// is useful for animations tests, as we hook before repaints to trigger
// animations (thanks to requestAnimationFrame). Patching nextFrame allows to
// simulate calls to this hook. One must not forget to unpatch afterwards.
let nextFrame = QWeb.utils.nextFrame;
export function patchNextFrame(f: Function) {
  QWeb.utils.nextFrame = (cb: () => void) => {
    setTimeout(() => f(cb));
  };
}

export function unpatchNextFrame() {
  QWeb.utils.nextFrame = nextFrame;
}

export async function editInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
  input.dispatchEvent(new Event("change"));
  return nextTick();
}
