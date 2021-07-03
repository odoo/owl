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

describe("qweb t-att", () => {
  test("t-att-class with multiple classes", () => {
    expect(render(`<div t-att-class="{'a b c': value}" />`, { value: true })).toBe(
      '<div class="a b c"></div>'
    );
    expect(render(`<div t-att-class="{['a b c']: value}" />`, { value: true })).toBe(
      '<div class="a b c"></div>'
    );
  });
});
