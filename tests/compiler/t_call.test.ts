import { snapshotTemplateCode, TestApp } from "../helpers";

// -----------------------------------------------------------------------------
// t-call
// -----------------------------------------------------------------------------

describe("t-call (template calling)", () => {
  test("basic caller", () => {
    const app = new TestApp();
    app.addTemplate("_basic-callee", `<span>ok</span>`);
    app.addTemplate("caller", `<div><t t-call="_basic-callee"/></div>`);

    snapshotTemplateCode(`<div><t t-call="_basic-callee"/></div>`);
    expect(app.renderToString("caller")).toBe("<div><span>ok</span></div>");
  });

  test("basic caller, no parent node", () => {
    const app = new TestApp();
    app.addTemplate("_basic-callee", `<span>ok</span>`);
    app.addTemplate("caller", `<t t-call="_basic-callee"/>`);

    snapshotTemplateCode(`<t t-call="_basic-callee"/>`);
    expect(app.renderToString("caller")).toBe("<span>ok</span>");
  });

  test("t-esc inside t-call, with t-set outside", () => {
    const app = new TestApp();
    const main = `<div><t t-set="v">Hi</t><t t-call="sub"/></div>`;
    app.addTemplate("main", main);
    app.addTemplate("sub", `<span t-esc="v"/>`);

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<div><span>Hi</span></div>");
  });

  test("t-call with t-if", () => {
    const app = new TestApp();
    const main = '<div><t t-if="flag" t-call="sub"/></div>';
    app.addTemplate("main", main);
    app.addTemplate("sub", "<span>ok</span>");

    snapshotTemplateCode(main);
    expect(app.renderToString("main", { flag: true })).toBe("<div><span>ok</span></div>");
  });

  test("t-call allowed on a non t node", () => {
    const app = new TestApp();
    const main = '<div t-call="sub"/>';
    app.addTemplate("main", main);
    app.addTemplate("sub", "<span>ok</span>");

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<div><span>ok</span></div>");
  });

  test("with unused body", () => {
    const app = new TestApp();
    const sub = "<div>ok</div>";
    const main = '<t t-call="sub">WHEEE</t>';
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with unused setbody", () => {
    const app = new TestApp();
    const sub = "<div>ok</div>";
    const main = `<t t-call="sub"><t t-set="qux" t-value="3"/></t>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with used body", () => {
    const app = new TestApp();
    const sub = '<h1><t t-esc="0"/></h1>';
    const main = '<t t-call="sub">ok</t>';
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    expect(app.renderToString("main")).toBe("<h1>ok</h1>");
  });

  test("with used setbody", () => {
    const app = new TestApp();
    const sub = '<t t-esc="foo"/>';
    const main = `<span><t t-call="sub"><t t-set="foo" t-value="'ok'"/></t></span>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<span>ok</span>");
  });

  test("inherit context", () => {
    const app = new TestApp();
    const sub = '<t t-esc="foo"/>';
    const main = `<div><t t-set="foo" t-value="1"/><t t-call="sub"/></div>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<div>1</div>");
  });

  test("scoped parameters", () => {
    const app = new TestApp();
    const sub = "<t>ok</t>";
    const main = `
        <div>
          <t t-call="sub">
            <t t-set="foo" t-value="42"/>
          </t>
          <t t-esc="foo"/>
        </div>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<div>ok</div>");
  });

  test("scoped parameters, part 2", () => {
    const app = new TestApp();
    const sub = '<t t-esc="foo"/>';
    const main = `
        <div>
          <t t-set="foo" t-value="11"/>
          <t t-call="sub">
            <t t-set="foo" t-value="42"/>
          </t>
          <t t-esc="foo"/>
        </div>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe("<div>4211</div>");
  });

  test("call with several sub nodes on same line", () => {
    const app = new TestApp();
    const sub = `
        <div>
          <t t-raw="0"/>
        </div>`;
    const main = `
        <div>
          <t t-call="sub">
            <span>hey</span> <span>yay</span>
          </t>
        </div>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    snapshotTemplateCode(sub);
    snapshotTemplateCode(main);
    const expected = "<div><div><span>hey</span> <span>yay</span></div></div>";
    expect(app.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-raw='0'", () => {
    const app = new TestApp();
    const finalTemplate = `
        <div>
          <span>cascade 2</span>
          <t t-raw="0"/>
        </div>`;

    const subSubTemplate = `
        <div>
          <t t-call="finalTemplate">
            <span>cascade 1</span>
            <t t-raw="0"/>
          </t>
        </div>`;

    const subTemplate = `
        <div>
          <t t-call="subSubTemplate">
            <span>cascade 0</span>
            <t t-raw="0"/>
          </t>
        </div>`;

    const main = `
        <div>
          <t t-call="subTemplate">
            <span>hey</span> <span>yay</span>
          </t>
        </div>`;

    app.addTemplate("finalTemplate", finalTemplate);
    app.addTemplate("subSubTemplate", subSubTemplate);
    app.addTemplate("subTemplate", subTemplate);
    app.addTemplate("main", main);

    snapshotTemplateCode(finalTemplate);
    snapshotTemplateCode(subTemplate);
    snapshotTemplateCode(subSubTemplate);
    snapshotTemplateCode(main);
    const expected =
      "<div><div><div><div><span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span></div></div></div></div>";
    expect(app.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-raw='0', without external divs", () => {
    const app = new TestApp();
    const finalTemplate = `
          <span>cascade 2</span>
          <t t-raw="0"/>`;

    const subSubTemplate = `
          <t t-call="finalTemplate">
            <span>cascade 1</span>
            <t t-raw="0"/>
          </t>`;

    const subTemplate = `
          <t t-call="subSubTemplate">
            <span>cascade 0</span>
            <t t-raw="0"/>
          </t>`;

    const main = `
          <t t-call="subTemplate">
            <span>hey</span> <span>yay</span>
          </t>`;

    app.addTemplate("finalTemplate", finalTemplate);
    app.addTemplate("subSubTemplate", subSubTemplate);
    app.addTemplate("subTemplate", subTemplate);
    app.addTemplate("main", main);

    snapshotTemplateCode(finalTemplate);
    snapshotTemplateCode(subTemplate);
    snapshotTemplateCode(subSubTemplate);
    snapshotTemplateCode(main);
    const expected =
      "<span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span>";
    expect(app.renderToString("main")).toBe(expected);
  });

  test("recursive template, part 1", () => {
    const app = new TestApp();
    const recursive = `
        <div>
          <span>hey</span>
          <t t-if="false">
            <t t-call="recursive"/>
          </t>
        </div>`;

    app.addTemplate("recursive", recursive);

    snapshotTemplateCode(recursive);
    const expected = "<div><span>hey</span></div>";
    expect(app.renderToString("recursive")).toBe(expected);
  });

  test("recursive template, part 2", () => {
    const app = new TestApp();
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

    app.addTemplate("Parent", Parent);
    app.addTemplate("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = { val: "a", children: [{ val: "b" }, { val: "c" }] };
    const expected = "<div><div><p>a</p><div><p>b</p></div><div><p>c</p></div></div></div>";
    expect(app.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 3", () => {
    const app = new TestApp();
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

    app.addTemplate("Parent", Parent);
    app.addTemplate("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = { val: "a", children: [{ val: "b", children: [{ val: "d" }] }, { val: "c" }] };
    const expected =
      "<div><div><p>a</p><div><p>b</p><div><p>d</p></div></div><div><p>c</p></div></div></div>";
    expect(app.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 4: with t-set recursive index", () => {
    const app = new TestApp();
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

    app.addTemplate("Parent", Parent);
    app.addTemplate("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = {
      val: "a",
      children: [{ val: "b", children: [{ val: "c", children: [{ val: "d" }] }] }],
    };
    const expected =
      "<div><div><p>a 2</p><div><p>b 3</p><div><p>c 4</p><div><p>d 5</p></div></div></div></div></div>";
    expect(app.renderToString("Parent", { root })).toBe(expected);
  });

  test("t-call, conditional and t-set in t-call body", () => {
    const app = new TestApp();
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

    app.addTemplate("callee1", callee1);
    app.addTemplate("callee2", callee2);
    app.addTemplate("caller", caller);

    snapshotTemplateCode(caller);
    const expected = `<div><div>callee2 success</div></div>`;
    expect(app.renderToString("caller")).toBe(expected);
  });

  test("t-call with t-set inside and outside", () => {
    const app = new TestApp();
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

    app.addTemplate("main", main);
    app.addTemplate("sub", sub);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected = "<div><span>3</span><span>6</span><span>9</span></div>";
    const context = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(app.renderToString("main", context)).toBe(expected);
  });

  test("t-call with t-set inside and outside. 2", () => {
    const app = new TestApp();
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

    app.addTemplate("main", main);
    app.addTemplate("sub", sub);
    app.addTemplate("wrapper", wrapper);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected =
      "<p><div><span>3</span>fromwrapper<span>6</span>fromwrapper<span>9</span>fromwrapper</div></p>";
    const context = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(app.renderToString("wrapper", context)).toBe(expected);
  });

  test("t-call with t-set inside and body text content", () => {
    const app = new TestApp();
    const main = `
        <div>
          <t t-call="sub">
            <t t-set="val">yip yip</t>
          </t>
        </div>`;
    const sub = `<p><t t-esc="val"/></p>`;

    app.addTemplate("main", main);
    app.addTemplate("sub", sub);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected = "<div><p>yip yip</p></div>";
    expect(app.renderToString("main")).toBe(expected);
  });

  test("t-call with body content as root of a template", () => {
    const app = new TestApp();
    const antony = `<foo><t t-raw="0"/></foo>`;
    const main = `<t><t t-call="antony"><p>antony</p></t></t>`;
    app.addTemplate("antony", antony);
    app.addTemplate("main", main);
    const expected = "<foo><p>antony</p></foo>";
    snapshotTemplateCode(antony);
    snapshotTemplateCode(main);
    expect(app.renderToString("main")).toBe(expected);
  });

  test("dynamic t-call", () => {
    const app = new TestApp();
    const foo = `<foo><t t-esc="val"/></foo>`;
    const bar = `<bar><t t-esc="val"/></bar>`;
    const main = `<div><t t-call="{{template}}"/></div>`;

    app.addTemplate("foo", foo);
    app.addTemplate("bar", bar);
    app.addTemplate("main", main);

    snapshotTemplateCode(main);
    const expected1 = "<div><foo>foo</foo></div>";
    expect(app.renderToString("main", { template: "foo", val: "foo" })).toBe(expected1);
    const expected2 = "<div><bar>quux</bar></div>";
    expect(app.renderToString("main", { template: "bar", val: "quux" })).toBe(expected2);
  });
});
