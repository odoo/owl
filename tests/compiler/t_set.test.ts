import { renderToString, snapshotEverything, TestContext } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-set
// -----------------------------------------------------------------------------

describe("t-set", () => {
  test("set from attribute literal", () => {
    const template = `<div><t t-set="value" t-value="'ok'"/><t t-esc="value"/></div>`;
    expect(renderToString(template)).toBe("<div>ok</div>");
  });

  test("t-set does not modify render context existing key values", () => {
    const template = `<div><t t-set="value" t-value="35"/><t t-esc="value"/></div>`;
    const ctx = { value: 17 };
    expect(renderToString(template, ctx)).toBe("<div>35</div>");
    expect(ctx.value).toBe(17);
  });

  test("set from attribute literal (no outside div)", () => {
    const template = `<t><t t-set="value" t-value="'ok'"/><t t-esc="value"/></t>`;
    expect(renderToString(template)).toBe("ok");
  });

  test("t-set and t-if", () => {
    const template = `
        <div>
          <t t-set="v" t-value="value"/>
          <t t-if="v === 'ok'">grimbergen</t>
        </div>`;
    expect(renderToString(template, { value: "ok" })).toBe("<div>grimbergen</div>");
  });

  test("t-set, multiple t-ifs, and a specific configuration", () => {
    const template = `
      <p>
        <div>
          <t t-if="flag" t-set="bouh" t-value="2"/>
          <span>First div</span>
        </div>
        <div>
          <t t-if="!flag">Second</t>
        </div>
      </p>`;
    expect(renderToString(template)).toBe(
      "<p><div><span>First div</span></div><div>Second</div></p>"
    );
  });

  test("set from body literal", () => {
    const template = `<t><t t-set="value">ok</t><t t-esc="value"/></t>`;
    expect(renderToString(template)).toBe("ok");
  });

  test("set from body literal (with t-if/t-else", () => {
    const template = `
      <t>
        <t t-set="value">
          <t t-if="condition">true</t>
          <t t-else="">false</t>
        </t>
        <t t-esc="value"/>
      </t>`;
    expect(renderToString(template, { condition: true })).toBe("true");
    expect(renderToString(template, { condition: false })).toBe("false");
  });

  test("set from attribute lookup", () => {
    const template = `<div><t t-set="stuff" t-value="value"/><t t-esc="stuff"/></div>`;
    expect(renderToString(template, { value: "ok" })).toBe("<div>ok</div>");
  });

  test("t-set evaluates an expression only once", () => {
    const template = `
        <div >
          <t t-set="v" t-value="value + ' artois'"/>
          <t t-esc="v"/>
          <t t-esc="v"/>
        </div>`;
    expect(renderToString(template, { value: "stella" })).toBe(
      "<div>stella artoisstella artois</div>"
    );
  });

  test("set from body lookup", () => {
    const template = `<div><t t-set="stuff"><t t-esc="value"/></t><t t-esc="stuff"/></div>`;
    expect(renderToString(template, { value: "ok" })).toBe("<div>ok</div>");
  });

  test("set from empty body", () => {
    const template = `<div><t t-set="stuff"/><t t-esc="stuff"/></div>`;
    expect(renderToString(template)).toBe("<div></div>");
  });

  test("value priority", () => {
    const template = `<div><t t-set="value" t-value="1">2</t><t t-esc="value"/></div>`;
    expect(renderToString(template)).toBe("<div>1</div>");
  });

  test("value priority (with non text body", () => {
    const template = `<div><t t-set="value" t-value="1"><span>2</span></t><t t-esc="value"/></div>`;
    expect(renderToString(template)).toBe("<div>1</div>");
  });

  test("evaluate value expression", () => {
    const template = `<div><t t-set="value" t-value="1 + 2"/><t t-esc="value"/></div>`;
    expect(renderToString(template)).toBe("<div>3</div>");
  });

  test("t-set should reuse variable if possible", () => {
    const template = `
        <div>
          <t t-set="v" t-value="1"/>
          <div t-foreach="list" t-as="elem" t-key="elem_index">
              <span>v<t t-esc="v"/></span>
              <t t-set="v" t-value="elem"/>
          </div>
        </div>`;
    const expected = "<div><div><span>v1</span></div><div><span>va</span></div></div>";
    expect(renderToString(template, { list: ["a", "b"] })).toBe(expected);
  });

  test("t-set with content and sub t-esc", () => {
    const template = `
        <div>
          <t t-set="setvar"><t t-esc="beep"/> boop</t>
          <t t-esc="setvar"/>
        </div>`;
    expect(renderToString(template, { beep: "beep" })).toBe("<div>beep boop</div>");
  });

  test("evaluate value expression, part 2", () => {
    const template = `<div><t t-set="value" t-value="somevariable + 2"/><t t-esc="value"/></div>`;
    expect(renderToString(template, { somevariable: 43 })).toBe("<div>45</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 1", () => {
    const template = `
        <div>
          <t t-if="flag" t-set="ourvar">1</t>
          <t t-else="" t-set="ourvar" t-value="0"></t>
          <t t-esc="ourvar"/>
        </div>`;

    expect(renderToString(template, { flag: true })).toBe("<div>1</div>");
    expect(renderToString(template, { flag: false })).toBe("<div>0</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 2", () => {
    const template = `
        <div>
          <t t-if="flag" t-set="ourvar" t-value="1"></t>
          <t t-else="" t-set="ourvar">0</t>
          <t t-esc="ourvar"/>
        </div>`;

    expect(renderToString(template, { flag: true })).toBe("<div>1</div>");
    expect(renderToString(template, { flag: false })).toBe("<div>0</div>");
  });

  test("t-set, t-if, and mix of expression/body lookup, 3", () => {
    const template = `
          <t t-if="flag" t-set="ourvar" t-value="1"></t>
          <t t-else="" t-set="ourvar">0</t>
          <t t-esc="ourvar"/>`;

    expect(renderToString(template, { flag: true })).toBe("1");
    expect(renderToString(template, { flag: false })).toBe("0");
  });

  test("t-set body is evaluated immediately", () => {
    const template = `
        <div>
          <t t-set="v1" t-value="'before'"/>
          <t t-set="v2">
            <span><t t-esc="v1"/></span>
          </t>
          <t t-set="v1" t-value="'after'"/>
          <t t-out="v2"/>
        </div>`;

    expect(renderToString(template)).toBe("<div><span>before</span></div>");
  });

  test("t-set with t-value (falsy) and body", () => {
    const template = `
        <div>
          <t t-set="v3" t-value="false"/>
          <t t-set="v1" t-value="'before'"/>
          <t t-set="v2" t-value="v3">
            <span><t t-esc="v1"/></span>
          </t>
          <t t-set="v1" t-value="'after'"/>
          <t t-set="v3" t-value="true"/>
          <t t-out="v2"/>
        </div>`;

    expect(renderToString(template)).toBe("<div><span>before</span></div>");
  });

  test("t-set with t-value (truthy) and body", () => {
    const template = `
        <div>
          <t t-set="v3" t-value="'Truthy'"/>
          <t t-set="v1" t-value="'before'"/>
          <t t-set="v2" t-value="v3">
            <span><t t-esc="v1"/></span>
          </t>
          <t t-set="v1" t-value="'after'"/>
          <t t-set="v3" t-value="false"/>
          <t t-out="v2"/>
        </div>`;

    expect(renderToString(template)).toBe("<div>Truthy</div>");
  });

  test("t-set outside modified in t-foreach", async () => {
    const template = `
      <div>
        <t t-set="iter" t-value="0"/>
        <t t-foreach="['a','b']" t-as="val" t-key="val">
          <p>InLoop: <t t-esc="iter"/></p>
          <t t-set="iter" t-value="iter + 1"/>
        </t>
        <p>EndLoop: <t t-esc="iter"/></p>
      </div>
    `;
    expect(renderToString(template)).toBe(
      "<div><p>InLoop: 0</p><p>InLoop: 1</p><p>EndLoop: 2</p></div>"
    );
  });

  test("t-set outside modified in t-foreach increment-after operator", async () => {
    const template = `
      <div>
        <t t-set="iter" t-value="0"/>
        <t t-foreach="['a','b']" t-as="val" t-key="val">
          <p>InLoop: <t t-esc="iter"/></p>
          <t t-set="iter" t-value="iter++"/>
        </t>
        <p>EndLoop: <t t-esc="iter"/></p>
      </div>
    `;
    expect(renderToString(template)).toBe(
      "<div><p>InLoop: 0</p><p>InLoop: 0</p><p>EndLoop: 0</p></div>"
    );
  });

  test("t-set outside modified in t-foreach increment-before operator", async () => {
    const template = `
      <div>
        <t t-set="iter" t-value="0"/>
        <t t-foreach="['a','b']" t-as="val" t-key="val">
          <p>InLoop: <t t-esc="iter"/></p>
          <t t-set="iter" t-value="++iter"/>
        </t>
        <p>EndLoop: <t t-esc="iter"/></p>
      </div>
    `;
    expect(renderToString(template)).toBe(
      "<div><p>InLoop: 0</p><p>InLoop: 1</p><p>EndLoop: 0</p></div>"
    );
  });

  test("t-set can't alter from within callee", async () => {
    const context = new TestContext();
    const sub = `<div><t t-esc="iter"/><t t-set="iter" t-value="'called'"/><t t-esc="iter"/></div>`;
    const main = `
      <div>
        <t t-set="iter" t-value="'source'"/>
        <p><t t-esc="iter"/></p>
        <t t-call="sub"/>
        <p><t t-esc="iter"/></p>
      </div>
    `;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe(
      "<div><p>source</p><div>sourcecalled</div><p>source</p></div>"
    );
  });

  test("t-set can't alter in t-call body", async () => {
    const context = new TestContext();
    const sub = `<div><t t-esc="iter"/><t t-set="iter" t-value="'called'"/><t t-esc="iter"/></div>`;
    const main = `
      <div>
        <t t-set="iter" t-value="'source'"/>
        <p><t t-esc="iter"/></p>
        <t t-call="sub">
          <t t-set="iter" t-value="'inCall'"/>
        </t>
        <p><t t-esc="iter"/></p>
      </div>
    `;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    expect(context.renderToString("main")).toBe(
      "<div><p>source</p><div>inCallcalled</div><p>source</p></div>"
    );
  });
});
