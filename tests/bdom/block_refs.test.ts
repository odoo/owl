import { createBlock, mount, patch, remove } from "../../src/bdom";
import { makeTestFixture } from "../helpers";

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
  const block = createBlock('<div><span owl-ref="0">hey</span></div>');
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
  const block = createBlock('<div><span owl-ref="0">hey</span></div>');
  const refFn = (span: any) => {
    expect(document.body.contains(span)).toBeTruthy();
  };

  const tree = block([refFn]);

  mount(tree, fixture);
});
