import { snapshotEverything, TestContext } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-call
// -----------------------------------------------------------------------------

describe("t-call (template calling)", () => {
  test("basic caller", () => {
    const context = new TestContext();
    context.addTemplate("_basic-callee", `<span>ok</span>`);
    context.addTemplate("caller", `<div><t t-call="_basic-callee"/></div>`);

    expect(context.renderToString("caller")).toBe("<div><span>ok</span></div>");
  });

  test("basic caller, no parent node", () => {
    const context = new TestContext();
    context.addTemplate("_basic-callee", `<span>ok</span>`);
    context.addTemplate("caller", `<t t-call="_basic-callee"/>`);

    expect(context.renderToString("caller")).toBe("<span>ok</span>");
  });

  test("t-esc inside t-call, with t-set outside", () => {
    const context = new TestContext();
    const main = `<div><t t-set="v">Hi</t><t t-call="sub"/></div>`;
    context.addTemplate("main", main);
    context.addTemplate("sub", `<span t-esc="v"/>`);

    expect(context.renderToString("main")).toBe("<div><span>Hi</span></div>");
  });

  test("t-call with t-if", () => {
    const context = new TestContext();
    const main = '<div><t t-if="flag" t-call="sub"/></div>';
    context.addTemplate("main", main);
    context.addTemplate("sub", "<span>ok</span>");

    expect(context.renderToString("main", { flag: true })).toBe("<div><span>ok</span></div>");
  });

  test("t-call allowed on a non t node", () => {
    const context = new TestContext();
    const main = '<div t-call="sub"/>';
    context.addTemplate("main", main);
    context.addTemplate("sub", "<span>ok</span>");

    expect(context.renderToString("main")).toBe("<div><span>ok</span></div>");
  });

  test("with unused body", () => {
    const context = new TestContext();
    const sub = "<div>ok</div>";
    const main = '<t t-call="sub">WHEEE</t>';
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with unused setbody", () => {
    const context = new TestContext();
    const sub = "<div>ok</div>";
    const main = `<t t-call="sub"><t t-set="qux" t-value="3"/></t>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with used body", () => {
    const context = new TestContext();
    const sub = '<h1><t t-esc="0"/></h1>';
    const main = '<t t-call="sub">ok</t>';
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<h1>ok</h1>");
  });

  test("with used setbody", () => {
    const context = new TestContext();
    const sub = '<t t-esc="foo"/>';
    const main = `<span><t t-call="sub"><t t-set="foo" t-value="'ok'"/></t></span>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<span>ok</span>");
  });

  test("inherit context", () => {
    const context = new TestContext();
    const sub = '<t t-esc="foo"/>';
    const main = `<div><t t-set="foo" t-value="1"/><t t-call="sub"/></div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>1</div>");
  });

  test("scoped parameters", () => {
    const context = new TestContext();
    const sub = "<t>ok</t>";
    const main = `
        <div>
          <t t-call="sub">
            <t t-set="foo" t-value="42"/>
          </t>
          <t t-esc="foo"/>
        </div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>ok</div>");
  });

  test("scoped parameters, part 2", () => {
    const context = new TestContext();
    const sub = '<t t-esc="foo"/>';
    const main = `
        <div>
          <t t-set="foo" t-value="11"/>
          <t t-call="sub">
            <t t-set="foo" t-value="42"/>
          </t>
          <t t-esc="foo"/>
        </div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>4211</div>");
  });

  test("call with several sub nodes on same line", () => {
    const context = new TestContext();
    const sub = `
        <div>
          <t t-out="0"/>
        </div>`;
    const main = `
        <div>
          <t t-call="sub">
            <span>hey</span> <span>yay</span>
          </t>
        </div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    const expected = "<div><div><span>hey</span> <span>yay</span></div></div>";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-out='0'", () => {
    const context = new TestContext();
    const finalTemplate = `
        <div>
          <span>cascade 2</span>
          <t t-out="0"/>
        </div>`;

    const subSubTemplate = `
        <div>
          <t t-call="finalTemplate">
            <span>cascade 1</span>
            <t t-out="0"/>
          </t>
        </div>`;

    const subTemplate = `
        <div>
          <t t-call="subSubTemplate">
            <span>cascade 0</span>
            <t t-out="0"/>
          </t>
        </div>`;

    const main = `
        <div>
          <t t-call="subTemplate">
            <span>hey</span> <span>yay</span>
          </t>
        </div>`;

    context.addTemplate("finalTemplate", finalTemplate);
    context.addTemplate("subSubTemplate", subSubTemplate);
    context.addTemplate("subTemplate", subTemplate);
    context.addTemplate("main", main);

    const expected =
      "<div><div><div><div><span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span></div></div></div></div>";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-out='0', without external divs", () => {
    const context = new TestContext();
    const finalTemplate = `
          <span>cascade 2</span>
          <t t-out="0"/>`;

    const subSubTemplate = `
          <t t-call="finalTemplate">
            <span>cascade 1</span>
            <t t-out="0"/>
          </t>`;

    const subTemplate = `
          <t t-call="subSubTemplate">
            <span>cascade 0</span>
            <t t-out="0"/>
          </t>`;

    const main = `
          <t t-call="subTemplate">
            <span>hey</span> <span>yay</span>
          </t>`;

    context.addTemplate("finalTemplate", finalTemplate);
    context.addTemplate("subSubTemplate", subSubTemplate);
    context.addTemplate("subTemplate", subTemplate);
    context.addTemplate("main", main);

    const expected =
      "<span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span>";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("recursive template, part 1", () => {
    const context = new TestContext();
    const recursive = `
        <div>
          <span>hey</span>
          <t t-if="false">
            <t t-call="recursive"/>
          </t>
        </div>`;

    context.addTemplate("recursive", recursive);

    const expected = "<div><span>hey</span></div>";
    expect(context.renderToString("recursive")).toBe(expected);
  });

  test("recursive template, part 2", () => {
    const context = new TestContext();
    const Parent = `
        <div>
          <t t-call="nodeTemplate">
              <t t-set="node" t-value="root"/>
          </t>
        </div>`;

    const nodeTemplate = `
        <div>
          <p><t t-esc="node.val"/></p>
          <t t-foreach="node.children or []" t-as="subtree" t-key="subtree_index">
              <t t-call="nodeTemplate">
                  <t t-set="node" t-value="subtree"/>
              </t>
          </t>
        </div>`;

    context.addTemplate("Parent", Parent);
    context.addTemplate("nodeTemplate", nodeTemplate);

    const root = { val: "a", children: [{ val: "b" }, { val: "c" }] };
    const expected = "<div><div><p>a</p><div><p>b</p></div><div><p>c</p></div></div></div>";
    expect(context.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 3", () => {
    const context = new TestContext();
    const Parent = `
        <div>
          <t t-call="nodeTemplate">
              <t t-set="node" t-value="root"/>
          </t>
        </div>`;

    const nodeTemplate = `
        <div>
          <p><t t-esc="node.val"/></p>
          <t t-foreach="node.children or []" t-as="subtree" t-key="subtree_index">
            <t t-call="nodeTemplate">
              <t t-set="node" t-value="subtree"/>
            </t>
        </t>
        </div>`;

    context.addTemplate("Parent", Parent);
    context.addTemplate("nodeTemplate", nodeTemplate);

    const root = { val: "a", children: [{ val: "b", children: [{ val: "d" }] }, { val: "c" }] };
    const expected =
      "<div><div><p>a</p><div><p>b</p><div><p>d</p></div></div><div><p>c</p></div></div></div>";
    expect(context.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 4: with t-set recursive index", () => {
    const context = new TestContext();
    const Parent = `
        <div>
          <t t-call="nodeTemplate">
            <t t-set="recursive_idx" t-value="1"/>
            <t t-set="node" t-value="root"/>
          </t>
        </div>`;

    const nodeTemplate = `
        <div>
          <t t-set="recursive_idx" t-value="recursive_idx + 1"/>
          <p><t t-esc="node.val"/> <t t-esc="recursive_idx"/></p>
          <t t-foreach="node.children or []" t-as="subtree" t-key="subtree_index">
            <t t-call="nodeTemplate">
              <t t-set="node" t-value="subtree"/>
            </t>
          </t>
        </div>`;

    context.addTemplate("Parent", Parent);
    context.addTemplate("nodeTemplate", nodeTemplate);

    const root = {
      val: "a",
      children: [{ val: "b", children: [{ val: "c", children: [{ val: "d" }] }] }],
    };
    const expected =
      "<div><div><p>a 2</p><div><p>b 3</p><div><p>c 4</p><div><p>d 5</p></div></div></div></div></div>";
    expect(context.renderToString("Parent", { root })).toBe(expected);
  });

  test("t-call, conditional and t-set in t-call body", () => {
    const context = new TestContext();
    const callee1 = `<div>callee1</div>`;
    const callee2 = `<div>callee2 <t t-esc="v"/></div>`;
    const caller = `
        <div>
          <t t-set="v1" t-value="'elif'"/>
          <t t-if="v1 === 'if'" t-call="callee1" />
          <t t-elif="v1 === 'elif'" t-call="callee2" >
            <t t-set="v" t-value="'success'" />
          </t>
        </div>`;

    context.addTemplate("callee1", callee1);
    context.addTemplate("callee2", callee2);
    context.addTemplate("caller", caller);

    const expected = `<div><div>callee2 success</div></div>`;
    expect(context.renderToString("caller")).toBe(expected);
  });

  test("t-call with t-set inside and outside", () => {
    const context = new TestContext();
    const main = `
        <div>
          <t t-foreach="list" t-as="v" t-key="v_index">
            <t t-set="val" t-value="v.val"/>
            <t t-call="sub">
              <t t-set="val3" t-value="val*3"/>
            </t>
          </t>
        </div>`;
    const sub = `
        <t>
          <span t-esc="val3"/>
        </t>`;

    context.addTemplate("main", main);
    context.addTemplate("sub", sub);

    const expected = "<div><span>3</span><span>6</span><span>9</span></div>";
    const ctx = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(context.renderToString("main", ctx)).toBe(expected);
  });

  test("t-call with t-set inside and outside. 2", () => {
    const context = new TestContext();
    const main = `
        <div>
          <t t-foreach="list" t-as="v" t-key="v_index">
            <t t-set="val" t-value="v.val"/>
            <t t-call="sub">
              <t t-set="val3" t-value="val*3"/>
            </t>
          </t>
        </div>`;
    const sub = `
        <t>
          <span t-esc="val3"/>
          <t t-esc="w"/>
        </t>`;
    const wrapper = `<p><t t-set="w" t-value="'fromwrapper'"/><t t-call="main"/></p>`;

    context.addTemplate("main", main);
    context.addTemplate("sub", sub);
    context.addTemplate("wrapper", wrapper);

    const expected =
      "<p><div><span>3</span>fromwrapper<span>6</span>fromwrapper<span>9</span>fromwrapper</div></p>";
    const ctx = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(context.renderToString("wrapper", ctx)).toBe(expected);
  });

  test("t-call with t-set inside and body text content", () => {
    const context = new TestContext();
    const main = `
        <div>
          <t t-call="sub">
            <t t-set="val">yip yip</t>
          </t>
        </div>`;
    const sub = `<p><t t-esc="val"/></p>`;

    context.addTemplate("main", main);
    context.addTemplate("sub", sub);

    const expected = "<div><p>yip yip</p></div>";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("t-call with body content as root of a template", () => {
    const context = new TestContext();
    const antony = `<foo><t t-out="0"/></foo>`;
    const main = `<t><t t-call="antony"><p>antony</p></t></t>`;
    context.addTemplate("antony", antony);
    context.addTemplate("main", main);
    const expected = "<foo><p>antony</p></foo>";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("dynamic t-call", () => {
    const context = new TestContext();
    const foo = `<foo><t t-esc="val"/></foo>`;
    const bar = `<bar><t t-esc="val"/></bar>`;
    const main = `<div><t t-call="{{template}}"/></div>`;

    context.addTemplate("foo", foo);
    context.addTemplate("bar", bar);
    context.addTemplate("main", main);

    const expected1 = "<div><foo>foo</foo></div>";
    expect(context.renderToString("main", { template: "foo", val: "foo" })).toBe(expected1);
    const expected2 = "<div><bar>quux</bar></div>";
    expect(context.renderToString("main", { template: "bar", val: "quux" })).toBe(expected2);
  });

  test("t-call-context", () => {
    const context = new TestContext();
    context.addTemplate("sub", `<span><t t-esc="value"/></span>`);
    context.addTemplate("main", `<t t-call="sub" t-call-context="obj"/>`);

    expect(context.renderToString("main", { obj: { value: 123 } })).toBe("<span>123</span>");
  });

  test("t-call on a div with t-call-context", () => {
    const context = new TestContext();
    context.addTemplate("sub", `<span><t t-esc="value"/></span>`);
    context.addTemplate("main", `<div t-call="sub" t-call-context="obj"/>`);

    expect(context.renderToString("main", { obj: { value: 123 } })).toBe(
      "<div><span>123</span></div>"
    );
  });

  test("t-call-context and value in body", () => {
    const context = new TestContext();
    context.addTemplate("sub", `<span><t t-esc="value1"/><t t-esc="value2"/></span>`);
    context.addTemplate(
      "main",
      `
      <t t-call="sub" t-call-context="obj">
        <t t-set="value2" t-value="aaron" />
      </t>`
    );

    expect(context.renderToString("main", { obj: { value1: 123 }, aaron: "lucas" })).toBe(
      "<span>123lucas</span>"
    );
  });
});
