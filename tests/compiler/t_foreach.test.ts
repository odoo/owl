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
// t-foreach
// -----------------------------------------------------------------------------

describe("t-foreach", () => {
  test("simple iteration", () => {
    const template = `<t t-foreach="[3, 2, 1]" t-as="item" t-key="item"><t t-esc="item"/></t>`;
    expect(renderToString(template)).toBe("321");
  });

  test("simple iteration with two nodes inside", () => {
    const template = `
      <t t-foreach="[3, 2, 1]" t-as="item" t-key="item">
        <span>a<t t-esc="item"/></span>
        <span>b<t t-esc="item"/></span>
      </t>`;
    const expected =
      "<span>a3</span><span>b3</span><span>a2</span><span>b2</span><span>a1</span><span>b1</span>";
    expect(renderToString(template)).toBe(expected);
  });

  test("t-key on t-foreach", async () => {
    const template = `
        <div>
          <t t-foreach="things" t-as="thing" t-key="thing">
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
          <t t-foreach="[3, 2, 1]" t-as="item" t-key="item"><t t-esc="item"/></t>
        </div>`;
    expect(renderToString(template)).toBe("<div>321</div>");
  });

  test("iterate on items", () => {
    const template = `
        <div>
          <t t-foreach="[3, 2, 1]" t-as="item" t-key="item">
            [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
          </t>
        </div>`;
    expect(renderToString(template)).toBe("<div> [0: 3 3]  [1: 2 2]  [2: 1 1] </div>");
  });

  test("iterate on items (on a element node)", () => {
    const template = `
        <div>
          <span t-foreach="[1, 2]" t-as="item" t-key="item"><t t-esc="item"/></span>
        </div>`;
    const expected = `<div><span>1</span><span>2</span></div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("iterate, position", () => {
    const template = `
        <div>
          <t t-foreach="Array(5)" t-as="elem" t-key="elem">
            -<t t-if="elem_first"> first</t><t t-if="elem_last"> last</t> (<t t-esc="elem_index"/>)
          </t>
        </div>`;
    const expected = `<div> - first (0)  - (1)  - (2)  - (3)  - last (4) </div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("iterate, dict param", () => {
    const template = `
        <div>
          <t t-foreach="value" t-as="item" t-key="item_index">
            [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
          </t>
        </div>`;
    const expected = `<div> [0: a 1]  [1: b 2]  [2: c 3] </div>`;
    const context = { value: { a: 1, b: 2, c: 3 } };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("iterate, Map param", () => {
    const template = `
      <t t-foreach="value" t-as="item" t-key="item_index">
        [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
      </t>`;
    const expected = ` [0: a 1]  [1: b 2]  [2: c 3] `;
    const context = {
      value: new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("iterate, Set param", () => {
    const template = `
      <t t-foreach="value" t-as="item" t-key="item_index">
        [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
      </t>`;
    const expected = ` [0: 1 1]  [1: 2 2]  [2: 3 3] `;
    const context = { value: new Set([1, 2, 3]) };
    expect(renderToString(template, context)).toBe(expected);
  });

  test("iterate, iterable param", () => {
    const template = `
      <t t-foreach="map.values()" t-as="item" t-key="item_index">
        [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
      </t>`;
    const expected = ` [0: 1 1]  [1: 2 2]  [2: 3 3] `;
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
      <t t-foreach="gen()" t-as="item" t-key="item_index">
        [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
      </t>`;
    const expected = ` [0: 1 1]  [1: 2 2]  [2: 3 3] `;
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
          <t t-foreach="[1]" t-as="item" t-key="item"><t t-esc="item"/></t>
        </div>`;
    const context = { __owl__: {} };
    renderToString(template, context);
    expect(Object.keys(context)).toEqual(["__owl__"]);
  });

  test("t-foreach in t-foreach", () => {
    const template = `
        <div>
          <t t-foreach="numbers" t-as="number" t-key="number">
            <t t-foreach="letters" t-as="letter" t-key="letter">
              [<t t-esc="number"/><t t-esc="letter"/>]
            </t>
          </t>
        </div>`;

    const context = { numbers: [1, 2, 3], letters: ["a", "b"] };
    const expected = "<div> [1a]  [1b]  [2a]  [2b]  [3a]  [3b] </div>";
    expect(renderToString(template, context)).toBe(expected);
  });

  test("t-call without body in t-foreach in t-foreach", () => {
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
          <t t-foreach="numbers" t-as="a" t-key="a">
            <t t-foreach="letters" t-as="b" t-key="b">
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

  test("t-call with body in t-foreach in t-foreach", () => {
    const context = new TestContext();
    const sub = `
        <t>
          [<t t-esc="a" />]
          [<t t-esc="b" />]
          [<t t-esc="c" />]
        </t>`;

    const main = `
        <div>
          <t t-foreach="numbers" t-as="a" t-key="a">
            <t t-foreach="letters" t-as="b"  t-key="b">
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
    const test = `<div><t t-foreach="abc" t-as="item" t-key="item"><span t-key="item_index"/></t></div>`;
    expect(() => renderToString(test)).toThrow(
      'Invalid loop expression: "undefined" is not iterable'
    );
  });

  test("t-foreach with t-if inside", () => {
    const template = `
        <div>
          <t t-foreach="elems" t-as="elem" t-key="elem.id">
            <span t-if="elem.id &lt; 3"><t t-esc="elem.text"/></span>
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

  test("t-foreach with t-if inside (no external node)", () => {
    const template = `
          <t t-foreach="elems" t-as="elem" t-key="elem.id">
            <span t-if="elem.id &lt; 3"><t t-esc="elem.text"/></span>
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

  test("with t-memo", () => {
    const items = [
      { id: 1, x: 1, y: 1 },
      { id: 2, x: 1, y: 1 },
    ];
    const template = `
        <div>
          <p t-foreach="items" t-as="item" t-key="item.id" t-memo="[item.x]">
            <t t-esc="item.x"/>
            <t t-esc="item.y"/>
          </p>
        </div>`;
    const expected = `<div><p>11</p><p>11</p></div>`;
    expect(renderToString(template, { items })).toBe(expected);
  });
});
