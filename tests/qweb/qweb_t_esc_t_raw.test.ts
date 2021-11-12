import { QWeb } from "../../src/qweb/index";
import { renderToString } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - qweb: a new QWeb instance

let qweb: QWeb;

beforeEach(() => {
  QWeb.TEMPLATES = {};
  QWeb.nextId = 1;
  qweb = new QWeb();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("old t-esc directive", () => {
  test("simple dynamic value", () => {
    qweb.addTemplate("test", '<t><t t-esc="text"/></t>');
    expect(renderToString(qweb, "test", { text: "hello vdom" })).toBe("hello vdom");
  });

  test("escaping", () => {
    qweb.addTemplate("test", `<span><t t-esc="var"/></span>`);
    expect(renderToString(qweb, "test", { var: "<ok>abc</ok>" })).toBe(
      "<span>&amp;lt;ok&amp;gt;abc&amp;lt;/ok&amp;gt;</span>"
    );
  });
});

describe("old t-raw directive", () => {
  test("literal", () => {
    qweb.addTemplate("test", `<span><t t-raw="'ok'"/></span>`);
    expect(renderToString(qweb, "test")).toBe("<span>ok</span>");
  });

  test("variable", () => {
    qweb.addTemplate("test", `<span><t t-raw="var"/></span>`);
    expect(renderToString(qweb, "test", { var: "ok" })).toBe("<span>ok</span>");
  });

  test("not escaping", () => {
    qweb.addTemplate("test", `<div><t t-raw="var"/></div>`);
    expect(renderToString(qweb, "test", { var: "<ok></ok>" })).toBe("<div><ok></ok></div>");
  });

  test("t-raw and another sibling node", () => {
    qweb.addTemplate("test", `<span><span>hello</span><t t-raw="var"/></span>`);
    expect(renderToString(qweb, "test", { var: "<ok>world</ok>" })).toBe(
      "<span><span>hello</span><ok>world</ok></span>"
    );
  });

  test("t-raw with comment", () => {
    qweb.addTemplate("test", `<span><t t-raw="var"/></span>`);
    expect(renderToString(qweb, "test", { var: "<p>text<!-- top secret --></p>" })).toBe(
      "<span><p>text<!-- top secret --></p></span>"
    );
  });
});
