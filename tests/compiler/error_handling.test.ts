import { renderToString, snapshotEverything, TestContext } from "../helpers";

snapshotEverything();

describe("error handling", () => {
  test("invalid xml", () => {
    expect(() => renderToString("<div>")).toThrow("Invalid XML in template");
  });

  test("nice warning if no template with given name", () => {
    const context = new TestContext();
    expect(() => context.renderToString("invalidname")).toThrow("Missing template");
  });

  test("cannot add twice the same template", () => {
    const context = new TestContext();
    context.addTemplate("test", `<t></t>`);
    expect(() => context.addTemplate("test", "<div/>", { allowDuplicate: true })).not.toThrow(
      "already defined"
    );
    expect(() => context.addTemplate("test", "<div/>")).toThrow("already defined");
  });

  // test("addTemplates throw if parser error", () => {
  //   const context = new TestContext();
  //   expect(() => {
  //     context.addTemplates("<templates><abc>></templates>");
  //   }).toThrow("Invalid XML in template");
  // });

  test("nice error when t-on is evaluated with a missing event", () => {
    expect(() => renderToString(`<div t-on="somemethod"></div>`)).toThrow(
      "Missing event name with t-on directive"
    );
  });

  test("error when unknown directive", () => {
    expect(() => renderToString(`<div t-best-beer="rochefort 10">test</div>`)).toThrow(
      "Unknown QWeb directive: 't-best-beer'"
    );
  });
});
