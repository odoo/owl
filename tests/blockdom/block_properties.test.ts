import { mount, patch, createBlock } from "../../src/runtime/blockdom";
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

test("input with value property", () => {
  // render input with initial value
  const block = createBlock(`<input block-property-0="value"/>`);

  const tree = block(["zucchini"]);
  mount(tree, fixture);
  // const bnode1 = renderToBdom(template, { v: "zucchini" });
  // const fixture = makeTestFixture();
  // mount(bnode1, fixture);
  const input = fixture.querySelector("input")!;
  expect(input.value).toBe("zucchini");

  // change value manually in input, to simulate user input
  input.value = "tomato";
  expect(input.value).toBe("tomato");

  // rerender with a different value, and patch actual dom, to check that
  // input value was properly reset by owl
  patch(tree, block(["potato"]));
  expect(input.value).toBe("potato");
});

test("input with value property, and falsy value given", () => {
  const block = createBlock(`<input block-property-0="value"/>`);

  const tree = block([undefined]);
  mount(tree, fixture);
  const input = fixture.querySelector("input")!;
  expect(input.value).toBe("");

  patch(tree, block([null]));
  expect(input.value).toBe("");

  patch(tree, block([0]));
  expect(input.value).toBe("0");

  patch(tree, block([""]));
  expect(input.value).toBe("");

  patch(tree, block([false]));
  expect(input.value).toBe("");
});

test("input type=checkbox with checked property", () => {
  // render input with initial value
  const block = createBlock(`<input type="checkbox" block-property-0="checked"/>`);

  const tree = block([true]);
  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<input type="checkbox">`);
  const input = fixture.querySelector("input")!;
  expect(input.checked).toBe(true);
});
