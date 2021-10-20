import { renderToString, snapshotEverything } from "../helpers";

snapshotEverything();

describe("memory", () => {
  test("t-foreach does not leak stuff in global scope", () => {
    const initialNumberOfGlobals = Object.keys(window).length;
    const template = `<p><t t-foreach="[3, 2, 1]" t-as="item" t-key="item_index"><t t-esc="item"/></t></p>`;
    expect(renderToString(template)).toBe("<p>321</p>");
    expect(Object.keys(window).length).toBe(initialNumberOfGlobals);
  });
});
