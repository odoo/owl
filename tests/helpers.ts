import { Env } from "../src/component";
import { EvalContext, QWeb, UTILS } from "../src/qweb_core";
import { patch } from "../src/vdom";
import "../src/qweb_directives";
import "../src/qweb_extensions";

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

export function renderToString(
  qweb: QWeb,
  t: string,
  context: EvalContext = {}
): string {
  const node = renderToDOM(qweb, t, context);
  return node instanceof Text ? node.textContent! : node.outerHTML;
}

// hereafter, we define two helpers to patch/unpatch the nextFrame utils. This
// is useful for animations tests, as we hook before repaints to trigger
// animations (thanks to requestAnimationFrame). Patching nextFrame allows to
// simulate calls to this hook. One must not forget to unpatch afterwards.
let nextFrame = UTILS.nextFrame;
export function patchNextFrame(f: Function) {
  UTILS.nextFrame = (cb: () => void) => {
    setTimeout(() => f(cb));
  };
}

export function unpatchNextFrame() {
  UTILS.nextFrame = nextFrame;
}

export async function editInput(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
  input.dispatchEvent(new Event("change"));
  return nextTick();
}
