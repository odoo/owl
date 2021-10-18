describe("properly support svg", () => {
  test.skip("add proper namespace to svg", () => {
    // qweb.addTemplate(
    //   "test",
    //   `<svg width="100px" height="90px"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </svg>`
    // );
    // expect(renderToString(qweb, "test")).toBe(
    //   `<svg width=\"100px\" height=\"90px\"><circle cx=\"50\" cy=\"50\" r=\"4\" stroke=\"green\" stroke-width=\"1\" fill=\"yellow\"></circle> </svg>`
    // );
  });

  test.skip("add proper namespace to g tags", () => {
    // this is necessary if one wants to use components in a svg
    // qweb.addTemplate(
    //   "test",
    //   `<g><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </g>`
    // );
    // expect(renderToString(qweb, "test")).toBe(
    //   `<g><circle cx=\"50\" cy=\"50\" r=\"4\" stroke=\"green\" stroke-width=\"1\" fill=\"yellow\"></circle> </g>`
    // );
  });
});
