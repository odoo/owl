import { TemplateSet } from "../../src/runtime/template_set";
import { renderToString, snapshotTemplate, TestContext } from "../helpers";

// -----------------------------------------------------------------------------
// basic validation
// -----------------------------------------------------------------------------

describe("basic validation", () => {
  test("error if no template with given name", () => {
    const context = new TemplateSet();
    expect(() => context.getTemplate("invalidname")).toThrow("Missing template");
  });

  test("cannot add a different template with the same name", () => {
    const context = new TemplateSet();
    context.addTemplate("test", `<t/>`);
    // Same template with the same name is fine
    expect(() => context.addTemplate("test", "<t/>")).not.toThrow();
    // Different template with the same name crashes
    expect(() => context.addTemplate("test", "<div/>")).toThrow("already defined");
  });

  test("invalid xml", () => {
    const template = "<div>";
    expect(() => snapshotTemplate(template)).toThrow("Invalid XML in template");
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

  test("compilation error", () => {
    const template = `<div t-att-class="a b">test</div>`;
    expect(() => renderToString(template))
      .toThrow(`Failed to compile anonymous template: Unexpected identifier

generated code:
function(app, bdom, helpers) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(\`<div block-attribute-0="class">test</div>\`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['a']ctx['b'];
    return block1([attr1]);
  }
}`);
  });
});
