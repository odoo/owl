import {
  renderToBdom,
  renderToString,
  snapshotEverything,
  TestContext,
  makeTestFixture,
} from "../helpers";
import { mount, patch } from "../../src/runtime/blockdom";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-for
// -----------------------------------------------------------------------------

describe("t-for", () => {
  test("simple iteration", () => {
    const template = `<t t-for="item" t-of="[3, 2, 1]" t-key="item"><t t-esc="item"/></t>`;
    expect(renderToString(template)).toBe("321");
  });

  test("simple iteration with two nodes inside", () => {
    const template = `
      <t t-for="item" t-of="[3, 2, 1]" t-key="item">
        <span>a<t t-esc="item"/></span>
        <span>b<t t-esc="item"/></span>
      </t>`;
    const expected =
      "<span>a3</span><span>b3</span><span>a2</span><span>b2</span><span>a1</span><span>b1</span>";
    expect(renderToString(template)).toBe(expected);
  });

  test("destructuring array items", () => {
    const template = `<t t-for="[key, value]" t-of="Object.entries({ a: 1, b: 2 })" t-key="key">(<t t-esc="key"/>: <t t-esc="value"/>)</t>`;
    expect(renderToString(template)).toBe("(a: 1)(b: 2)");
  });

  test("destructuring array items: rest", () => {
    const template = `<t t-for="[head, ...tail]" t-of="[[1, 2, 3], [4, 5, 6]]" t-key="head">(<t t-esc="head"/>;<t t-esc="tail"/>)</t>`;
    expect(renderToString(template)).toBe("(1;2,3)(4;5,6)");
  });

  test("destructuring object items", () => {
    const template = `<t t-for="{ k, v }" t-of="[{ k: 'a', v: 1 }, { k: 'b', v: 2 }]" t-key="k">(<t t-esc="k"/>: <t t-esc="v"/>)</t>`;
    expect(renderToString(template)).toBe("(a: 1)(b: 2)");
  });

  test("destructuring object items: rest", () => {
    const template = `<t t-for="{ k, v }" t-of="[{ k: 'a', v: 1 }, { k: 'b', v: 2 }]" t-key="k">(<t t-esc="k"/>: <t t-esc="v"/>)</t>`;
    expect(renderToString(template)).toBe("(a: 1)(b: 2)");
  });

  test("nested destructuring", () => {
    const template = `<t t-for="[key, {left, right}]" t-of="Object.entries(obj)" t-key="key">(<t t-esc="key"/>: [<t t-esc="left"/>, <t t-esc="right"/>])</t>`;
    expect(
      renderToString(template, {
        obj: {
          a: { left: 1, right: 2 },
          b: { left: 3, right: 4 },
        },
      })
    ).toBe("(a: [1, 2])(b: [3, 4])");
  });

  test("t-key on t-for", async () => {
    const template = `
        <div>
          <t t-for="thing" t-of="things" t-key="thing">
            <span/>
          </t>
        </div>`;

    const fixture = makeTestFixture();

    const vnode1 = renderToBdom(template, { things: [1, 2] });
    mount(vnode1, fixture);
    let elm = fixture;
    expect(elm.innerHTML).toBe("<div><span></span><span></span></div>");
    const first = elm.querySelectorAll("span")[0];
    const second = elm.querySelectorAll("span")[1];

    const vnode2 = renderToBdom(template, { things: [2, 1] });
    patch(vnode1, vnode2);

    expect(elm.innerHTML).toBe("<div><span></span><span></span></div>");
    expect(first).toBe(elm.querySelectorAll("span")[1]);
    expect(second).toBe(elm.querySelectorAll("span")[0]);
  });

  test("simple iteration (in a node)", () => {
    const template = `
        <div>
          <t t-for="item" t-of="[3, 2, 1]" t-key="item"><t t-esc="item"/></t>
        </div>`;
    expect(renderToString(template)).toBe("<div>321</div>");
  });

  test("iterate on items (on a element node)", () => {
    const template = `
        <div>
          <span t-for="item" t-of="[1, 2]" t-key="item"><t t-esc="item"/></span>
        </div>`;
    const expected = `<div><span>1</span><span>2</span></div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("iterate, Map param", () => {
    const template = `
      <t t-for="[key, value]" t-of="map" t-key="key">
        [<t t-esc="key"/>: <t t-esc="value"/>]
      </t>`;
    const expected = ` [a: 1]  [b: 2]  [c: 3] `;
    const context = {
      map: new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("iterate, Set param", () => {
    const template = `
      <t t-for="item" t-of="set" t-key="item">
        <t t-esc="item"/>
      </t>`;
    const expected = `123`;
    const context = { set: new Set([1, 2, 3]) };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("iterate, iterable param", () => {
    const template = `
      <t t-for="item" t-of="map.values()" t-key="item">
        <t t-esc="item"/>
      </t>`;
    const expected = `123`;
    const context = {
      map: new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("iterate, generator param", () => {
    const template = `
      <t t-for="item" t-of="gen()" t-key="item">
        <t t-esc="item"/>
      </t>`;
    const expected = `123`;
    const context = {
      *gen() {
        yield 1;
        yield 2;
        yield 3;
      },
    };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("does not pollute the rendering context", () => {
    const template = `
        <div>
          <t t-for="item" t-of="[1]" t-key="item"><t t-esc="item"/></t>
        </div>`;
    const context = { __owl__: {} };
    renderToString(template, context);
    expect(Object.keys(context)).toEqual(["__owl__"]);
  });

  test("t-for in t-for", () => {
    const template = `
        <div>
          <t t-for="number" t-of="numbers" t-key="number">
            <t t-for="letter" t-of="letters" t-key="letter">
              [<t t-esc="number"/><t t-esc="letter"/>]
            </t>
          </t>
        </div>`;

    const context = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected = "<div> [1a]  [1b]  [2a]  [2b]  [3a]  [3b] </div>";
    expect(renderToString(template, context)).toBe(expected);
  });

  test("t-for in t-foreach", () => {
    const template = `
        <div>
          <t t-foreach="numbers" t-as="number" t-key="number">
            <t t-for="letter" t-of="letters" t-key="letter">
              [<t t-esc="number"/><t t-esc="letter"/>]
            </t>
          </t>
        </div>`;

    const context = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected = "<div> [1a]  [1b]  [2a]  [2b]  [3a]  [3b] </div>";
    expect(renderToString(template, context)).toBe(expected);
  });

  test("t-foreach in t-for", () => {
    const template = `
        <div>
          <t t-for="number" t-of="numbers" t-key="number">
            <t t-foreach="letters" t-as="letter" t-key="letter">
              [<t t-esc="number"/><t t-esc="letter"/>]
            </t>
          </t>
        </div>`;

    const context = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected = "<div> [1a]  [1b]  [2a]  [2b]  [3a]  [3b] </div>";
    expect(renderToString(template, context)).toBe(expected);
  });

  test("t-call without body in t-for in t-for", () => {
    const context = new TestContext();
    const sub = `
        <t>
          <t t-set="c" t-value="'x' + '_' + a + '_'+ b" />
          [<t t-esc="a" />]
          [<t t-esc="b" />]
          [<t t-esc="c" />]
        </t>`;

    const main = `
        <div>
          <t t-for="a" t-of="numbers" t-key="a">
            <t t-for="b" t-of="letters" t-key="b">
              <t t-call="sub" />
            </t>
            <span t-esc="c"/>
          </t>
          <span>[<t t-esc="a" />][<t t-esc="b" />][<t t-esc="c" />]</span>
        </div>`;

    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    const ctx = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected =
      "<div> [1] [a] [x_1_a]  [1] [b] [x_1_b] <span></span> [2] [a] [x_2_a]  [2] [b] [x_2_b] <span></span> [3] [a] [x_3_a]  [3] [b] [x_3_b] <span></span><span>[][][]</span></div>";
    expect(context.renderToString("main", ctx)).toBe(expected);
  });

  test("t-call with body in t-for in t-for", () => {
    const context = new TestContext();
    const sub = `
        <t>
          [<t t-esc="a" />]
          [<t t-esc="b" />]
          [<t t-esc="c" />]
        </t>`;

    const main = `
        <div>
          <t t-for="a" t-of="numbers" t-key="a">
            <t t-for="b" t-of="letters" t-key="b">
              <t t-call="sub" >
                <t t-set="c" t-value="'x' + '_' + a + '_'+ b" />
              </t>
            </t>
            <span t-esc="c"/>
          </t>
          <span>[<t t-esc="a" />][<t t-esc="b" />][<t t-esc="c" />]</span>
        </div>`;

    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    const ctx = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected =
      "<div> [1] [a] [x_1_a]  [1] [b] [x_1_b] <span></span> [2] [a] [x_2_a]  [2] [b] [x_2_b] <span></span> [3] [a] [x_3_a]  [3] [b] [x_3_b] <span></span><span>[][][]</span></div>";
    expect(context.renderToString("main", ctx)).toBe(expected);
  });

  test("throws error if invalid loop expression", () => {
    const test = `<div><t t-for="item" t-of="abc" t-key="item"><span t-key="item"/></t></div>`;
    expect(() => renderToString(test)).toThrow("ctx.abc is not iterable");
  });

  test("t-for with t-if inside", () => {
    const template = `
        <div>
          <t t-for="{ id, text }" t-of="elems" t-key="id">
            <span t-if="id lt 3"><t t-esc="text"/></span>
          </t>
        </div>`;
    const ctx = {
      elems: [
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
      ],
    };
    expect(renderToString(template, ctx)).toBe("<div><span>a</span><span>b</span></div>");
  });

  test("t-for with t-if inside (no external node)", () => {
    const template = `
          <t t-for="{ id, text }" t-of="elems" t-key="id">
            <span t-if="id lt 3"><t t-esc="text"/></span>
          </t>`;
    const ctx = {
      elems: [
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
      ],
    };
    expect(renderToString(template, ctx)).toBe("<span>a</span><span>b</span>");
  });
});
