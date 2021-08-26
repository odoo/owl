import { createBlock, mount, patch, remove, text } from "../../src/bdom";
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

describe("adding/patching blocks", () => {
  test("simple block", async () => {
    const block = createBlock("<div>foo</div>");
    const tree = block();
    expect(tree.el).toBe(undefined);

    mount(tree, fixture);
    expect(tree.el).not.toBe(undefined);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
  });

  test("block with dynamic content", async () => {
    const block = createBlock("<div><p><block-text-0/></p></div>");
    const tree = block(["foo"]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
    patch(tree, block(["bar"]));
    expect(fixture.innerHTML).toBe("<div><p>bar</p></div>");

    patch(tree, block(["foo"]));
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
  });

  test("block with 2 dynamic text nodes", async () => {
    const block = createBlock("<div><p><block-text-0/></p><span><block-text-1/></span></div>");
    const tree = block(["foo", "bar"]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p><span>bar</span></div>");
    patch(tree, block(["appa", "yip yip"]));
    expect(fixture.innerHTML).toBe("<div><p>appa</p><span>yip yip</span></div>");
  });

  test("block with multiple references", async () => {
    const block1 = createBlock(
      "<div><block-text-0/><p><block-text-1/><block-text-2/></p><block-text-3/></div>"
    );
    const tree = block1(["1", "2", "3", "4"]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div>1<p>23</p>4</div>");
  });

  test("falsy values in block nodes", () => {
    const cases = [
      [false, "false"],
      [undefined, ""],
      [null, ""],
      [0, "0"],
      ["", ""],
    ];
    const block = createBlock("<p><block-text-0/></p>");

    for (let [value, result] of cases) {
      const fixture = makeTestFixture();
      mount(block([value as any]), fixture);
      expect(fixture.innerHTML).toBe(`<p>${result}</p>`);
    }
  });
});

describe("sub blocks", () => {
  test("block with subblock (only child)", async () => {
    const block1 = createBlock("<div><block-child-0/></div>");
    const block2 = createBlock("<p>yip yip</p>");
    const tree = block1([], [block2()]);

    mount(tree, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p></div>");
  });

  test("block with subblock (first child with sibling)", async () => {
    const block1 = createBlock("<div><block-child-0/><span>something</span></div>");
    const block2 = createBlock("<p>yip yip</p>");
    const tree = block1([], [block2()]);

    mount(tree, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p><span>something</span></div>");
  });

  test("block with subblock (last child with sibling)", async () => {
    const block1 = createBlock("<div><span>something</span><block-child-0/></div>");
    const block2 = createBlock("<p>yip yip</p>");
    const tree = block1([], [block2()]);

    mount(tree, fixture);

    expect(fixture.innerHTML).toBe("<div><span>something</span><p>yip yip</p></div>");
  });

  test("block with 2 subblocks", async () => {
    const block1 = createBlock("<div><block-child-0/><block-child-1/></div>");
    const block2 = createBlock("<p>yip yip</p>");
    const tree = block1([], [block2(), text("appa")]);

    mount(tree, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p>appa</div>");
  });

  test("block with subblock with siblings", async () => {
    const block1 = createBlock("<div><p>1</p><block-child-0/><p>2</p></div>");
    const block2 = createBlock("<p>yip yip</p>");

    const tree = block1([], [block2()]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>1</p><p>yip yip</p><p>2</p></div>");
  });

  test("block with conditional child", async () => {
    const block1 = createBlock("<div><p><block-child-0/></p></div>");
    const block2 = createBlock("<span>foo</span>");

    const tree = block1();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p></p></div>");

    patch(tree, block1([], [block2()]));
    expect(fixture.innerHTML).toBe("<div><p><span>foo</span></p></div>");

    patch(tree, block1());
    expect(fixture.innerHTML).toBe("<div><p></p></div>");
  });

  test("block with subblock with dynamic content", async () => {
    const block1 = createBlock("<div><block-child-0/></div>");
    const block2 = createBlock("<p><block-text-0/></p>");
    const tree = block1([], [block2(["yip yip"])]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>yip yip</p></div>");

    patch(tree, block1([], [block2(["foo"])]));
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
  });

  test("block with dynamic content and subblock", async () => {
    const block1 = createBlock("<div><block-child-0/><p><block-text-0/></p></div>");
    const block2 = createBlock("<p>sub block</p>");
    const tree = block1(["yip yip"], [block2()]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>sub block</p><p>yip yip</p></div>");

    patch(tree, block1(["foo"], [block2()]));
    expect(fixture.innerHTML).toBe("<div><p>sub block</p><p>foo</p></div>");
  });
});

describe("remove elem blocks", () => {
  test("elem block can be removed", async () => {
    const block = createBlock("<div>foo</div>");
    const tree = block();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
    remove(tree);
    expect(fixture.innerHTML).toBe("");
    expect(fixture.childNodes.length).toBe(0);
  });
});

describe("misc", () => {
  test("block vnode can be used as text", () => {
    const block = createBlock("<p>a</p>");
    mount(text(block() as any), fixture);
    expect(fixture.textContent).toBe("<p>a</p>");
  });

  //     test("reusing a block skips patching process", async () => {
  //       const block = createBlock('<div><block-text-0/></div>');
  //       const foo = block(["foo"]);
  //       const bar = block(["bar"]);
  //       let fooCounter = 0;
  //       let barCounter = 0;
  //       let fooValue = "foo";
  //       let barValue = "bar";
  //       Object.defineProperty(foo.data, 0, {
  //         get() {
  //           fooCounter++;
  //           return fooValue;
  //         },
  //       });
  //       Object.defineProperty(bar.data, 0, {
  //         get() {
  //           barCounter++;
  //           return barValue;
  //         },
  //         set(val) {
  //           barValue = val;
  //         },
  //       });

  //       const bdom = multi([foo, bar]);
  //       mount(bdom, fixture);
  //       expect(fooCounter).toBe(1);
  //       expect(barCounter).toBe(1);
  //       expect(fixture.innerHTML).toBe("<div>foo</div><div>bar</div>");

  //       patch(bdom, multi([foo, block(["otherbar"])]));
  //       expect(fixture.innerHTML).toBe("foootherbar");
  //       expect(fooCounter).toBe(1);
  //       expect(barCounter).toBe(2);
  //     });
});
