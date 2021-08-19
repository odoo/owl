import { renderToString, snapshotEverything } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-set
// -----------------------------------------------------------------------------

describe("t-set", () => {
  test("set from attribute literal", () => {
    const template = `<div><t t-set="value" t-value="'ok'"/><t t-esc="value"/></div>`;
    expect(renderToString(template)).toBe("<div>ok</div>");
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

  test("set from body literal", () => {
    const template = `<t><t t-set="value">ok</t><t t-esc="value"/></t>`;
    expect(renderToString(template)).toBe("ok");
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
          <t t-raw="v2"/>
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
          <t t-raw="v2"/>
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
          <t t-raw="v2"/>
        </div>`;

    expect(renderToString(template)).toBe("<div>Truthy</div>");
  });
});
