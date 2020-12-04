import { snapshotTemplateCode, TestTemplateSet } from "../helpers";

// -----------------------------------------------------------------------------
// t-call
// -----------------------------------------------------------------------------

describe("t-call (template calling)", () => {
  test("basic caller", () => {
    const templateSet = new TestTemplateSet();
    templateSet.add("_basic-callee", `<span>ok</span>`);
    templateSet.add("caller", `<div><t t-call="_basic-callee"/></div>`);

    snapshotTemplateCode(`<div><t t-call="_basic-callee"/></div>`);
    expect(templateSet.renderToString("caller")).toBe("<div><span>ok</span></div>");
  });

  test("basic caller, no parent node", () => {
    const templateSet = new TestTemplateSet();
    templateSet.add("_basic-callee", `<span>ok</span>`);
    templateSet.add("caller", `<t t-call="_basic-callee"/>`);

    snapshotTemplateCode(`<t t-call="_basic-callee"/>`);
    expect(templateSet.renderToString("caller")).toBe("<span>ok</span>");
  });

  test("t-esc inside t-call, with t-set outside", () => {
    const templateSet = new TestTemplateSet();
    const main = `<div><t t-set="v">Hi</t><t t-call="sub"/></div>`;
    templateSet.add("main", main);
    templateSet.add("sub", `<span t-esc="v"/>`);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div><span>Hi</span></div>");
  });

  test("t-call with t-if", () => {
    const templateSet = new TestTemplateSet();
    const main = '<div><t t-if="flag" t-call="sub"/></div>';
    templateSet.add("main", main);
    templateSet.add("sub", "<span>ok</span>");

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main", { flag: true })).toBe("<div><span>ok</span></div>");
  });

  test("t-call allowed on a non t node", () => {
    const templateSet = new TestTemplateSet();
    const main = '<div t-call="sub"/>';
    templateSet.add("main", main);
    templateSet.add("sub", "<span>ok</span>");

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div><span>ok</span></div>");
  });

  test("with unused body", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<div>ok</div>";
    const main = '<t t-call="sub">WHEEE</t>';
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with unused setbody", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<div>ok</div>";
    const main = `<t t-call="sub"><t t-set="qux" t-value="3"/></t>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("with used body", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<h1><t t-esc="0"/></h1>';
    const main = '<t t-call="sub">ok</t>';
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    expect(templateSet.renderToString("main")).toBe("<h1>ok</h1>");
  });

  test("with used setbody", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<t t-esc="foo"/>';
    const main = `<span><t t-call="sub"><t t-set="foo" t-value="'ok'"/></t></span>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<span>ok</span>");
  });

  test("inherit context", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<t t-esc="foo"/>';
    const main = `<div><t t-set="foo" t-value="1"/><t t-call="sub"/></div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>1</div>");
  });

  test("scoped parameters", () => {
    const templateSet = new TestTemplateSet();
    const sub = "<t>ok</t>";
    const main = `
        <div>
          <t t-call="sub">
            <t t-set="foo" t-value="42"/>
          </t>
          <t t-esc="foo"/>
        </div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>ok</div>");
  });

  test("scoped parameters, part 2", () => {
    const templateSet = new TestTemplateSet();
    const sub = '<t t-esc="foo"/>';
    const main = `
        <div>
          <t t-set="foo" t-value="11"/>
          <t t-call="sub">
            <t t-set="foo" t-value="42"/>
          </t>
          <t t-esc="foo"/>
        </div>`;
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe("<div>4211</div>");
  });

  test("call with several sub nodes on same line", () => {
    const templateSet = new TestTemplateSet();
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
    templateSet.add("sub", sub);
    templateSet.add("main", main);

    snapshotTemplateCode(sub);
    snapshotTemplateCode(main);
    const expected = "<div><div><span>hey</span> <span>yay</span></div></div>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-raw='0'", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("finalTemplate", finalTemplate);
    templateSet.add("subSubTemplate", subSubTemplate);
    templateSet.add("subTemplate", subTemplate);
    templateSet.add("main", main);

    snapshotTemplateCode(finalTemplate);
    snapshotTemplateCode(subTemplate);
    snapshotTemplateCode(subSubTemplate);
    snapshotTemplateCode(main);
    const expected =
      "<div><div><div><div><span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span></div></div></div></div>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("cascading t-call t-raw='0', without external divs", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("finalTemplate", finalTemplate);
    templateSet.add("subSubTemplate", subSubTemplate);
    templateSet.add("subTemplate", subTemplate);
    templateSet.add("main", main);

    snapshotTemplateCode(finalTemplate);
    snapshotTemplateCode(subTemplate);
    snapshotTemplateCode(subSubTemplate);
    snapshotTemplateCode(main);
    const expected =
      "<span>cascade 2</span><span>cascade 1</span><span>cascade 0</span><span>hey</span> <span>yay</span>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("recursive template, part 1", () => {
    const templateSet = new TestTemplateSet();
    const recursive = `
        <div>
          <span>hey</span>
          <t t-if="false">
            <t t-call="recursive"/>
          </t>
        </div>`;

    templateSet.add("recursive", recursive);

    snapshotTemplateCode(recursive);
    const expected = "<div><span>hey</span></div>";
    expect(templateSet.renderToString("recursive")).toBe(expected);
  });

  test("recursive template, part 2", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("Parent", Parent);
    templateSet.add("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = { val: "a", children: [{ val: "b" }, { val: "c" }] };
    const expected = "<div><div><p>a</p><div><p>b</p></div><div><p>c</p></div></div></div>";
    expect(templateSet.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 3", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("Parent", Parent);
    templateSet.add("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = { val: "a", children: [{ val: "b", children: [{ val: "d" }] }, { val: "c" }] };
    const expected =
      "<div><div><p>a</p><div><p>b</p><div><p>d</p></div></div><div><p>c</p></div></div></div>";
    expect(templateSet.renderToString("Parent", { root })).toBe(expected);
  });

  test("recursive template, part 4: with t-set recursive index", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("Parent", Parent);
    templateSet.add("nodeTemplate", nodeTemplate);

    snapshotTemplateCode(Parent);
    snapshotTemplateCode(nodeTemplate);
    const root = {
      val: "a",
      children: [{ val: "b", children: [{ val: "c", children: [{ val: "d" }] }] }],
    };
    const expected =
      "<div><div><p>a 2</p><div><p>b 3</p><div><p>c 4</p><div><p>d 5</p></div></div></div></div></div>";
    expect(templateSet.renderToString("Parent", { root })).toBe(expected);
  });

  test("t-call, conditional and t-set in t-call body", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("callee1", callee1);
    templateSet.add("callee2", callee2);
    templateSet.add("caller", caller);

    snapshotTemplateCode(caller);
    const expected = `<div><div>callee2 success</div></div>`;
    expect(templateSet.renderToString("caller")).toBe(expected);
  });

  test("t-call with t-set inside and outside", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("main", main);
    templateSet.add("sub", sub);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected = "<div><span>3</span><span>6</span><span>9</span></div>";
    const context = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(templateSet.renderToString("main", context)).toBe(expected);
  });

  test("t-call with t-set inside and outside. 2", () => {
    const templateSet = new TestTemplateSet();
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

    templateSet.add("main", main);
    templateSet.add("sub", sub);
    templateSet.add("wrapper", wrapper);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected =
      "<p><div><span>3</span>fromwrapper<span>6</span>fromwrapper<span>9</span>fromwrapper</div></p>";
    const context = { list: [{ val: 1 }, { val: 2 }, { val: 3 }] };
    expect(templateSet.renderToString("wrapper", context)).toBe(expected);
  });

  test("t-call with t-set inside and body text content", () => {
    const templateSet = new TestTemplateSet();
    const main = `
        <div>
          <t t-call="sub">
            <t t-set="val">yip yip</t>
          </t>
        </div>`;
    const sub = `<p><t t-esc="val"/></p>`;

    templateSet.add("main", main);
    templateSet.add("sub", sub);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const expected = "<div><p>yip yip</p></div>";
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("t-call with body content as root of a template", () => {
    const templateSet = new TestTemplateSet();
    const antony = `<foo><t t-raw="0"/></foo>`;
    const main = `<t><t t-call="antony"><p>antony</p></t></t>`;
    templateSet.add("antony", antony);
    templateSet.add("main", main);
    const expected = "<foo><p>antony</p></foo>";
    snapshotTemplateCode(antony);
    snapshotTemplateCode(main);
    expect(templateSet.renderToString("main")).toBe(expected);
  });

  test("dynamic t-call", () => {
    const templateSet = new TestTemplateSet();
    const foo = `<foo><t t-esc="val"/></foo>`;
    const bar = `<bar><t t-esc="val"/></bar>`;
    const main = `<div><t t-call="{{template}}"/></div>`;

    templateSet.add("foo", foo);
    templateSet.add("bar", bar);
    templateSet.add("main", main);

    snapshotTemplateCode(main);
    const expected1 = "<div><foo>foo</foo></div>";
    expect(templateSet.renderToString("main", { template: "foo", val: "foo" })).toBe(expected1);
    const expected2 = "<div><bar>quux</bar></div>";
    expect(templateSet.renderToString("main", { template: "bar", val: "quux" })).toBe(expected2);
  });
});
