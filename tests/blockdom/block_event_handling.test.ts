import { mount, createBlock, multi, config, patch } from "../../src/blockdom";
// import { defaultHandler, setupMainHandler } from "../../src/bdom/block";
import { makeTestFixture } from "./helpers";

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

test("simple event handling, with function and argument", async () => {
  const block = createBlock('<div block-handler-0="click"></div>');
  let n = 0;
  const onClick = (arg: number) => {
    n += arg;
  };
  const tree = block([[onClick, 3]]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  expect(fixture.firstChild).toBeInstanceOf(HTMLDivElement);
  expect(n).toBe(0);
  (fixture.firstChild as HTMLDivElement).click();
  expect(n).toBe(3);

  patch(tree, block([[onClick, 5]]));
  (fixture.firstChild as HTMLDivElement).click();
  expect(n).toBe(8);
});

test("simple event handling ", async () => {
  config.mainEventHandler = (data, ev) => {
    if (typeof data === "function") {
      data();
    } else {
      const [owner, method] = data;
      owner[method]();
    }
    return false;
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

test("can bind two handlers on same node", async () => {
  const block = createBlock('<div block-handler-0="click" block-handler-1="dblclick"></div>');
  let steps: string[] = [];
  let handleClick = () => steps.push("click");
  let handleDblClick = () => steps.push("dblclick");
  const tree = block([handleClick, handleDblClick]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");

  (fixture.firstChild as HTMLDivElement).click();
  (fixture.firstChild as HTMLDivElement).dispatchEvent(new Event("dblclick", { bubbles: true }));
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

test("two same block nodes with different handlers (synthetic)", async () => {
  const block = createBlock('<div block-handler-0="click.synthetic"></div>');
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

test("synthetic and native handlers can cohabitate", async () => {
  const block = createBlock(
    '<div block-handler-0="click.synthetic"><div block-handler-1="click"/></div>'
  );
  let steps: string[] = [];
  let handler1 = () => steps.push("1");
  let handler2 = () => steps.push("2");
  const tree = block([handler1, handler2]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div><div></div></div>");

  (fixture.firstChild!.firstChild as HTMLDivElement).click();
  expect(steps).toEqual(["2", "1"]);
  (fixture.firstChild as HTMLDivElement).click();
  expect(steps).toEqual(["2", "1", "1"]);
});

test("synthetic and native handlers can cohabitate (2)", async () => {
  const block = createBlock(
    '<div block-handler-0="click"><div block-handler-1="click.synthetic"/></div>'
  );
  let steps: string[] = [];
  let handler1 = () => steps.push("1");
  let handler2 = () => steps.push("2");
  const tree = block([handler1, handler2]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div><div></div></div>");

  (fixture.firstChild!.firstChild as HTMLDivElement).click();
  expect(steps).toEqual(["1", "2"]);
  (fixture.firstChild as HTMLDivElement).click();
  expect(steps).toEqual(["1", "2", "1"]);
});

test("synthetic and native handlers can cohabitate (3)", async () => {
  const parent = createBlock(`<div block-handler-0="click"><block-child-0/><block-child-1/></div>`);
  const block = createBlock('<div block-handler-0="click"/>');
  const blockSynth = createBlock('<div block-handler-0="click.synthetic"/>');
  let steps: string[] = [];
  const handler0 = () => steps.push("0");
  let handler1 = () => steps.push("1");
  let handler2 = () => steps.push("2");
  const tree = parent([handler0], [block([handler1]), blockSynth([handler2])]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div><div></div><div></div></div>");

  const children = fixture.children[0].children;

  (children[0] as HTMLElement).click();
  expect(steps).toEqual(["1", "0"]);
  (children[1] as HTMLElement).click();
  expect(steps).toEqual(["1", "0", "0", "2"]);
});

test("synthetic and native handlers can cohabitate (5)", async () => {
  const parent = createBlock(`<div block-handler-0="click"><block-child-0/><block-child-1/></div>`);
  const block = createBlock('<div block-handler-0="click"/>');
  const blockSynth = createBlock('<div block-handler-0="click.synthetic"/>');
  let steps: string[] = [];
  const handler0 = (ev: Event) => {
    steps.push("0");
    ev.stopPropagation();
  };
  let handler1 = () => steps.push("1");
  let handler2 = () => steps.push("2");
  const tree = parent([handler0], [block([handler1]), blockSynth([handler2])]);

  mount(tree, fixture);
  expect(fixture.innerHTML).toBe("<div><div></div><div></div></div>");

  const children = fixture.children[0].children;

  (children[0] as HTMLElement).click();
  expect(steps).toEqual(["1", "0"]);
  (children[1] as HTMLElement).click();
  expect(steps).toEqual(["1", "0", "0"]);
});
