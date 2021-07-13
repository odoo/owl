import {
  makeTestFixture,
  renderToBdom,
  renderToString,
  snapshotTemplateCode,
  TestContext,
} from "../helpers";

// -----------------------------------------------------------------------------
// t-esc
// -----------------------------------------------------------------------------

describe("t-esc", () => {
  test("literal", () => {
    const template = `<span><t t-esc="'ok'"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const template = `<span><t t-esc="var"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("escaping", () => {
    const template = `<span><t t-esc="var"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { var: "<ok>abc</ok>" })).toBe(
      "<span>&lt;ok&gt;abc&lt;/ok&gt;</span>"
    );
  });

  test("escaping on a node", () => {
    const template = `<span t-esc="'ok'"/>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body", () => {
    const template = `<span t-esc="'ok'">nope</span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body, as a default", () => {
    const template = `<span t-esc="var">nope</span>`;
    snapshotTemplateCode(template);
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
    snapshotTemplateCode(template);
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

  test("t-esc work with spread operator", () => {
    const template = `<span><t t-esc="[...state.list]"/></span>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { state: { list: [1, 2] } })).toBe("<span>1,2</span>");
  });

  test("t-esc is escaped", () => {
    const template = `<div><t t-set="var"><p>escaped</p></t><t t-esc="var"/></div>`;
    snapshotTemplateCode(template);
    const bdom = renderToBdom(template);
    const fixture = makeTestFixture();
    bdom.mount(fixture, [], []);

    expect(fixture.textContent).toBe("<p>escaped</p>");
  });

  test("t-esc=0 is escaped", () => {
    const context = new TestContext();
    const sub = '<span><t t-esc="0"/></span>';
    const main = `<div><t t-call="sub"><p>escaped</p></t></div>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);
    const bdom = context.getTemplate("main")({});
    const fixture = makeTestFixture();
    bdom.mount(fixture, [], []);
    expect(fixture.querySelector("span")!.textContent).toBe("<p>escaped</p>");
  });
});
