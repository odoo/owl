import { App } from "../../src/app";
import { renderToString, TestApp, compile } from "../helpers";

// -----------------------------------------------------------------------------
// basic validation
// -----------------------------------------------------------------------------

describe("basic validation", () => {
  test("error if no template with given name", () => {
    const app = new App();
    expect(() => app.getTemplate("invalidname")).toThrow("Missing template");
  });

  test("cannot add twice the same template", () => {
    const app = new App();
    expect(() => app.addTemplate("test", "<div/>", true)).not.toThrow("already defined");
    expect(() => app.addTemplate("test", "<div/>")).toThrow("already defined");
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
    const app = new TestApp();
    const template = `<t t-call="othertemplate" />`;

    app.addTemplate("template", template);
    expect(() => app.renderToString("template")).toThrowError("Missing");
  });

  test("error when unknown directive", () => {
    const template = `<div t-best-beer="rochefort 10">test</div>`;
    expect(() => renderToString(template)).toThrow("Unknown QWeb directive: 't-best-beer'");
  });
});
