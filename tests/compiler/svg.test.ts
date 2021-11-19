import { renderToString, snapshotEverything } from "../helpers";

// NB: check the snapshots to see where the SVG namespaces are added
snapshotEverything();

describe("properly support svg", () => {
  test("add proper namespace to svg", () => {
    const template = `<svg width="100px" height="90px"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </svg>`;
    expect(renderToString(template)).toBe(
      `<svg width=\"100px\" height=\"90px\"><circle cx=\"50\" cy=\"50\" r=\"4\" stroke=\"green\" stroke-width=\"1\" fill=\"yellow\"></circle> </svg>`
    );
  });

  test("add proper namespace to g tags", () => {
    const template = `<g><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </g>`;
    expect(renderToString(template)).toBe(
      `<g><circle cx=\"50\" cy=\"50\" r=\"4\" stroke=\"green\" stroke-width=\"1\" fill=\"yellow\"></circle> </g>`
    );
  });

  test("namespace to g tags not added if already in svg namespace", () => {
    const template = `<svg><g/></svg>`;
    expect(renderToString(template)).toBe(`<svg><g></g></svg>`);
  });

  test("namespace to svg tags added even if already in svg namespace", () => {
    const template = `<svg><svg/></svg>`;
    expect(renderToString(template)).toBe(`<svg><svg></svg></svg>`);
  });
});
