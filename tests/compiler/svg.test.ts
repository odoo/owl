import { renderToString, renderToBdom, snapshotEverything, makeTestFixture } from "../helpers";
import { mount } from "../../src/runtime/blockdom";
import { mount as mountComponent, Component, xml } from "../../src/index";

// NB: check the snapshots to see where the SVG namespaces are added
snapshotEverything();

describe("properly support svg", () => {
  test("add proper namespace to svg", () => {
    const template = `<svg width="100px" height="90px"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </svg>`;
    expect(renderToString(template)).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100px" height="90px"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"></circle> </svg>`
    );
  });

  test("add proper namespace to g tags", () => {
    const template = `<g><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/> </g>`;
    expect(renderToString(template)).toBe(
      `<g xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"></circle> </g>`
    );
  });

  test("namespace to g tags not added if already in svg namespace", () => {
    const template = `<svg><g/></svg>`;
    expect(renderToString(template)).toBe(`<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg>`);
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

    expect(renderToString(template, { path: false })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg"></svg>`
    );
    // Because the path is its own block, it has its own xmlns attribute
    expect(renderToString(template, { path: true })).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg"><path xmlns="http://www.w3.org/2000/svg"></path></svg>`
    );

    const bdom = renderToBdom(template, { path: true });
    const fixture = makeTestFixture();

    mount(bdom, fixture);
    const elems = fixture.querySelectorAll("svg, path");
    expect(elems.length).toEqual(2);
    for (const el of elems) {
      expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    }
  });

  test("svg namespace added to sub templates if root tag is path", async () => {
    const templates = `<t>
      <t t-name="svg"><svg><t t-call="path" /></svg></t>
      <t t-name="path"><path /></t>
    </t>
    `;
    const fixture = makeTestFixture();

    class Svg extends Component {
      static template = "svg";
    }

    await mountComponent(Svg, fixture, { templates });
    const elems = fixture.querySelectorAll("svg, path");
    expect(elems.length).toEqual(2);
    for (const el of elems) {
      expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    }
  });

  test("svg creates new block if it is within html", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <svg>
            <polygon fill="#000000" points="0 0 4 4 8 0" transform="translate(5 7)"/>
          </svg>
        </div>
      `;
    }
    const fixture = makeTestFixture();
    await mountComponent(Test, fixture);
    const elems = fixture.querySelectorAll("svg, polygon");
    expect(elems.length).toEqual(2);
    for (const el of elems) {
      expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    }
  });

  test("svg creates new block if it is within html -- 2", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <svg>
            <polygon fill="#000000" points="0 0 4 4 8 0" transform="translate(5 7)"/>
            <path t-if="hasPath" />
          </svg>
        </div>
      `;
      hasPath = true;
    }
    const fixture = makeTestFixture();
    await mountComponent(Test, fixture);
    const elems = fixture.querySelectorAll("svg, polygon, path");
    expect(elems.length).toEqual(3);
    for (const el of elems) {
      expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
    }
  });
});
