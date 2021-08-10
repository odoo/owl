import { elem, mount, multi, patch, remove, text } from "../../src/_bdom/blockdom";
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

describe("text and elem blocks", () => {
  test("simple text block", async () => {
    const bdom = text("foo");
    expect(bdom.el).toBe(undefined);
    mount(bdom, fixture);
    expect(bdom.el).not.toBe(undefined);
    expect(fixture.innerHTML).toBe("foo");
  });

  test("patching a simple text block", async () => {
    const bdom1 = text("foo");
    const bdom2 = text("bar");
    mount(bdom1, fixture);
    expect(fixture.innerHTML).toBe("foo");
    patch(bdom1, bdom2);
    expect(fixture.innerHTML).toBe("bar");
  });

  test("simple elem block", async () => {
    const builder = makeBuilder("<div>foo</div>");
    const bdom = elem(builder);
    expect(bdom.el).toBe(undefined);

    mount(bdom, fixture);
    expect(bdom.el).not.toBe(undefined);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
  });

  test("a text block can be removed", async () => {
    const bdom = text("cat");
    expect(fixture.childNodes.length).toBe(0);
    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("cat");
    expect(fixture.childNodes.length).toBe(1);
    remove(bdom);
    expect(fixture.innerHTML).toBe("");
    expect(fixture.childNodes.length).toBe(0);
  });

  test("elem block can be removed", async () => {
    const builder = makeBuilder("<div>foo</div>");
    const bdom = elem(builder);
    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
    remove(bdom);
    expect(fixture.innerHTML).toBe("");
    expect(fixture.childNodes.length).toBe(0);
  });

  test("simple block with multiple roots", async () => {
    const builder1 = makeBuilder("<div>foo</div>");
    const builder2 = makeBuilder("<span>bar</span>");

    const bdom = multi([elem(builder1), elem(builder2)]);

    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div><span>bar</span>");
  });

  test("block with dynamic content", async () => {
    const builder = makeBuilder("<div><p><owl-text-0/></p></div>");
    const bdom1 = elem(builder, ["foo"]);

    mount(bdom1, fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
    const bdom2 = elem(builder, ["bar"]);
    patch(bdom1, bdom2);
    expect(fixture.innerHTML).toBe("<div><p>bar</p></div>");
  });

  test("block with 2 dynamic text nodes", async () => {
    const builder = makeBuilder("<div><p><owl-text-0/></p><span><owl-text-1/></span></div>");
    const bdom = elem(builder, ["foo", "bar"]);

    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("<div><p>foo</p><span>bar</span></div>");
    patch(bdom, elem(builder, ["appa", "yip yip"]));
    expect(fixture.innerHTML).toBe("<div><p>appa</p><span>yip yip</span></div>");
  });

  test("block with subblock", async () => {
    const builder1 = makeBuilder("<div><owl-child-0/></div>");
    const builder2 = makeBuilder("<p>yip yip</p>");
    const bdom = elem(builder1, [], [elem(builder2)]);

    mount(bdom, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p></div>");
  });

  test("block with 2 subblocks", async () => {
    const builder1 = makeBuilder("<div><owl-child-0/><owl-child-1/></div>");
    const builder2 = makeBuilder("<p>yip yip</p>");
    const bdom = elem(builder1, [], [elem(builder2), text("appa")]);

    mount(bdom, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p>appa</div>");
  });

  test("block with subblock with siblings", async () => {
    const builder1 = makeBuilder("<div><p>1</p><owl-child-0/><p>2</p></div>");
    const builder2 = makeBuilder("<p>yip yip</p>");

    const bdom = elem(builder1, [], [elem(builder2)]);

    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("<div><p>1</p><p>yip yip</p><p>2</p></div>");
  });

  test("block with conditional child", async () => {
    const builder1 = makeBuilder("<div><p><owl-child-0/></p></div>");
    const builder2 = makeBuilder("<span>foo</span>");

    const tree = elem(builder1);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p></p></div>");

    patch(tree, elem(builder1, [], [elem(builder2)]));
    expect(fixture.innerHTML).toBe("<div><p><span>foo</span></p></div>");

    patch(tree, elem(builder1));
    expect(fixture.innerHTML).toBe("<div><p></p></div>");
  });

  test("block with subblock with dynamic content", async () => {
    const builder1 = makeBuilder("<div><owl-child-0/></div>");
    const builder2 = makeBuilder("<p><owl-text-0/></p>");

    const tree = elem(builder1, [], [elem(builder2, ["yip yip"])]);

    mount(tree, fixture);

    expect(fixture.innerHTML).toBe("<div><p>yip yip</p></div>");

    patch(tree, elem(builder1, [], [elem(builder2, ["foo"])]));
    expect(fixture.innerHTML).toBe("<div><p>foo</p></div>");
  });

  test("block with dynamic content and subblock", async () => {
    const builder1 = makeBuilder("<div><owl-child-0/><p><owl-text-0/></p></div>");
    const builder2 = makeBuilder("<p>sub block</p>");

    const tree = elem(builder1, ["yip yip"], [elem(builder2)]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>sub block</p><p>yip yip</p></div>");

    patch(tree, elem(builder1, ["foo"], [elem(builder2)]));
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
