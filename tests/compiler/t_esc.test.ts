import { mount } from "../../src/runtime/blockdom";
import {
  makeTestFixture,
  renderToBdom,
  renderToString,
  snapshotEverything,
  TestContext,
} from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-esc
// -----------------------------------------------------------------------------

describe("t-esc", () => {
  test("literal", () => {
    const template = `<span><t t-esc="'ok'"/></span>`;
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const template = `<span><t t-esc="var"/></span>`;
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("escaping", () => {
    const template = `<span><t t-esc="var"/></span>`;
    expect(renderToString(template, { var: "<ok>abc</ok>" })).toBe(
      "<span>&lt;ok&gt;abc&lt;/ok&gt;</span>"
    );
  });

  test("escaping on a node", () => {
    const template = `<span t-esc="'ok'"/>`;
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body", () => {
    const template = `<span t-esc="'ok'">nope</span>`;
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body, as a default", () => {
    const template = `<span t-esc="var">nope</span>`;
    expect(renderToString(template)).toBe("<span>nope</span>");
  });

  test("div with falsy values", () => {
    const template = `
      <div>
        <p t-esc="v1"/>
        <p t-esc="v2"/>
        <p t-esc="v3"/>
        <p t-esc="v4"/>
        <p t-esc="v5"/>
      </div>`;
    const vals = {
      v1: false,
      v2: undefined,
      v3: null,
      v4: 0,
      v5: "",
    };
    expect(renderToString(template, vals)).toBe(
      "<div><p>false</p><p></p><p></p><p>0</p><p></p></div>"
    );
  });

  test("t-esc with the 0 number", () => {
    const template = `<t t-esc="var"/>`;
    expect(renderToString(template, { var: 0 })).toBe("0");
  });

  test("t-esc with the 0 number, in a p", () => {
    const template = `<p><t t-esc="var"/></p>`;
    expect(renderToString(template, { var: 0 })).toBe("<p>0</p>");
  });

  test("top level t-esc with undefined", () => {
    const template = `<t t-esc="var"/>`;
    expect(renderToString(template, { var: undefined })).toBe("");
  });

  test("falsy values in text nodes", () => {
    const template = `
        <t t-esc="v1"/>:<t t-esc="v2"/>:<t t-esc="v3"/>:<t t-esc="v4"/>:<t t-esc="v5"/>`;
    const vals = {
      v1: false,
      v2: undefined,
      v3: null,
      v4: 0,
      v5: "",
    };
    expect(renderToString(template, vals)).toBe("false:::0:");
  });

  test("t-esc work with spread operator", () => {
    const template = `<span><t t-esc="[...state.list]"/></span>`;
    expect(renderToString(template, { state: { list: [1, 2] } })).toBe("<span>1,2</span>");
  });

  test("t-esc is escaped", () => {
    const template = `<div><t t-set="var"><p>escaped</p></t><t t-esc="var"/></div>`;
    const bdom = renderToBdom(template);
    const fixture = makeTestFixture();
    mount(bdom, fixture);

    expect(fixture.textContent).toBe("<p>escaped</p>");
  });

  test("t-esc=0 is escaped", () => {
    const context = new TestContext();
    const sub = '<span><t t-esc="0"/></span>';
    const main = `<div><t t-call="sub"><p>escaped</p></t></div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    const bdom = context.getTemplate("main")({}, {});
    const fixture = makeTestFixture();
    mount(bdom, fixture);
    expect(fixture.querySelector("span")!.textContent).toBe("<p>escaped</p>");
  });
});
