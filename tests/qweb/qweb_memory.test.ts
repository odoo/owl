import { QWeb } from "../../src/qweb/index";
import { renderToString } from "../helpers";

describe("memory", () => {
  test("t-foreach does not leak stuff in global scope", () => {
    let qweb = new QWeb();
    const initialNumberOfGlobals = Object.keys(window).length;
    qweb.addTemplate(
      "test",
      `<p><t t-foreach="[3, 2, 1]" t-as="item"><t t-esc="item"/></t></p>`
    );
    const result = renderToString(qweb, "test");
    const expected = `<p>321</p>`;
    expect(result).toBe(expected);
    expect(Object.keys(window).length).toBe(initialNumberOfGlobals);
  });
});
