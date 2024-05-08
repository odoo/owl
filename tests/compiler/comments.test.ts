import { renderToString, snapshotEverything } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// comments
// -----------------------------------------------------------------------------

describe("comments", () => {
  test("properly handle comments", () => {
    const template = `<div>hello <!-- comment-->owl</div>`;
    expect(renderToString(template)).toBe("<div>hello <!-- comment-->owl</div>");
  });

  test("only a comment", () => {
    const template = `<!-- comment-->`;
    expect(renderToString(template)).toBe(`<!-- comment-->`);
  });

  test("properly handle comments between t-if/t-else", () => {
    const template = `
        <div>
          <span t-if="true">true</span>
          <!-- comment-->
          <span t-else="">owl</span>
        </div>`;
    expect(renderToString(template)).toBe("<div><span>true</span></div>");
  });

  test("comment node with backslash at top level", () => {
    const template = "<!-- \\ -->";
    expect(renderToString(template)).toBe("<!-- \\ -->");
  });

  test("comment node with backtick at top-level", () => {
    const template = "<!-- ` -->";
    expect(renderToString(template)).toBe("<!-- ` -->");
  });

  test("comment node with interpolation sigil at top level", () => {
    const template = "<!-- ${very cool} -->";
    expect(renderToString(template)).toBe("<!-- ${very cool} -->");
  });
});
