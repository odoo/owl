import { renderToString, snapshotEverything, TestContext } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// Simple templates, mostly static
// -----------------------------------------------------------------------------

describe("simple templates, mostly static", () => {
  test("simple string", () => {
    const template = `hello vdom`;
    expect(renderToString(template)).toBe("hello vdom");
  });

  test("simple string in t tag", () => {
    const template = `<t>hello vdom</t>`;
    expect(renderToString(template)).toBe("hello vdom");
  });

  test("empty string", () => {
    const template = ``;
    expect(renderToString(template)).toBe("");
  });

  test("empty string in a template set", () => {
    const template = ``;
    const context = new TestContext();
    context.addTemplate("potato", template);
    expect(context.renderToString("potato")).toBe("");
  });

  test("empty div", () => {
    const template = `<div></div>`;
    expect(renderToString(template)).toBe("<div></div>");
  });

  test("div with content", () => {
    const template = `<div>foo</div>`;
    expect(renderToString(template)).toBe("<div>foo</div>");
  });

  test("multiple root nodes", () => {
    const template = `<div>foo</div><span>hey</span>`;
    expect(renderToString(template)).toBe("<div>foo</div><span>hey</span>");
  });

  test("dynamic text value", () => {
    const template = `<t><t t-out="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("owl");
  });

  test("two t-escs next to each other", () => {
    const template = `<t><t t-esc="text1"/><t t-esc="text2"/></t>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("helloowl");
  });

  test("two t-escs next to each other", () => {
    const template = `<t t-esc="text1"/><t t-esc="text2"/>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("helloowl");
  });

  test("two t-escs next to each other, in a div", () => {
    const template = `<div><t t-esc="text1"/><t t-esc="text2"/></div>`;
    expect(renderToString(template, { text1: "hello", text2: "owl" })).toBe("<div>helloowl</div>");
  });

  test("static text and dynamic text", () => {
    const template = `<t>hello <t t-out="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
  });

  test("static text and dynamic text (no t tag)", () => {
    const template = `hello <t t-out="text"/>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
  });

  test("t-esc in dom node", () => {
    const template = `<div><t t-esc="text"/></div>`;
    expect(renderToString(template, { text: "hello owl" })).toBe("<div>hello owl</div>");
  });

  test("dom node with t-esc", () => {
    const template1 = `<div t-esc="text" />`;
    expect(renderToString(template1, { text: "hello owl" })).toBe("<div>hello owl</div>");
    const template2 = `<div t-esc="text"></div>`;
    expect(renderToString(template2, { text: "hello owl" })).toBe("<div>hello owl</div>");
  });

  test("t-esc in dom node, variations", () => {
    const template1 = `<div>hello <t t-esc="text"/></div>`;
    expect(renderToString(template1, { text: "owl" })).toBe("<div>hello owl</div>");
    const template2 = `<div>hello <t t-esc="text"/> world</div>`;
    expect(renderToString(template2, { text: "owl" })).toBe("<div>hello owl world</div>");
  });

  test("div with a class attribute", () => {
    const template = `<div class="abc">foo</div>`;
    expect(renderToString(template)).toBe(`<div class="abc">foo</div>`);
  });

  test("div with a class attribute with a quote", () => {
    const template = `<div class="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div class="a'bc">word</div>`);
  });

  test("div with an arbitrary attribute with a quote", () => {
    const template = `<div abc="a'bc">word</div>`;
    expect(renderToString(template)).toBe(`<div abc="a'bc">word</div>`);
  });

  test("div with an empty class attribute", () => {
    const template = `<div class="">word</div>`;
    expect(renderToString(template)).toBe(`<div>word</div>`);
  });

  test("div with a span child node", () => {
    const template = `<div><span>word</span></div>`;
    expect(renderToString(template)).toBe("<div><span>word</span></div>");
  });

  test("can render a table row", () => {
    const template = `<tr><td>cell</td></tr>`;
    expect(renderToString(template)).toBe(template);
  });

  test("inline template string in t-esc", () => {
    const template = '<t><t t-esc="`text`"/></t>';
    expect(renderToString(template)).toBe("text");
  });

  test("inline template string with content in t-esc", () => {
    const template = '<t><t t-set="v" t-value="1"/><t t-esc="`text${v}`"/></t>';
    expect(renderToString(template)).toBe("text1");
  });

  test("inline template string with variable in context", () => {
    const template = '<t><t t-out="`text ${v}`"/></t>';
    expect(renderToString(template, { v: "from context" })).toBe("text from context");
  });

  test("template with t tag with multiple content", () => {
    const template = `<div><t>Loading<t t-if="false"/></t></div>`;
    expect(renderToString(template)).toBe("<div>Loading</div>");
  });

  test("template with multiple t tag with multiple content", () => {
    const template = `
      <div>
        <t t-out="a"/>
        <t>
          <t t-out="b"/>
          <t>Loading<t t-out="c"/></t>
        </t>
      </div>`;
    expect(renderToString(template, { a: "a", b: "b", c: "c" })).toBe("<div>abLoadingc</div>");
  });

  test("text node with backslash at top level", () => {
    const template = "\\";
    expect(renderToString(template)).toBe("\\");
  });

  test("text node with backtick at top-level", () => {
    const template = "`";
    expect(renderToString(template)).toBe("`");
  });

  test("text node with interpolation sigil at top level", () => {
    const template = "${very cool}";
    expect(renderToString(template)).toBe("${very cool}");
  });
});
