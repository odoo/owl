import { renderToString, snapshotEverything } from "../helpers";

snapshotEverything();

describe("t-key", () => {
  test("can use t-key directive on a node", () => {
    const template = `<div t-key="beer.id"><t t-esc="beer.name"/></div>`;
    expect(renderToString(template, { beer: { id: 12, name: "Chimay Rouge" } })).toBe(
      "<div>Chimay Rouge</div>"
    );
  });

  test("t-key directive in a list", () => {
    const template = `<ul>
        <li t-foreach="beers" t-as="beer" t-key="beer.id"><t t-esc="beer.name"/></li>
       </ul>`;
    expect(
      renderToString(template, {
        beers: [{ id: 12, name: "Chimay Rouge" }],
      })
    ).toBe("<ul><li>Chimay Rouge</li></ul>");
  });
});
