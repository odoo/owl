import { renderToString, snapshotTemplateCode } from "../helpers";

// -----------------------------------------------------------------------------
// attributes
// -----------------------------------------------------------------------------

describe("attributes", () => {
  test("static attributes", () => {
    const template = `<div foo="a" bar="b" baz="c"/>`;
    expect(renderToString(template)).toBe(`<div foo="a" bar="b" baz="c"></div>`);
  });

  test("static attributes with dashes", () => {
    const template = `<div aria-label="Close"/>`;
    expect(renderToString(template)).toBe(`<div aria-label="Close"></div>`);
  });

  test("static attributes on void elements", () => {
    const template = `<img src="/test.jpg" alt="Test"/>`;
    expect(renderToString(template)).toBe(`<img src="/test.jpg" alt="Test">`);
  });

  test("dynamic attributes", () => {
    const template = `<div t-att-foo="'bar'"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("two dynamic attributes", () => {
    const template = `<div t-att-foo="'bar'" t-att-bar="'foo'"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar" bar="foo"></div>`);
  });

  test("dynamic class attribute", () => {
    const template = `<div t-att-class="c"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { c: "abc" });
    expect(result).toBe(`<div class="abc"></div>`);
  });

  test("dynamic empty class attribute", () => {
    const template = `<div t-att-class="c"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { c: "" });
    expect(result).toBe(`<div></div>`);
  });

  test("dynamic attribute with a dash", () => {
    const template = `<div t-att-data-action-id="id"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { id: 32 });
    expect(result).toBe(`<div data-action-id="32"></div>`);
  });

  test("dynamic formatted attributes with a dash", () => {
    const template = `<div t-attf-aria-label="Some text {{id}}"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { id: 32 });
    expect(result).toBe(`<div aria-label="Some text 32"></div>`);
  });

  test("fixed variable", () => {
    const template = `<div t-att-foo="value"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { value: "ok" });
    expect(result).toBe(`<div foo="ok"></div>`);
  });

  test("dynamic attribute falsy variable ", () => {
    const template = `<div t-att-foo="value"/>`;
    snapshotTemplateCode(template);
    const result = renderToString(template, { value: false });
    expect(result).toBe(`<div></div>`);
  });
});
