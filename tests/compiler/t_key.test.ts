import { renderToString, renderToBdom, snapshotEverything, makeTestFixture } from "../helpers";
import { mount, patch } from "../../src/runtime/blockdom/index";

snapshotEverything();

describe("t-key", () => {
  test("can use t-key directive on a node", () => {
    const template = `<div t-key="beer.id"><t t-out="beer.name"/></div>`;
    expect(renderToString(template, { beer: { id: 12, name: "Chimay Rouge" } })).toBe(
      "<div>Chimay Rouge</div>"
    );
  });

  test("can use t-key directive on a node as a function", () => {
    const template = `<div t-key="getKey(beer)"><t t-out="beer.name"/></div>`;
    const getKey = (arg: any) => arg.id;
    expect(renderToString(template, { getKey, beer: { id: 12, name: "Chimay Rouge" } })).toBe(
      "<div>Chimay Rouge</div>"
    );
  });

  test("can use t-key directive on a node 2", async () => {
    const template = `<div t-key="beer.id"><t t-out="beer.name"/></div>`;
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
        <li t-foreach="beers" t-as="beer" t-key="beer.id"><t t-out="beer.name"/></li>
       </ul>`;
    expect(
      renderToString(template, {
        beers: [{ id: 12, name: "Chimay Rouge" }],
      })
    ).toBe("<ul><li>Chimay Rouge</li></ul>");
  });

  test("t-key on sub dom node pushes a child block in its parent", async () => {
    const template = `
      <div>
        <t t-if="hasSpan"><span /></t>
        <div t-key="key"><h1 /></div>
      </div>
    `;

    expect(renderToString(template, { key: "1" })).toBe("<div><div><h1></h1></div></div>");
    expect(renderToString(template, { hasSpan: true, key: "1" })).toBe(
      "<div><span></span><div><h1></h1></div></div>"
    );

    const template2 = `
        <div t-key="key"><h1 /></div>
    `;

    expect(renderToString(template2, { key: "1" })).toBe("<div><h1></h1></div>");
  });

  test("t-key: interaction with t-out", async () => {
    const template = `<p t-key="key" t-out="text"/>`;

    expect(renderToString(template, { key: "1", text: "abc" })).toBe("<p>abc</p>");
  });
});
