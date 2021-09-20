import { mount, patch, createBlock } from "../../src/blockdom";
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

test("simple attribute", async () => {
  const block = createBlock('<div block-attribute-0="hello"></div>');
  const tree = block(["world"]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div hello="world"></div>`);

  patch(tree, block(["owl"]));
  expect(fixture.innerHTML).toBe(`<div hello="owl"></div>`);
});

test("dynamic attribute (pair)", async () => {
  const block = createBlock('<div block-attributes="0"></div>');
  const tree = block([["hello", "world"]]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div hello="world"></div>`);

  patch(tree, block([["ola", "mundo"]]));
  expect(fixture.innerHTML).toBe(`<div ola="mundo"></div>`);
});

test("dynamic attribute (object)", async () => {
  const block = createBlock('<div block-attributes="0"></div>');
  const tree = block([{ hello: "world" }]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div hello="world"></div>`);

  patch(tree, block([{ ola: "mundo" }]));
  expect(fixture.innerHTML).toBe(`<div ola="mundo"></div>`);
});

test("class attribute", async () => {
  const block = createBlock('<div block-attribute-0="class"></div>');
  const tree = block(["fire"]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div class="fire"></div>`);

  patch(tree, block(["water"]));
  expect(fixture.innerHTML).toBe(`<div class="water"></div>`);

  patch(tree, block([""]));
  expect(fixture.innerHTML).toBe(`<div class=""></div>`);

  patch(tree, block([0]));
  expect(fixture.innerHTML).toBe(`<div class="0"></div>`);
});

test("class attribute with undefined value", async () => {
  const block = createBlock('<div block-attribute-0="class"></div>');
  const tree = block([undefined]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div></div>`);
});

test("class attribute (with a preexisting value", async () => {
  const block = createBlock('<div class="tomato" block-attribute-0="class"></div>');
  const tree = block(["potato"]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div class="tomato potato"></div>`);

  patch(tree, block(["squash"]));
  expect(fixture.innerHTML).toBe(`<div class="tomato squash"></div>`);

  patch(tree, block([""]));
  expect(fixture.innerHTML).toBe(`<div class="tomato"></div>`);
});

describe("properties", () => {
  test("input with value attribute", () => {
    // render input with initial value
    const block = createBlock(`<input block-attribute-0="value"/>`);

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

  test("input type=checkbox with checked attribute", () => {
    // render input with initial value
    const block = createBlock(`<input type="checkbox" block-attribute-0="checked"/>`);

    const tree = block([true]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe(`<input type="checkbox">`);
    const input = fixture.querySelector("input")!;
    expect(input.checked).toBe(true);
  });
});
