import { compile, TemplateSet } from "../../src/qweb_compiler";
import { renderToString, TestTemplateSet } from "../helpers";

// -----------------------------------------------------------------------------
// basic validation
// -----------------------------------------------------------------------------

describe("basic validation", () => {
  test("error if no template with given name", () => {
    const templateSet = new TemplateSet();
    expect(() => templateSet.getFunction("invalidname")).toThrow("Missing template");
  });

  test("cannot add twice the same template", () => {
    const templateSet = new TemplateSet();
    expect(() => templateSet.add("test", "<div/>", true)).not.toThrow("already defined");
    expect(() => templateSet.add("test", "<div/>")).toThrow("already defined");
  });

  test("invalid xml", () => {
    const template = "<div>";
    expect(() => compile(template)).toThrow("Invalid XML in template");
  });

  test("missing template", () => {
    const template = `<t t-call="othertemplate" />`;
    expect(() => renderToString(template)).toThrowError("Missing");
  });

  test("missing template in template set", () => {
    const templateSet = new TestTemplateSet();
    const template = `<t t-call="othertemplate" />`;

    templateSet.add("template", template);
    expect(() => templateSet.renderToString("template")).toThrowError("Missing");
  });

  test("error when unknown directive", () => {
    const template = `<div t-best-beer="rochefort 10">test</div>`;
    expect(() => renderToString(template)).toThrow("Unknown QWeb directive: 't-best-beer'");
  });
});
