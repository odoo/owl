import { snapshotEverything, TestContext } from "../helpers";

snapshotEverything();

describe("loading templates", () => {
  test("can initialize qweb with a string", () => {
    const templates = `<?xml version="1.0" encoding="UTF-8"?>
      <templates id="template" xml:space="preserve">
        <div t-name="hey">jupiler</div>
      </templates>`;
    const context = new TestContext();
    context.addTemplates(templates);
    expect(context.renderToString("hey")).toBe("<div>jupiler</div>");
  });

  test("can initialize qweb with an XMLDocument", () => {
    const data = `<?xml version="1.0" encoding="UTF-8"?>
      <templates id="template" xml:space="preserve">
        <div t-name="hey">jupiler</div>
      </templates>`;
    const xml = new DOMParser().parseFromString(data, "text/xml");
    const context = new TestContext();
    context.addTemplates(xml);
    expect(context.renderToString("hey")).toBe("<div>jupiler</div>");
  });

  test("addTemplates does not modify its xml document in place", () => {
    const data = `<?xml version="1.0" encoding="UTF-8"?>
      <templates id="template" xml:space="preserve"><div t-name="hey"><t t-esc="value"/></div></templates>`;
    const xml = new DOMParser().parseFromString(data, "text/xml");
    const context = new TestContext();
    expect(xml.firstElementChild!.innerHTML).toBe(`<div t-name="hey"><t t-esc="value"/></div>`);
    context.addTemplates(xml);
    expect(context.renderToString("hey", { value: 123 })).toBe("<div>123</div>");
    expect(xml.firstElementChild!.innerHTML).toBe(`<div t-name="hey"><t t-esc="value"/></div>`);
  });

  test("can load a few templates from a xml string", () => {
    const data = `<?xml version="1.0" encoding="UTF-8"?>
      <templates id="template" xml:space="preserve">

        <t t-name="items"><li>ok</li><li>foo</li></t>

        <ul t-name="main"><t t-call="items"/></ul>
      </templates>`;
    const context = new TestContext();
    context.addTemplates(data);
    const result = context.renderToString("main");
    expect(result).toBe("<ul><li>ok</li><li>foo</li></ul>");
  });

  test("can load a few templates from an XMLDocument", () => {
    const data = `<?xml version="1.0" encoding="UTF-8"?>
      <templates id="template" xml:space="preserve">

        <t t-name="items"><li>ok</li><li>foo</li></t>

        <ul t-name="main"><t t-call="items"/></ul>
      </templates>`;
    const xml = new DOMParser().parseFromString(data, "text/xml");
    const context = new TestContext();
    context.addTemplates(xml);
    const result = context.renderToString("main");
    expect(result).toBe("<ul><li>ok</li><li>foo</li></ul>");
  });

  test("does not crash if string does not have templates", () => {
    const data = "";
    const context = new TestContext();
    context.addTemplates(data);
    expect(Object.keys(context.rawTemplates)).toEqual([]);
  });

  test("does not crash if XMLDocument does not have templates", () => {
    const data = "";
    const xml = new DOMParser().parseFromString(data, "text/xml");
    const context = new TestContext();
    context.addTemplates(xml);
    expect(Object.keys(context.rawTemplates)).toEqual([]);
  });
});
