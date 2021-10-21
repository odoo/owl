import {
  renderToString,
  snapshotEverything,
} from "../helpers";

snapshotEverything();

describe("qweb t-tag", () => {
  test.skip("simple usecases", () => {
    expect(renderToString(`<t t-tag="'div'"></t>`)).toBe("<div></div>");
    expect(renderToString(`<t t-tag="tag">text</t>`, { tag: "span" })).toBe("<span>text</span>");
  });

  test.skip("with multiple child nodes", () => {
    const template = `
      <t t-tag="tag">
          pear
          <span>apple</span>
          strawberry
      </t>`;
    expect(renderToString(template, { tag: "div" })).toBe(
      "<div> pear <span>apple</span> strawberry </div>"
    );
  });

  test.skip("with multiple attributes", () => {
    const template = `<t t-tag="tag" class="blueberry" taste="raspberry">gooseberry</t>`;
    const expected = `<div taste=\"raspberry\" class=\"blueberry\">gooseberry</div>`;
    expect(renderToString(template, { tag: "div" })).toBe(expected);
  });
});