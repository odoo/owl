import { renderToString, renderToBdom, snapshotEverything, makeTestFixture } from "../helpers";
import { mount, patch } from "../../src/blockdom/index";

snapshotEverything();

describe("t-key", () => {
  test("can use t-key directive on a node", () => {
    const template = `<div t-key="beer.id"><t t-esc="beer.name"/></div>`;
    expect(renderToString(template, { beer: { id: 12, name: "Chimay Rouge" } })).toBe(
      "<div>Chimay Rouge</div>"
    );
  });

  test("can use t-key directive on a node as a function", () => {
    const template = `<div t-key="getKey(beer)"><t t-esc="beer.name"/></div>`;
    const getKey = (arg: any) => arg.id;
    expect(renderToString(template, { getKey, beer: { id: 12, name: "Chimay Rouge" } })).toBe(
      "<div>Chimay Rouge</div>"
    );
  });

  test("can use t-key directive on a node 2", async () => {
    const template = `<div t-key="beer.id"><t t-esc="beer.name"/></div>`;
    const bd = renderToBdom(template, { beer: { id: 12, name: "Chimay Rouge" } });
    const fixture = makeTestFixture();
    await mount(bd, fixture);
    const div = fixture.firstChild;

    expect((div as HTMLElement).outerHTML).toBe("<div>Chimay Rouge</div>");
    const bd2 = renderToBdom(template, { beer: { id: 13, name: "Chimay Rouge" } });
    await patch(bd, bd2);
    expect(div !== fixture.firstChild).toBeTruthy();
    expect((div as HTMLElement).outerHTML).toBe("<div>Chimay Rouge</div>");
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
