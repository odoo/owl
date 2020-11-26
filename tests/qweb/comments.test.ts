import { renderToString, snapshotTemplateCode } from "../helpers";

// -----------------------------------------------------------------------------
// comments
// -----------------------------------------------------------------------------

describe("comments", () => {
  test("properly handle comments", () => {
    const template = `<div>hello <!-- comment-->owl</div>`;
    expect(renderToString(template)).toBe("<div>hello <!-- comment-->owl</div>");
    snapshotTemplateCode(template);
  });

  test("only a comment", () => {
    const template = `<!-- comment-->`;
    expect(renderToString(template)).toBe(`<!-- comment-->`);
    snapshotTemplateCode(template);
  });

  test("properly handle comments between t-if/t-else", () => {
    const template = `
        <div>
          <span t-if="true">true</span>
          <!-- comment-->
          <span t-else="">owl</span>
        </div>`;
    expect(renderToString(template)).toBe("<div><span>true</span></div>");
    snapshotTemplateCode(template);
  });
});
