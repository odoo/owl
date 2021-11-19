import { renderToString, snapshotEverything } from "../helpers";

snapshotEverything();

describe.only("properly support svg", () => {
  test("add proper namespace to svg", () => {
    const template = `<svg width="100px" height="90px"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </svg>`;
    expect(renderToString(template)).toBe(
      `<svg width=\"100px\" height=\"90px\"><circle cx=\"50\" cy=\"50\" r=\"4\" stroke=\"green\" stroke-width=\"1\" fill=\"yellow\"></circle> </svg>`
    );
  });

  test("add proper namespace to g tags", () => {
    // this is necessary if one wants to use components in a svg
    const template = `<g><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </g>`;
    expect(renderToString(template)).toBe(
      `<g><circle cx=\"50\" cy=\"50\" r=\"4\" stroke=\"green\" stroke-width=\"1\" fill=\"yellow\"></circle> </g>`
    );
  });
});
