import { elem, mount } from "../../src/_bdom/blockdom";
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

test("simple event handling ", async () => {
  const builder = makeBuilder('<div owl-handler-0="click"></div>');
  let n = 0;
  const obj = { f: () => n++ };
  const tree = elem(builder, [[obj, "f"]]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  expect(fixture.firstChild).toBeInstanceOf(HTMLDivElement);
  expect(n).toBe(0);
  (fixture.firstChild as HTMLDivElement).click();
  expect(n).toBe(1);
});

test("simple event handling, with function", async () => {
  const builder = makeBuilder('<div owl-handler-0="click"></div>');
  let n = 0;
  const tree = elem(builder, [() => n++]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  expect(fixture.firstChild).toBeInstanceOf(HTMLDivElement);
  expect(n).toBe(0);
  (fixture.firstChild as HTMLDivElement).click();
  expect(n).toBe(1);
});
