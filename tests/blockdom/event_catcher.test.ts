import { config, createBlock, createCatcher, mount } from "../../src/blockdom";
import { makeTestFixture } from "./helpers";
import { mainEventHandler } from "../../src/component/handler";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
config.mainEventHandler = mainEventHandler;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

test("simple event catcher", async () => {
  const catcher = createCatcher({ click: 0 });
  const block = createBlock("<div></div>");
  let n = 0;
  let ctx = {};
  let handler = [() => n++, ctx];
  const tree = catcher(block(), [handler]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  expect(fixture.firstChild).toBeInstanceOf(HTMLDivElement);
  expect(n).toBe(0);
  (fixture.firstChild as HTMLDivElement).click();
  expect(n).toBe(1);
});

test("do not catch events outside of itself", async () => {
  const catcher = createCatcher({ click: 0 });
  const childBlock = createBlock("<div></div>");
  const parentBlock = createBlock("<button><block-child-0/></button>");
  let n = 0;
  let ctx = {};
  let handler = [() => n++, ctx];
  const tree = parentBlock([], [catcher(childBlock(), [handler])]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<button><div></div></button>");

  expect(n).toBe(0);
  fixture.querySelector("div")!.click();
  expect(n).toBe(1);
  fixture.querySelector("button")!.click();
  expect(n).toBe(1);
});
