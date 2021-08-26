import { list, mount, multi, patch, text, createBlock, VNode } from "../../src/bdom";
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

function kText(str: string, key: any): VNode {
  const block = text(str);
  block.key = key;
  return block;
}

function n(n: number) {
  return kText(String(n), n);
}

const span = createBlock("<span><block-text-0/></span>");
const p = createBlock("<p><block-text-0/></p>");

function kSpan(str: string, key: any): VNode {
  const block = span([str]);
  block.key = key;
  return block;
}

function kPair(n: number): VNode {
  const bnodes = [p([String(n)]), p([String(n)])];
  const block = multi(bnodes);
  block.key = n;
  return block;
}

describe("list node: misc", () => {
  test("list node", async () => {
    const bnodes = [1, 2, 3].map((key) => kText(`text${key}`, key));

    const tree = list(bnodes);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("text1text2text3");
  });

  test("list vnode can be used as text", () => {
    mount(text(list([text("a"), text("b")]) as any), fixture);
    expect(fixture.innerHTML).toBe("ab");
  });

  test("a list block can be removed and leaves nothing", async () => {
    const bnodes = [
      { id: 1, name: "sheep" },
      { id: 2, name: "cow" },
    ].map((elem) => kText(elem.name, elem.id));

    const tree = list(bnodes);
    expect(fixture.childNodes.length).toBe(0);
    mount(tree, fixture);
    expect(fixture.childNodes.length).toBe(3);
    expect(fixture.innerHTML).toBe("sheepcow");

    tree.remove();
    expect(fixture.innerHTML).toBe("");
    expect(fixture.childNodes.length).toBe(0);
  });

  test("patching a list block inside an elem block", async () => {
    const block = createBlock("<div><block-child-0/></div>");
    const tree = block();
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<div></div>");

    patch(tree, block([], [list([1, 2, 3].map(n))]));
    expect(fixture.innerHTML).toBe("<div>123</div>");

    patch(tree, block([], [list([])]));
    expect(fixture.innerHTML).toBe("<div></div>");

    patch(tree, block([], [list([1, 2, 3].map(n))]));
    expect(fixture.innerHTML).toBe("<div>123</div>");
  });
});

describe("adding/removing elements", () => {
  test("removing elements", () => {
    const tree = list([kText("a", "a")]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("a");

    patch(tree, list([]));
    expect(fixture.innerHTML).toBe("");
  });

  test("removing 1 elements from 2", () => {
    const tree = list([kText("a", "a"), kText("b", "b")]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("ab");

    patch(tree, list([kText("a", "a")]));
    expect(fixture.innerHTML).toBe("a");
  });

  test("removing elements", () => {
    const tree = list([kSpan("a", "a")]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<span>a</span>");

    patch(tree, list([]));
    expect(fixture.innerHTML).toBe("");
  });

  test("removing elements, variation", () => {
    const f = (i: number) => {
      const b = multi([span([`a${i}`]), span([`b${i}`])]);
      b.key = i;
      return b;
    };
    const tree = list([f(1), f(2)]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<span>a1</span><span>b1</span><span>a2</span><span>b2</span>");

    patch(tree, list([]));
    expect(fixture.innerHTML).toBe("");
  });

  test("adding one element at the end", () => {
    const tree = list([n(1), n(2)]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("12");

    patch(tree, list([n(1), n(2), n(3)]));
    expect(fixture.innerHTML).toBe("123");
  });

  test("adding one element at the end", () => {
    const tree = list([n(1)]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("1");

    patch(tree, list([n(1), n(2), n(3)]));
    expect(fixture.innerHTML).toBe("123");
  });

  test("prepend elements: 4,5 => 1,2,3,4,5", () => {
    const tree = list([n(4), n(5)]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("45");

    patch(tree, list([n(1), n(2), n(3), n(4), n(5)]));
    expect(fixture.innerHTML).toBe("12345");
  });

  test("prepend elements: 4,5 => 1,2,3,4,5 (with multi)", () => {
    const tree = list([kPair(4), kPair(5)]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p>4</p><p>4</p><p>5</p><p>5</p>");

    patch(tree, list([1, 2, 3, 4, 5].map(kPair)));
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
  });

  test("add element in middle: 1,2,4,5 => 1,2,3,4,5", () => {
    const tree = list([1, 2, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("1245");

    patch(tree, list([1, 2, 3, 4, 5].map(n)));
    expect(fixture.innerHTML).toBe("12345");
  });

  test("add element in middle: 1,2,4,5 => 1,2,3,4,5 (multi)", () => {
    const tree = list([1, 2, 4, 5].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );

    patch(tree, list([1, 2, 3, 4, 5].map(kPair)));
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
  });

  test("add element at beginning and end: 2,3,4 => 1,2,3,4,5", () => {
    const tree = list([2, 3, 4].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("234");

    patch(tree, list([1, 2, 3, 4, 5].map(n)));
    expect(fixture.innerHTML).toBe("12345");
  });

  test("add element at beginning and end: 2,3,4 => 1,2,3,4,5 (multi)", () => {
    const tree = list([2, 3, 4].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p>");

    patch(tree, list([1, 2, 3, 4, 5].map(kPair)));
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
  });

  test("adds children: [] => [1,2,3]", () => {
    const tree = list([].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("");

    patch(tree, list([1, 2, 3].map(n)));
    expect(fixture.innerHTML).toBe("123");
  });

  test("adds children: [] => [1,2,3] (multi)", () => {
    const tree = list([].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("");

    patch(tree, list([1, 2, 3].map(kPair)));
    expect(fixture.innerHTML).toBe("<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p>");
  });

  test("adds children: [] => [1,2,3] (inside elem)", () => {
    const block = createBlock("<p><block-child-0/></p>");
    const tree = block([], []);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p></p>");

    patch(tree, block([], [list([1, 2, 3].map(n))]));
    expect(fixture.innerHTML).toBe("<p>123</p>");
  });

  test("adds children: [] => [1,2,3] (inside elem, multi)", () => {
    const block = createBlock("<p><block-child-0/></p>");
    const tree = block([], []);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p></p>");

    patch(tree, block([], [list([1, 2, 3].map(kPair))]));
    expect(fixture.innerHTML).toBe("<p><p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p></p>");
  });

  test("remove children: [1,2,3] => []", () => {
    const tree = list([1, 2, 3].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("123");

    patch(tree, list([].map(n)));
    expect(fixture.innerHTML).toBe("");
  });

  test("remove children: [1,2,3] => [] (multi)", () => {
    const tree = list([1, 2, 3].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p>");

    patch(tree, list([].map(kPair)));
    expect(fixture.innerHTML).toBe("");
  });

  test("remove children: [1,2,3] => [] (inside elem)", () => {
    const block = createBlock("<p><block-child-0/></p>");
    const tree = block([], [list([1, 2, 3].map(n))]);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p>123</p>");

    patch(tree, block([], [list([])]));
    expect(fixture.innerHTML).toBe("<p></p>");
  });

  test("remove children from the beginning: [1,2,3,4,5] => [3,4,5]", () => {
    const tree = list([1, 2, 3, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("12345");

    patch(tree, list([3, 4, 5].map(n)));
    expect(fixture.innerHTML).toBe("345");
  });

  test("remove children from the beginning: [1,2,3,4,5] => [3,4,5] (multi)", () => {
    const tree = list([1, 2, 3, 4, 5].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
    patch(tree, list([3, 4, 5].map(kPair)));
    expect(fixture.innerHTML).toBe("<p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>");
  });

  test("remove children from the end: [1,2,3,4,5] => [1,2,3]", () => {
    const tree = list([1, 2, 3, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("12345");

    patch(tree, list([1, 2, 3].map(n)));
    expect(fixture.innerHTML).toBe("123");
  });

  test("remove children from the middle: [1,2,3,4,5] => [1,2,4,5]", () => {
    const tree = list([1, 2, 3, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("12345");

    patch(tree, list([1, 2, 4, 5].map(n)));
    expect(fixture.innerHTML).toBe("1245");
  });
});

describe("element reordering", () => {
  test("move element forward: [1,2,3,4] => [2,3,1,4]", () => {
    const tree = list([1, 2, 3, 4].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("1234");

    patch(tree, list([2, 3, 1, 4].map(n)));
    expect(fixture.innerHTML).toBe("2314");
  });

  test("move element forward: [1,2,3,4] => [2,3,1,4] (multi)", () => {
    const tree = list([1, 2, 3, 4].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p>"
    );
    patch(tree, list([2, 3, 1, 4].map(kPair)));
    expect(fixture.innerHTML).toBe(
      "<p>2</p><p>2</p><p>3</p><p>3</p><p>1</p><p>1</p><p>4</p><p>4</p>"
    );
  });

  test("move element to end: [1,2,3] => [2,3,1]", () => {
    const tree = list([1, 2, 3].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("123");

    patch(tree, list([2, 3, 1].map(n)));
    expect(fixture.innerHTML).toBe("231");
  });

  test("move element to end: [1,2,3] => [2,3,1] (multi)", () => {
    const tree = list([1, 2, 3].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p>");

    patch(tree, list([2, 3, 1].map(kPair)));
    expect(fixture.innerHTML).toBe("<p>2</p><p>2</p><p>3</p><p>3</p><p>1</p><p>1</p>");
  });

  test("move element backward: [1,2,3,4] => [1,4,2,3]", () => {
    const tree = list([1, 2, 3, 4].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("1234");

    patch(tree, list([1, 4, 2, 3].map(n)));
    expect(fixture.innerHTML).toBe("1423");
  });

  test("swaps first and last: [1,2,3,4] => [4,3,2,1]", () => {
    const tree = list([1, 2, 3, 4].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("1234");

    patch(tree, list([4, 3, 2, 1].map(n)));
    expect(fixture.innerHTML).toBe("4321");
  });
});

describe("miscellaneous operations", () => {
  test("move to left and replace: [1,2,3,4,5] => [4,1,2,3,6]", () => {
    const tree = list([1, 2, 3, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("12345");

    patch(tree, list([4, 1, 2, 3, 6].map(n)));
    expect(fixture.innerHTML).toBe("41236");
  });

  test("move to left and replace: [1,2,3,4,5] => [4,1,2,3,6] (multi)", () => {
    const tree = list([1, 2, 3, 4, 5].map(kPair));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );

    patch(tree, list([4, 1, 2, 3, 6].map(kPair)));
    expect(fixture.innerHTML).toBe(
      "<p>4</p><p>4</p><p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>6</p><p>6</p>"
    );
  });

  test("move to left and leave hole: [1,4,5] => [4,6]", () => {
    const tree = list([1, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("145");

    patch(tree, list([4, 6].map(n)));
    expect(fixture.innerHTML).toBe("46");
  });

  test("[2,4,5] => [4,5,3]", () => {
    const tree = list([2, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("245");

    patch(tree, list([4, 5, 3].map(n)));
    expect(fixture.innerHTML).toBe("453");
  });

  test("reverse elements [1,2,3,4,5,6,7,8] => [8,7,6,5,4,3,2,1]", () => {
    const tree = list([1, 2, 3, 4, 5, 6, 7, 8].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("12345678");

    patch(tree, list([8, 7, 6, 5, 4, 3, 2, 1].map(n)));
    expect(fixture.innerHTML).toBe("87654321");
  });

  test("some permutation [0,1,2,3,4,5] => [4,3,2,1,5,0]", () => {
    const tree = list([0, 1, 2, 3, 4, 5].map(n));
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("012345");

    patch(tree, list([4, 3, 2, 1, 5, 0].map(n)));
    expect(fixture.innerHTML).toBe("432150");
  });
});
