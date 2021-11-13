import { TemplateSet } from "../../src/app/template_set";
import { renderToString, TestContext, compile } from "../helpers";

// -----------------------------------------------------------------------------
// basic validation
// -----------------------------------------------------------------------------

describe("basic validation", () => {
  test("error if no template with given name", () => {
    const context = new TemplateSet();
    expect(() => context.getTemplate("invalidname")).toThrow("Missing template");
  });

  test("cannot add twice the same template", () => {
    const context = new TemplateSet();
    expect(() => context.addTemplate("test", "<div/>", { allowDuplicate: true })).not.toThrow(
      "already defined"
    );
    expect(() => context.addTemplate("test", "<div/>")).toThrow("already defined");
  });

  test("invalid xml", () => {
    const template = "<div>";
    expect(() => compile(template)).toThrow("Invalid XML in template");
  });

  test("missing template in template set", () => {
    const context = new TestContext();
    const template = `<t t-call="othertemplate" />`;

    context.addTemplate("template", template);
    expect(() => context.renderToString("template")).toThrowError("Missing");
  });

  test("error when unknown directive", () => {
    const template = `<div t-best-beer="rochefort 10">test</div>`;
    expect(() => renderToString(template)).toThrow("Unknown QWeb directive: 't-best-beer'");
  });
});
