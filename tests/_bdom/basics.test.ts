import { mount, multi, patch, remove, text } from "../../src/_bdom/blockdom";
import { makeBlock as origMakeBlock, _compileBlock } from "../../src/_bdom/builder";
import { makeTestFixture } from "../helpers";

function makeBlock(str: string) {
  const { fn } = _compileBlock(str);
  expect(fn.toString()).toMatchSnapshot();
  return origMakeBlock(str);
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

describe("text and elem blocks", () => {
  test("simple text block", async () => {
    const tree = text("foo");
    expect(tree.el).toBe(undefined);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("foo");
    expect(tree.el).not.toBe(undefined);
  });

  test("patching a simple text block", async () => {
    const tree = text("foo");
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("foo");

    patch(tree, text("bar"));
    expect(fixture.innerHTML).toBe("bar");
  });

  test("simple elem block", async () => {
    const block = makeBlock("<div>foo</div>");
    const tree = block();
    expect(tree.el).toBe(undefined);

    mount(tree, fixture);
    expect(tree.el).not.toBe(undefined);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
  });

  test("a text block can be removed", async () => {
    const tree = text("cat");
    expect(fixture.childNodes.length).toBe(0);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("cat");
    expect(fixture.childNodes.length).toBe(1);
    remove(tree);
    expect(fixture.innerHTML).toBe("");
    expect(fixture.childNodes.length).toBe(0);
  });

  test("elem block can be removed", async () => {
    const block = makeBlock("<div>foo</div>");
    const tree = block();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
    remove(tree);
    expect(fixture.innerHTML).toBe("");
    expect(fixture.childNodes.length).toBe(0);
  });

  test("simple block with multiple roots", async () => {
    const block1 = makeBlock("<div>foo</div>");
    const block2 = makeBlock("<span>bar</span>");

    const tree = multi([block1(), block2()]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div><span>bar</span>");
  });

  test("block with dynamic content", async () => {
    const block = makeBlock("<div><p><owl-text-0/></p></div>");
    const tree = block(["foo"]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
    patch(tree, block(["bar"]));
    expect(fixture.innerHTML).toBe("<div><p>bar</p></div>");
  });

  test("block with 2 dynamic text nodes", async () => {
    const block = makeBlock("<div><p><owl-text-0/></p><span><owl-text-1/></span></div>");
    const tree = block(["foo", "bar"]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p><span>bar</span></div>");
    patch(tree, block(["appa", "yip yip"]));
    expect(fixture.innerHTML).toBe("<div><p>appa</p><span>yip yip</span></div>");
  });

  test("block with subblock", async () => {
    const block1 = makeBlock("<div><owl-child-0/></div>");
    const block2 = makeBlock("<p>yip yip</p>");
    const tree = block1([], [block2()]);

    mount(tree, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p></div>");
  });

  test("block with 2 subblocks", async () => {
    const block1 = makeBlock("<div><owl-child-0/><owl-child-1/></div>");
    const block2 = makeBlock("<p>yip yip</p>");
    const tree = block1([], [block2(), text("appa")]);

    mount(tree, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p>appa</div>");
  });

  test("block with subblock with siblings", async () => {
    const block1 = makeBlock("<div><p>1</p><owl-child-0/><p>2</p></div>");
    const block2 = makeBlock("<p>yip yip</p>");

    const tree = block1([], [block2()]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>1</p><p>yip yip</p><p>2</p></div>");
  });

  test("block with conditional child", async () => {
    const block1 = makeBlock("<div><p><owl-child-0/></p></div>");
    const block2 = makeBlock("<span>foo</span>");

    const tree = block1();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p></p></div>");

    patch(tree, block1([], [block2()]));
    expect(fixture.innerHTML).toBe("<div><p><span>foo</span></p></div>");

    patch(tree, block1());
    expect(fixture.innerHTML).toBe("<div><p></p></div>");
  });

  test("block with subblock with dynamic content", async () => {
    const block1 = makeBlock("<div><owl-child-0/></div>");
    const block2 = makeBlock("<p><owl-text-0/></p>");
    const tree = block1([], [block2(["yip yip"])]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>yip yip</p></div>");

    patch(tree, block1([], [block2(["foo"])]));
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
  });

  test("block with dynamic content and subblock", async () => {
    const block1 = makeBlock("<div><owl-child-0/><p><owl-text-0/></p></div>");
    const block2 = makeBlock("<p>sub block</p>");
    const tree = block1(["yip yip"], [block2()]);

    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>sub block</p><p>yip yip</p></div>");

    patch(tree, block1(["foo"], [block2()]));
    expect(fixture.innerHTML).toBe("<div><p>sub block</p><p>foo</p></div>");
  });
});

describe("misc", () => {
  test("reusing a block skips patching process", async () => {
    const foo = text("foo");
    const bar = text("bar");
    let fooCounter = 0;
    let barCounter = 0;
    let fooValue = "foo";
    let barValue = "bar";
    Object.defineProperty(foo, "data", {
      get() {
        fooCounter++;
        return fooValue;
      },
    });
    Object.defineProperty(bar, "data", {
      get() {
        barCounter++;
        return barValue;
      },
      set(val) {
        barValue = val;
      },
    });

    const bdom = multi([foo, bar]);
    mount(bdom, fixture);
    expect(fooCounter).toBe(1);
    expect(barCounter).toBe(1);
    expect(fixture.innerHTML).toBe("foobar");

    patch(bdom, multi([foo, text("otherbar")]));
    expect(fixture.innerHTML).toBe("foootherbar");
    expect(fooCounter).toBe(1);
    expect(barCounter).toBe(2);
  });
});
