import { createBlock, mount, patch, remove } from "../../src/runtime/blockdom";
import { logStep } from "../helpers";
import { makeTestFixture } from "./helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

test("simple callback ref", async () => {
  const block = createBlock('<div><span block-ref="0">hey</span></div>');
  let arg: any = undefined;
  let n = 0;
  const refFn = (_arg: any) => {
    n++;
    arg = _arg;
  };

  const tree = block([refFn]);

  expect(arg).toBeUndefined();
  expect(n).toBe(0);
  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  expect(n).toBe(1);

  expect(arg).toBeInstanceOf(HTMLSpanElement);
  expect(arg!.innerHTML).toBe("hey");

  patch(tree, block([refFn]));
  expect(n).toBe(1);

  remove(tree);
  expect(fixture.innerHTML).toBe("");
  expect(arg).toBeNull();
  expect(n).toBe(2);
});

test("is in dom when callback is called", async () => {
  expect.assertions(1);
  const block = createBlock('<div><span block-ref="0">hey</span></div>');
  const refFn = (span: any) => {
    expect(document.body.contains(span)).toBeTruthy();
  };

  const tree = block([refFn]);

  mount(tree, fixture);
});

test("callback ref in callback ref with same block", async () => {
  const block = createBlock('<p block-ref="0"><block-text-1/><block-child-0/></p>');
  let refFn = (el: HTMLParagraphElement) => logStep(el.outerHTML);

  const child = block([refFn, "child"], []);
  const parent = block([refFn, "parent"], [child]);
  mount(parent, fixture);

  expect(fixture.innerHTML).toBe("<p>parent<p>child</p></p>");
  expect(["<p>child</p>", "<p>parent<p>child</p></p>"]).toBeLogged();
});
