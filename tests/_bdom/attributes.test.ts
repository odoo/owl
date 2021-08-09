import { elem, mount, patch } from "../../src/_bdom/blockdom";
import { makeBuilder as origMakeBuilder } from "../../src/_bdom/builder";
import { makeTestFixture } from "../helpers";

function makeBuilder(str: string) {
  const B = origMakeBuilder(str);
  expect(B.toString()).toMatchSnapshot();
  return B;
}

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
  const builder = makeBuilder('<div owl-attribute-0="hello"></div>');
  const tree = elem(builder, ["world"]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div hello="world"></div>`);

  patch(tree, elem(builder, ["owl"]));
  expect(fixture.innerHTML).toBe(`<div hello="owl"></div>`);
});

test("class attribute", async () => {
  const builder = makeBuilder('<div owl-attribute-0="class"></div>');
  const tree = elem(builder, ["fire"]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe(`<div class="fire"></div>`);

  patch(tree, elem(builder, ["water"]));
  expect(fixture.innerHTML).toBe(`<div class="water"></div>`);

  patch(tree, elem(builder, [""]));
  expect(fixture.innerHTML).toBe(`<div class=""></div>`);
});
