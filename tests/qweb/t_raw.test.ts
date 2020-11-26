import { renderToString, snapshotTemplateCode } from "../helpers";

// -----------------------------------------------------------------------------
// t-raw
// -----------------------------------------------------------------------------

describe("t-raw", () => {
  test("literal", () => {
    const template = `<span><t t-raw="'ok'"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("literal, no outside html element", () => {
    const template = `<t t-raw="'ok'"/>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("ok");
  });

  test("variable", () => {
    const template = `<span><t t-raw="var"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("not escaping", () => {
    const template = `<div><t t-raw="var"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "<ok></ok>" })).toBe("<div><ok></ok></div>");
  });

  test("t-raw and another sibling node", () => {
    const template = `<span><span>hello</span><t t-raw="var"/></span>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>nope</span>");
  });

  test("t-raw on a node with a dom node in body, as a default", () => {
    const template = `<span t-raw="var"><div>nope</div></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span><div>nope</div></span>");
  });
});
