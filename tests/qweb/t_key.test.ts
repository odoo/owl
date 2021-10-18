describe.skip("t-key", () => {
  test("can use t-key directive on a node", () => {
    // qweb.addTemplate("test", `<div t-key="beer.id"><t t-esc="beer.name"/></div>`);
    // expect(renderToString(qweb, "test", { beer: { id: 12, name: "Chimay Rouge" } })).toBe(
    //   "<div>Chimay Rouge</div>"
    // );
  });

  test("t-key directive in a list", () => {
    // qweb.addTemplate(
    //   "test",
    //   `<ul>
    //     <li t-foreach="beers" t-as="beer" t-key="beer.id"><t t-esc="beer.name"/></li>
    //    </ul>`
    // );
    // expect(
    //   renderToString(qweb, "test", {
    //     beers: [{ id: 12, name: "Chimay Rouge" }],
    //   })
    // ).toMatchSnapshot();
  });
});
