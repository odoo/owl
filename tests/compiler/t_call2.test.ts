import { snapshotEverything, TestContext } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-call
// -----------------------------------------------------------------------------

describe("t-call v_2 (template calling)", () => {
  test("basic caller", () => {
    const context = new TestContext();
    context.addTemplate("_basic-callee", `<span>ok</span>`);
    context.addTemplate("caller", `<div><t t-call="_basic-callee" v_2="1"/></div>`);

    expect(context.renderToString("caller")).toBe("<div><span>ok</span></div>");
  });

  test("basic caller, no parent node", () => {
    const context = new TestContext();
    context.addTemplate("_basic-callee", `<span>ok</span>`);
    context.addTemplate("caller", `<t t-call="_basic-callee" v_2="1"/>`);

    expect(context.renderToString("caller")).toBe("<span>ok</span>");
  });

  test("t-esc inside t-call, with t-set outside", () => {
    const context = new TestContext();
    const main = `<div><t t-set="v">Hi</t><t t-call="sub" v_2="1"/></div>`;
    context.addTemplate("main", main);
    context.addTemplate("sub", `<span t-esc="v"/>`);

    expect(context.renderToString("main")).toBe("<div><span></span></div>");
  });

  test("t-call with t-if", () => {
    const context = new TestContext();
    const main = '<div><t t-if="flag" t-call="sub" v_2="1"/></div>';
    context.addTemplate("main", main);
    context.addTemplate("sub", "<span>ok</span>");

    expect(context.renderToString("main", { flag: true })).toBe("<div><span>ok</span></div>");
  });

  test("t-call not allowed on a non t node", () => {
    const context = new TestContext();
    const main = '<div t-call="sub" v_2="1"/>';
    context.addTemplate("main", main);
    context.addTemplate("sub", "<span>ok</span>");

    expect(() => context.renderToString("main")).toThrow(
      "Directive 't-call' with params can only be used on <t> nodes (used on a <div>)"
    );
  });

  test("with unused body", () => {
    const context = new TestContext();
    const sub = "<div>ok</div>";
    const main = '<t t-call="sub" v_2="1">WHEEE</t>';
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with unused setbody", () => {
    const context = new TestContext();
    const sub = "<div>ok</div>";
    const main = `<t t-call="sub" v_2="1"><t t-set="qux" t-value="3"/></t>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with used body", () => {
    const context = new TestContext();
    const sub = '<h1><t t-esc="0"/></h1>';
    const main = '<t t-call="sub" v_2="1">ok</t>';
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<h1>ok</h1>");
  });

  test("values set in body are in call context", () => {
    const context = new TestContext();
    const sub = '<t t-esc="foo"/>';
    const main = `<span><t t-call="sub" v_2="1" foo="'ok'"><t t-set="foo" t-value="'ko'"/></t></span>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<span>ok</span>");
  });

  test("does not inherit context", () => {
    const context = new TestContext();
    const sub = '<t t-esc="foo"/><t t-esc="bar"/>';
    const main = `<div><t t-set="foo" t-value="1"/><t t-set="bar" t-value="2"/><t t-call="sub" v_2="1" bar="bar"/></div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>2</div>");
  });

  test("scoped parameters", () => {
    const context = new TestContext();
    const sub = "<t>ok</t>";
    const main = `
        <div>
          <t t-call="sub" v_2="1">
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
    const sub = '<t t-esc="foo"/><t t-out="0"/>';
    const main = `
        <div>
          <t t-set="foo" t-value="11"/>
          <t t-call="sub" v_2="1" foo="43">
            <t t-set="foo" t-value="42"/>
            <t t-esc="foo"/>
          </t>
          <t t-esc="foo"/>
        </div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe("<div>434211</div>");
  });

  test("call with several sub nodes on same line", () => {
    const context = new TestContext();
    const sub = `
        <div>
          <t t-out="0"/>
        </div>`;
    const main = `
        <div>
          <t t-call="sub" v_2="1">
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
          <t t-call="finalTemplate" v_2="1">
            <span>cascade 1</span>
            <t t-out="0"/>
          </t>
        </div>`;

    const subTemplate = `
        <div>
          <t t-call="subSubTemplate" v_2="1">
            <span>cascade 0</span>
            <t t-out="0"/>
          </t>
        </div>`;

    const main = `
        <div>
          <t t-call="subTemplate" v_2="1">
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
          <t t-call="finalTemplate" v_2="1">
            <span>cascade 1</span>
            <t t-out="0"/>
          </t>`;

    const subTemplate = `
          <t t-call="subSubTemplate" v_2="1">
            <span>cascade 0</span>
            <t t-out="0"/>
          </t>`;

    const main = `
          <t t-call="subTemplate" v_2="1">
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
            <t t-call="recursive" v_2="1"/>
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
          <t t-call="nodeTemplate" v_2="1" node="root"/>
        </div>`;

    const nodeTemplate = `
        <div>
          <p><t t-esc="node.val"/></p>
          <t t-foreach="node.children or []" t-as="subtree" t-key="subtree_index">
              <t t-call="nodeTemplate" v_2="1" node="subtree"/>
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
          <t t-call="nodeTemplate" v_2="1" node="root"/>
        </div>`;

    const nodeTemplate = `
        <div>
          <p><t t-esc="node.val"/></p>
          <t t-foreach="node.children or []" t-as="subtree" t-key="subtree_index">
            <t t-call="nodeTemplate" v_2="1" node="subtree"/>
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
          <t t-call="nodeTemplate" v_2="1" recursive_idx="1" node="root"/>
        </div>`;

    const nodeTemplate = `
        <div>
          <t t-set="recursive_idx" t-value="recursive_idx + 1"/>
          <p><t t-esc="node.val"/> <t t-esc="recursive_idx"/></p>
          <t t-foreach="node.children or []" t-as="subtree" t-key="subtree_index">
            <t t-call="nodeTemplate" v_2="1" node="subtree" recursive_idx="recursive_idx"/>
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
            <t t-call="sub" v_2="1" val3="val*3"/>
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
            <t t-call="sub" v_2="1" val3="val*3" w="w"/>
          </t>
        </div>`;
    const sub = `
        <t>
          <span t-esc="val3"/>
          <t t-esc="w"/>
        </t>`;
    const wrapper = `<p><t t-set="w" t-value="'fromwrapper'"/><t t-call="main" v_2="1" w="w" list="list"/></p>`;

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
          <t t-set="val">yip yip</t>
          <t t-call="sub" v_2="1" val="val">
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
    const main = `<t><t t-call="antony" v_2="1"><p>antony</p></t></t>`;
    context.addTemplate("antony", antony);
    context.addTemplate("main", main);
    const expected = "<foo><p>antony</p></foo>";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("root t-call with body: t-if true", () => {
    const context = new TestContext();
    const subTemplate = `sub`;
    const main = `<t t-call="subTemplate" v_2="1"><t t-if="true">zero</t></t>`;
    context.addTemplate("subTemplate", subTemplate);
    context.addTemplate("main", main);
    const expected = "sub";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("root t-call with body: t-if false", () => {
    const context = new TestContext();
    const subTemplate = `sub`;
    const main = `<t t-call="subTemplate" v_2="1"><t t-if="false">zero</t></t>`;
    context.addTemplate("subTemplate", subTemplate);
    context.addTemplate("main", main);
    const expected = "sub";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("root t-call with body: t-out with default", () => {
    const context = new TestContext();
    const subTemplate = `sub`;
    const main = `<t t-call="subTemplate" v_2="1"><t t-out="nothing">default</t></t>`;
    context.addTemplate("subTemplate", subTemplate);
    context.addTemplate("main", main);
    const expected = "sub";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("root t-call with body: t-foreach", () => {
    const context = new TestContext();
    const subTemplate = `sub`;
    const main = `<t t-call="subTemplate" v_2="1">
      <t t-foreach="[1]" t-as="i" t-key="i">1</t>
    </t>`;
    context.addTemplate("subTemplate", subTemplate);
    context.addTemplate("main", main);
    const expected = "sub";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("dynamic t-call", () => {
    const context = new TestContext();
    const foo = `<foo><t t-esc="val"/></foo>`;
    const bar = `<bar><t t-esc="val"/></bar>`;
    const main = `<div><t t-call="{{template}}" v_2="1" val="val"/></div>`;

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
    context.addTemplate("main", `<t t-call="sub" v_2="1" t-call-context="obj"/>`);

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
      <t t-call="sub" v_2="1" t-call-context="obj">
        <t t-set="value2" t-value="aaron" />
      </t>`
    );

    expect(context.renderToString("main", { obj: { value1: 123 }, aaron: "lucas" })).toBe(
      "<span>123</span>"
    );
  });

  test("nested t-calls with magic variable 0", () => {
    const context = new TestContext();
    context.addTemplate("grandchild", `grandchild<t t-out="0"/>`);
    context.addTemplate("child", `<t t-out="0"/>`);
    context.addTemplate(
      "main",
      `
        <t t-call="child" v_2="1">
            <t t-call="grandchild" v_2="1">
                <p>Some content...</p>
            </t>
        </t>`
    );

    expect(context.renderToString("main")).toBe("grandchild<p>Some content...</p>");
  });

  test("t-call with attributes", () => {
    const context = new TestContext();
    context.addTemplate("sub", `<span><t t-esc="v1"/><t t-esc="v2"/></span>`);
    context.addTemplate("main", `<t t-call="sub" v_2="1" v1="val1" v2="val2"/>`);

    expect(context.renderToString("main", { val1: "abc", val2: "def" })).toBe(
      "<span>abcdef</span>"
    );
  });

  test("t-call with attributes and t-call-context", () => {
    const context = new TestContext();
    context.addTemplate(
      "sub",
      `<span><t t-esc="v1"/><t t-esc="v2"/><t t-esc="v3"/><t t-esc="v4"/></span>`
    );
    context.addTemplate(
      "main",
      `<t t-call="sub" v_2="1" t-call-context="obj" v1="val1" v2="val2"/>`
    );

    expect(
      context.renderToString("main", { obj: { v3: "ghi", v4: "jkl" }, val1: "abc", val2: "def" })
    ).toBe("<span>abcdefghijkl</span>");
  });

  test("t-call with attributes and t-out='0'", () => {
    const context = new TestContext();
    context.addTemplate("sub", `<span><t t-esc="v_2"/><t t-out="0"/></span>`);
    context.addTemplate("main", `<t t-call="sub" v_2="1">Hello</t>`);
    expect(context.renderToString("main")).toBe("<span>1Hello</span>");
  });

  test("t-call and translation contexts", () => {
    const translateFn = jest.fn((expr: string, translationCtx: string) =>
      translationCtx === "fr" ? "jeu" : translationCtx === "pt" ? "título" : expr
    );

    const context = new TestContext({ translateFn });
    context.addTemplate("sub", `<span><t t-esc="title"/><t t-esc="0"/></span>`);
    context.addTemplate("main", `<t t-call="sub" title="'title'" t-translation-context-title="pt" t-translation-context="fr">game</t>`);

    expect(context.renderToString("main")).toBe(
      "<span>títulojeu</span>"
    );
  });
});
