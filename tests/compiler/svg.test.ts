import { renderToString, renderToBdom, snapshotEverything, makeTestFixture } from "../helpers";
import { mount } from "../../src/blockdom";
import { mount as mountComponent, Component } from "../../src/index"

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
    const bdom = renderToBdom(template);
    const fixture = makeTestFixture();

    mount(bdom, fixture);
    const elems = fixture.querySelectorAll("svg");
    expect(elems.length).toEqual(2);
    for (const el of elems) {
      expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    }
  });

  test("svg namespace added to sub-blocks", () => {
    const template = `<svg><path t-if="path"/></svg>`;

    expect(renderToString(template, { path: false })).toBe(`<svg></svg>`);
    expect(renderToString(template, { path: true })).toBe(`<svg><path></path></svg>`);

    const bdom = renderToBdom(template, { path: true });
    const fixture = makeTestFixture();

    mount(bdom, fixture);
    const elems = fixture.querySelectorAll("svg, path");
    expect(elems.length).toEqual(2);
    for (const el of elems) {
      expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    }
  });

  test.only("svg namespace added to sub-blocks (t-call)", async () => {
    const templates = `<t>
      <t t-name="svg"><svg><t t-call="path" /></svg></t>
      <t t-name="path"><path /></t>
    </t>
    `
    const fixture = makeTestFixture();

    class Svg extends Component {
      static template = "svg";
    }

    await mountComponent(Svg, fixture, {templates})
    const elems = fixture.querySelectorAll("svg, path");
    expect(elems.length).toEqual(2);
    for (const el of elems) {
      expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    }
  });
});
