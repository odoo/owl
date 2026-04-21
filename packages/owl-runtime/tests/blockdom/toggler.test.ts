import { createBlock, mount, patch, text, toggler } from "../../src/blockdom";
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

describe("togglers", () => {
  test("can mount and update text nodes", async () => {
    const tree = toggler("key", text("foo"));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("foo");
    const textnode = fixture.firstChild!;
    expect(textnode.textContent).toBe("foo");
    patch(tree, toggler("key", text("bar")));
    expect(fixture.innerHTML).toBe("bar");
    expect(fixture.firstChild).toBe(textnode);
  });

  test("can toggle between two text nodes (different key)", async () => {
    const tree = toggler("key1", text("foo"));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("foo");
    const textnode = fixture.firstChild!;
    expect(textnode.textContent).toBe("foo");
    patch(tree, toggler("key2", text("bar")));
    expect(fixture.innerHTML).toBe("bar");
    expect(fixture.firstChild).not.toBe(textnode);

    // we check here that the key was properly reset
    const other = fixture.firstChild;
    patch(tree, toggler("key1", text("foo")));
    expect(fixture.innerHTML).toBe("foo");
    expect(fixture.firstChild).not.toBe(other);
  });

  test("can toggle between text node and block", async () => {
    const block = createBlock("<p>hey</p>");
    const tree = toggler("key1", text("foo"));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("foo");
    const textnode = fixture.firstChild!;
    patch(tree, toggler("key2", block()));
    expect(fixture.innerHTML).toBe("<p>hey</p>");
    expect(fixture.firstChild).not.toBe(textnode);
  });

  test("beforeRemove is called", () => {
    const block = createBlock("<p>hey</p>");

    function blockOverriden() {
      const vn = block();
      vn.beforeRemove = () => {
        steps.push("beforeRemove");
      };
      return vn;
    }

    const steps: string[] = [];
    const tree = toggler("key1", blockOverriden());
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p>hey</p>");
    patch(tree, toggler("key2", text("foo")));
    expect(fixture.innerHTML).toBe("foo");

    patch(tree, toggler("key3", blockOverriden()), true);
    expect(fixture.innerHTML).toBe("<p>hey</p>");

    patch(tree, toggler("key2", text("foo")), true);
    expect(fixture.innerHTML).toBe("foo");

    expect(steps).toEqual(["beforeRemove"]);
  });

  test("beforeRemove is called when within a block", () => {
    const block = createBlock("<p><block-child-0/></p>");
    const conditionalBlock = createBlock("<p>hey</p>");

    const steps: string[] = [];

    function blockOverriden() {
      const vn = conditionalBlock();
      vn.beforeRemove = function () {
        steps.push("beforeRemove");
      };
      return vn;
    }
    const mainBlock = block([], [toggler("key1", blockOverriden())]);

    mount(mainBlock, fixture);
    expect(fixture.innerHTML).toBe("<p><p>hey</p></p>");

    patch(mainBlock, block([], []));
    expect(fixture.innerHTML).toBe("<p></p>");

    patch(mainBlock, block([], [toggler("key1", blockOverriden())]), true);
    expect(fixture.innerHTML).toBe("<p><p>hey</p></p>");

    patch(mainBlock, block([], []), true);
    expect(fixture.innerHTML).toBe("<p></p>");

    expect(steps).toEqual(["beforeRemove"]);
  });
});
