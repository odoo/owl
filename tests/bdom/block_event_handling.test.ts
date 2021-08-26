import { mount, createBlock, multi, config } from "../../src/bdom";
// import { defaultHandler, setupMainHandler } from "../../src/bdom/block";
import { makeTestFixture } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let initialHandler = config.mainEventHandler;

beforeEach(() => {
  fixture = makeTestFixture();
  config.mainEventHandler = initialHandler;
});

afterEach(() => {
  fixture.remove();
});

test("simple event handling ", async () => {
  config.mainEventHandler = (data, ev) => {
    if (typeof data === "function") {
      data();
    } else {
      const [owner, method] = data;
      owner[method]();
    }
  };

  const block = createBlock('<div block-handler-0="click"></div>');
  let n = 0;
  const obj = { f: () => n++ };
  const tree = block([[obj, "f"]]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  expect(fixture.firstChild).toBeInstanceOf(HTMLDivElement);
  expect(n).toBe(0);
  (fixture.firstChild as HTMLDivElement).click();
  expect(n).toBe(1);
});

test("simple event handling, with function", async () => {
  const block = createBlock('<div block-handler-0="click"></div>');
  let n = 0;
  const tree = block([() => n++]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  expect(fixture.firstChild).toBeInstanceOf(HTMLDivElement);
  expect(n).toBe(0);
  (fixture.firstChild as HTMLDivElement).click();
  expect(n).toBe(1);
});

test("can bind two handlers on same node", async () => {
  const block = createBlock('<div block-handler-0="click" block-handler-1="dblclick"></div>');
  let steps: string[] = [];
  let handleClick = () => steps.push("click");
  let handleDblClick = () => steps.push("dblclick");
  const tree = block([handleClick, handleDblClick]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  (fixture.firstChild as HTMLDivElement).click();
  (fixture.firstChild as HTMLDivElement).dispatchEvent(new Event("dblclick", {bubbles: true}));
  expect(steps).toEqual(["click", "dblclick"]);
});

test("two same block nodes with different handlers", async () => {
  const block = createBlock('<div block-handler-0="click"></div>');
  let steps: string[] = [];
  let handler1 = () => steps.push("1");
  let handler2 = () => steps.push("2");
  const tree = multi([block([handler1]), block([handler2])]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div><div></div>");

  (fixture.firstChild as HTMLDivElement).click();
  (fixture.firstChild!.nextSibling as HTMLDivElement).click();
  expect(steps).toEqual(["1", "2"]);
});
