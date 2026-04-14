import { createBlock, mount } from "../../src/runtime/blockdom";
import { makeTestFixture } from "./helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

const XHTML_URI = "http://www.w3.org/1999/xhtml";
const SVG_URI = "http://www.w3.org/2000/svg";
let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("namespace", () => {
  test("default namespace is xhtml", () => {
    const block = createBlock(`<tag/>`);
    const tree = block();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<tag></tag>");
    expect(fixture.firstElementChild!.namespaceURI).toBe(XHTML_URI);
  });

  test("namespace can be changed with xmlns", () => {
    const block = createBlock(`<tag xmlns="${SVG_URI}"/>`);
    const tree = block();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe(`<tag xmlns="${SVG_URI}"></tag>`);
    expect(fixture.firstElementChild!.namespaceURI).toBe(SVG_URI);
  });

  test("namespace is kept for children", () => {
    const block = createBlock(
      `<parent xmlns="${SVG_URI}"><child><subchild/></child><child/></parent>`
    );
    const tree = block();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe(
      `<parent xmlns="${SVG_URI}"><child><subchild></subchild></child><child></child></parent>`
    );
    const parent = fixture.firstElementChild!;
    const child1 = parent.firstElementChild!;
    const subchild = child1.firstElementChild!;
    const child2 = child1.nextElementSibling!;
    expect(parent.namespaceURI).toBe(SVG_URI);
    expect(child1.namespaceURI).toBe(SVG_URI);
    expect(child2.namespaceURI).toBe(SVG_URI);
    expect(subchild.namespaceURI).toBe(SVG_URI);
  });

  test("various namespaces in same block", () => {
    const block = createBlock(`<none><one xmlns="one"/><two xmlns="two"/></none>`);
    const tree = block();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe('<none><one xmlns="one"></one><two xmlns="two"></two></none>');
    const none = fixture.firstElementChild!;
    const one = none.firstElementChild!;
    const two = one.nextElementSibling!;
    expect(none.namespaceURI).toBe(XHTML_URI);
    expect(one.namespaceURI).toBe("one");
    expect(two.namespaceURI).toBe("two");
  });
});
