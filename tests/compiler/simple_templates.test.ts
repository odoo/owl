import { renderToString, snapshotTemplateCode, TestApp } from "../helpers";

// -----------------------------------------------------------------------------
// Simple templates, mostly static
// -----------------------------------------------------------------------------

describe("simple templates, mostly static", () => {
  test("simple string", () => {
    const template = `hello vdom`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("hello vdom");
  });

  test("simple string in t tag", () => {
    const template = `<t>hello vdom</t>`;
    expect(renderToString(template)).toBe("hello vdom");
    snapshotTemplateCode(template);
  });

  test("empty string", () => {
    const template = ``;
    expect(renderToString(template)).toBe("");
    snapshotTemplateCode(template);
  });

  test("empty string in a template set", () => {
    const template = ``;
    const app = new TestApp();
    app.addTemplate("potato", template);
    expect(app.renderToString("potato")).toBe("");
  });

  test("empty div", () => {
    const template = `<div></div>`;
    expect(renderToString(template)).toBe("<div></div>");
    snapshotTemplateCode(template);
  });

  test("div with content", () => {
    const template = `<div>foo</div>`;
    expect(renderToString(template)).toBe("<div>foo</div>");
    snapshotTemplateCode(template);
  });

  test("multiple root nodes", () => {
    const template = `<div>foo</div><span>hey</span>`;
    expect(renderToString(template)).toBe("<div>foo</div><span>hey</span>");
    snapshotTemplateCode(template);
  });

  test("dynamic text value", () => {
    const template = `<t><t t-esc="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("owl");
    snapshotTemplateCode(template);
  });

  test("two t-escs next to each other", () => {
    const template = `<t><t t-esc="text1"/><t t-esc="text2"/></t>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("helloowl");
    snapshotTemplateCode(template);
  });

  test("two t-escs next to each other", () => {
    const template = `<t t-esc="text1"/><t t-esc="text2"/>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("helloowl");
    snapshotTemplateCode(template);
  });

  test("two t-escs next to each other, in a div", () => {
    const template = `<div><t t-esc="text1"/><t t-esc="text2"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("<div>helloowl</div>");
  });

  test("static text and dynamic text", () => {
    const template = `<t>hello <t t-esc="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
    snapshotTemplateCode(template);
  });

  test("static text and dynamic text (no t tag)", () => {
    const template = `hello <t t-esc="text"/>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
    snapshotTemplateCode(template);
  });

  test("t-esc in dom node", () => {
    const template = `<div><t t-esc="text"/></div>`;
    expect(renderToString(template, { text: "hello owl" })).toBe("<div>hello owl</div>");
    snapshotTemplateCode(template);
  });

  test("dom node with t-esc", () => {
    const template1 = `<div t-esc="text" />`;
    expect(renderToString(template1, { text: "hello owl" })).toBe("<div>hello owl</div>");
    snapshotTemplateCode(template1);
    const template2 = `<div t-esc="text"></div>`;
    expect(renderToString(template2, { text: "hello owl" })).toBe("<div>hello owl</div>");
  });

  test("t-esc in dom node, variations", () => {
    const template1 = `<div>hello <t t-esc="text"/></div>`;
    expect(renderToString(template1, { text: "owl" })).toBe("<div>hello owl</div>");
    snapshotTemplateCode(template1);
    const template2 = `<div>hello <t t-esc="text"/> world</div>`;
    expect(renderToString(template2, { text: "owl" })).toBe("<div>hello owl world</div>");
    snapshotTemplateCode(template2);
  });

  test("div with a class attribute", () => {
    const template = `<div class="abc">foo</div>`;
    expect(renderToString(template)).toBe(`<div class="abc">foo</div>`);
    snapshotTemplateCode(template);
  });

  test("div with a class attribute with a quote", () => {
    const template = `<div class="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div class="a'bc">word</div>`);
    snapshotTemplateCode(template);
  });

  test("div with an arbitrary attribute with a quote", () => {
    const template = `<div abc="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div abc="a'bc">word</div>`);
    snapshotTemplateCode(template);
  });

  test("div with an empty class attribute", () => {
    const template = `<div class="">word</div>`;
    expect(renderToString(template)).toBe(`<div>word</div>`);
    snapshotTemplateCode(template);
  });

  test("div with a span child node", () => {
    const template = `<div><span>word</span></div>`;
    expect(renderToString(template)).toBe("<div><span>word</span></div>");
    snapshotTemplateCode(template);
  });

  test("can render a table row", () => {
    const template = `<tr><td>cell</td></tr>`;
    expect(renderToString(template)).toBe(template);
    snapshotTemplateCode(template);
  });
});
