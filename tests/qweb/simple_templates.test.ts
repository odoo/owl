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
    const template = `<t><t t-esc="text"/></t>`;
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
    const template = `<t>hello <t t-esc="text"/></t>`;
    expect(renderToString(template, { text: "owl" })).toBe("hello owl");
  });

  test("static text and dynamic text (no t tag)", () => {
    const template = `hello <t t-esc="text"/>`;
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
    const template = '<t><t t-esc="`text ${v}`"/></t>';
    expect(renderToString(template, { v: "from context" })).toBe("text from context");
  });
});

describe("loading templates", () => {
  test.skip("can initialize qweb with a string", () => {
    /*    const templates = `<?xml version="1.0" encoding="UTF-8"?>
      <templates id="template" xml:space="preserve">
        <div t-name="hey">jupiler</div>
      </templates>`;
    const qweb = new QWeb({ templates });
    expect(renderToString(qweb, "hey")).toBe("<div>jupiler</div>");*/
  });

  test.skip("can load a few templates from a xml string", () => {
    /*const data = `<?xml version="1.0" encoding="UTF-8"?>
      <templates id="template" xml:space="preserve">

        <t t-name="items"><li>ok</li><li>foo</li></t>

        <ul t-name="main"><t t-call="items"/></ul>
      </templates>`;
    qweb.addTemplates(data);
    const result = renderToString(qweb, "main");
    expect(result).toBe("<ul><li>ok</li><li>foo</li></ul>");*/
  });

  test.skip("does not crash if string does not have templates", () => {
    /*const data = "";
    qweb.addTemplates(data);
    expect(Object.keys(qweb.templates)).toEqual([]);*/
  });
});

describe("global template registration", () => {
  test.skip("can register template globally", () => {
    //   expect.assertions(5);
    //   let qweb = new QWeb();
    //   try {
    //     qweb.render("mytemplate");
    //   } catch (e) {
    //     expect(e.message).toMatch("Template mytemplate does not exist");
    //   }
    //   expect(qweb.templates.mytemplate).toBeUndefined();
    //   QWeb.registerTemplate("mytemplate", "<div>global</div>");
    //   expect(qweb.templates.mytemplate).toBeDefined();
    //   const vnode = qweb.render("mytemplate");
    //   expect(vnode.sel).toBe("div");
    //   expect((vnode as any).children[0].text).toBe("global");
  });
});
