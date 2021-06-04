import { QWeb } from "../../src/qweb/index";
import { renderToString } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

function render(template, context = {}) {
  const qweb = new QWeb();
  qweb.addTemplate("test", template);
  return renderToString(qweb, "test", context);
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("qweb t-tag", () => {
  test("simple usecases", () => {
    expect(render(`<t t-tag="'div'"></t>`)).toBe("<div></div>");
    expect(render(`<t t-tag="tag">text</t>`, { tag: "span" })).toBe("<span>text</span>");
  });

  test("with multiple child nodes", () => {
    const template = `
            <t t-tag="tag">
                pear
                <span>apple</span>
                strawberry
            </t>`;
    expect(render(template, { tag: "div" })).toBe(
      "<div> pear <span>apple</span> strawberry </div>"
    );
  });

  test("with multiple attributes", () => {
    const template = `
            <t t-tag="tag" class="blueberry" taste="raspberry">gooseberry</t>`;
    const expected = `<div taste=\"raspberry\" class=\"blueberry\">gooseberry</div>`;
    expect(render(template, { tag: "div" })).toBe(expected);
  });
});
