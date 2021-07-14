import { renderToString, snapshotEverything, TestContext } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-raw
// -----------------------------------------------------------------------------

describe("t-raw", () => {
  test("literal", () => {
    const template = `<span><t t-raw="'ok'"/></span>`;
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("literal, no outside html element", () => {
    const template = `<t t-raw="'ok'"/>`;
    expect(renderToString(template)).toBe("ok");
  });

  test("variable", () => {
    const template = `<span><t t-raw="var"/></span>`;
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("not escaping", () => {
    const template = `<div><t t-raw="var"/></div>`;
    expect(renderToString(template, { var: "<ok></ok>" })).toBe("<div><ok></ok></div>");
  });

  test("t-raw and another sibling node", () => {
    const template = `<span><span>hello</span><t t-raw="var"/></span>`;
    expect(renderToString(template, { var: "<ok>world</ok>" })).toBe(
      "<span><span>hello</span><ok>world</ok></span>"
    );
  });

  test("t-raw with comment", () => {
    const template = `<span><t t-raw="var"/></span>`;
    expect(renderToString(template, { var: "<p>text<!-- top secret --></p>" })).toBe(
      "<span><p>text<!-- top secret --></p></span>"
    );
  });

  test("t-raw on a node with a body, as a default", () => {
    const template = `<span t-raw="var">nope</span>`;
    expect(renderToString(template)).toBe("<span>nope</span>");
  });

  test("t-raw with a <t/> in body", () => {
    const template = `<t t-raw="var"><t></t></t>`;
    expect(renderToString(template, { var: "coucou" })).toBe("coucou");
  });

  test("t-raw with just a t-set t-value in body", () => {
    const template = `<t t-raw="var"><t t-set="a" t-value="1" /></t>`;
    expect(renderToString(template, { var: "coucou" })).toBe("coucou");
  });

  test("t-raw on a node with a dom node in body, as a default", () => {
    const template = `<span t-raw="var"><div>nope</div></span>`;
    expect(renderToString(template)).toBe("<span><div>nope</div></span>");
  });

  test("multiple calls to t-raw", () => {
    const context = new TestContext();
    const sub = `
        <div>
          <t t-raw="0"/>
          <div>Greeter</div>
          <t t-raw="0"/>
        </div>`;

    const main = `
        <div>
          <t t-call="sub">
            <span>coucou</span>
          </t>
        </div>`;

    context.addTemplate("sub", sub);
    context.addTemplate("main", main);
    const expected =
      "<div><div><span>coucou</span><div>Greeter</div><span>coucou</span></div></div>";
    expect(context.renderToString("main")).toBe(expected);
  });
});
