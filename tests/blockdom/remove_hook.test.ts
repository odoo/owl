import { createBlock, mount, multi, patch } from "../../src/blockdom";
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

describe("before remove is called", () => {
  test("simple removal", async () => {
    const block1 = createBlock("<div><block-child-0/></div>");
    const block2 = createBlock("<p>coucou</p>");

    const child = block2();
    const tree = block1([], [child]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>coucou</p></div>");

    let n = 1;
    child.beforeRemove = () => n++;
    patch(tree, block1([], []), true);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(n).toBe(2);
  });

  test("removal, variation with grandchild", async () => {
    const block1 = createBlock("<p><block-child-0/></p>");
    const block2 = createBlock("<span>coucou</span>");

    const child = block2();
    const tree = block1([], [block1([], [child])]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p><p><span>coucou</span></p></p>");

    let n = 1;
    child.beforeRemove = () => n++;
    patch(tree, block1([], []), true);
    expect(fixture.innerHTML).toBe("<p></p>");
    expect(n).toBe(2);
  });

  test("remove a child of a multi", async () => {
    const block1 = createBlock("<div><block-child-0/></div>");
    const block2 = createBlock("<p>coucou</p>");

    const child1 = block2();
    const child2 = block2();
    const tree = block1([], [multi([child1, child2])]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>coucou</p><p>coucou</p></div>");

    let n = 1;
    child1.beforeRemove = () => n++;
    patch(tree, block1([], [multi([])]), true);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(n).toBe(2);
  });

  test("remove a multi", async () => {
    const block1 = createBlock("<div><block-child-0/></div>");
    const block2 = createBlock("<p>coucou</p>");

    const child1 = block2();
    const child2 = block2();
    const tree = block1([], [multi([child1, child2])]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div><p>coucou</p><p>coucou</p></div>");

    let n = 1;
    child1.beforeRemove = () => n++;
    patch(tree, block1([], []), true);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(n).toBe(2);
  });
});
