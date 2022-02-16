import { hydrate, patch, text, createBlock } from "../../src/blockdom";
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

describe("hydration", () => {
  test("simple text node", async () => {
    fixture.innerHTML = "some text";
    const target = fixture.firstChild as any;

    const tree = text("some text");
    expect(tree.el).toBe(undefined);
    hydrate(tree, target);
    expect(fixture.innerHTML).toBe("some text");
    expect(tree.el).toBe(target);

    patch(tree, text("checkmate"));
    expect(fixture.innerHTML).toBe("checkmate");
  });

  test("simple static block", async () => {
    fixture.innerHTML = "<div>some text</div>";
    const target = fixture.firstChild as any;

    const block = createBlock("<div>some text</div>");

    const tree = block();
    expect(tree.el).toBe(undefined);
    hydrate(tree, target);
    expect(fixture.innerHTML).toBe("<div>some text</div>");
    expect(tree.el).toBe(target);
  });

  test("simple dynamic block", async () => {
    fixture.innerHTML = "<div>some text</div>";
    const target = fixture.firstChild as any;

    const block = createBlock("<div><block-text-0/></div>");

    const tree = block(["some text"]);
    expect(tree.el).toBe(undefined);
    hydrate(tree, target);
    expect(fixture.innerHTML).toBe("<div>some text</div>");
    expect(tree.el).toBe(target);

    patch(tree, block(["giuoco piano"]));
    expect(fixture.innerHTML).toBe("<div>giuoco piano</div>");
  });

  test("block with sub block", async () => {
    fixture.innerHTML = "<div>queen<p>gambit</p></div>";
    const target = fixture.firstChild as any;

    const block1 = createBlock("<div><block-text-0/><block-child-0/></div>");
    const block2 = createBlock("<p><block-text-0/></p>");

    const tree = block1(["queen"], [block2(["gambit"])]);
    expect(tree.el).toBe(undefined);
    hydrate(tree, target);
    expect(fixture.innerHTML).toBe("<div>queen<p>gambit</p></div>");
    expect(tree.el).toBe(target);

    patch(tree, block1(["king"], [block2(["pawn"])]));
    expect(fixture.innerHTML).toBe("<div>king<p>pawn</p></div>");
  });
});
