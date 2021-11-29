import { comment, mount } from "../../src/blockdom";
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

test("simple comment node", async () => {
  const tree = comment("foo");
  expect(tree.el).toBe(undefined);
  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<!--foo-->");
  expect(tree.el).not.toBe(undefined);
  tree.remove();
  expect(fixture.innerHTML).toBe("");
});
