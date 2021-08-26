import { mount, multi, patch, text, createBlock } from "../../src/bdom";
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

describe("multi blocks", () => {
  test("multiblock with 2 text blocks", async () => {
    const tree = multi([text("foo"), text("bar")]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("foobar");
  });

  test("a multiblock can be removed and leaves no extra text nodes", async () => {
    const block1 = createBlock("<div>foo</div>");
    const block2 = createBlock("<span>bar</span>");

    const tree = multi([block1(), block2()]);

    expect(fixture.childNodes.length).toBe(0);
    mount(tree, fixture);
    expect(fixture.childNodes.length).toBe(2);
    tree.remove();
    expect(fixture.childNodes.length).toBe(0);
  });

  test("multiblock with an empty children", async () => {
    const block = createBlock("<div>foo</div>");
    const tree = multi([block(), undefined]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
  });

  test("multi block in a regular block", async () => {
    const block1 = createBlock("<div><block-child-0/></div>");
    const block2 = createBlock("<span>yip yip</span>");

    const tree = block1([], [multi([block2()])]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><span>yip yip</span></div>");
  });

  test("patching a multiblock ", async () => {
    const tree = multi([text("foo"), text("bar")]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("foobar");

    patch(tree, multi([text("blip"), text("bar")]));
    expect(fixture.innerHTML).toBe("blipbar");
  });

  test("simple multi with multiple roots", async () => {
    const block1 = createBlock("<div>foo</div>");
    const block2 = createBlock("<span>bar</span>");

    const tree = multi([block1(), block2()]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div><span>bar</span>");
  });

  test("multi vnode can be used as text", () => {
    mount(text(multi([text("a"), text("b")]) as any), fixture);
    expect(fixture.innerHTML).toBe("ab");
  });
});
