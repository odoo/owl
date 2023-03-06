import { TemplateSet } from "../../src/runtime/template_set";
import { mount } from "../../src/runtime/blockdom";
import { renderToBdom, snapshotEverything } from "../helpers";

function mockNode() {
  return {
    refs: {} as { [key: string]: HTMLElement | null },
    setRef(name: string, value: HTMLElement | null) {
      if (value) {
        this.refs[name] = value;
      }
    },
  };
}

snapshotEverything();

// -----------------------------------------------------------------------------
// t-ref
// -----------------------------------------------------------------------------

describe("t-ref", () => {
  test("can get a ref on a node", () => {
    const template = `<div><span t-ref="myspan"/></div>`;
    const node = mockNode();
    const bdom = renderToBdom(template, { __owl__: node });
    expect(node.refs).toEqual({});
    mount(bdom, document.createElement("div"));
    expect(node.refs.myspan!.tagName).toBe("SPAN");
  });

  test("can get a dynamic ref on a node", () => {
    const template = `<div><span t-ref="myspan{{id}}"/></div>`;
    const node = mockNode();
    const bdom = renderToBdom(template, { id: 3, __owl__: node });
    expect(node.refs).toEqual({});
    mount(bdom, document.createElement("div"));
    expect(node.refs.myspan3!.tagName).toBe("SPAN");
  });

  test("can get a dynamic ref on a node, alternate syntax", () => {
    const template = `<div><span t-ref="myspan#{id}"/></div>`;
    const node = mockNode();
    const bdom = renderToBdom(template, { id: 3, __owl__: node });
    expect(node.refs).toEqual({});
    mount(bdom, document.createElement("div"));
    expect(node.refs.myspan3!.tagName).toBe("SPAN");
  });

  test("refs in a loop", () => {
    const template = `<div>
        <t t-foreach="items" t-as="item" t-key="item">
          <div t-ref="{{item}}" t-key="item"><t t-esc="item"/></div>
        </t>
      </div>`;
    const node = mockNode();
    const bdom = renderToBdom(template, { items: [1, 2, 3], __owl__: node });
    expect(node.refs).toEqual({});
    mount(bdom, document.createElement("div"));
    expect(Object.keys(node.refs)).toEqual(["1", "2", "3"]);
  });

  test("ref in a t-if", () => {
    const template = `
      <div>
        <t t-if="condition">
          <span t-ref="name"/>
        </t>
      </div>`;

    const node = mockNode();
    // false
    const bdom = renderToBdom(template, { condition: false, __owl__: node });
    expect(node.refs).toEqual({});
    mount(bdom, document.createElement("div"));
    expect(node.refs).toEqual({});

    // true now
    const bdom2 = renderToBdom(template, { condition: true, __owl__: node });
    bdom.patch(bdom2, true);
    expect(node.refs.name!.tagName).toBe("SPAN");

    // false again
    const bdom3 = renderToBdom(template, { condition: false, __owl__: node });
    bdom.patch(bdom3, true);
    const span = node.refs.name;
    expect(span!.ownerDocument.contains(span)).toBe(false);
  });

  test("two refs, one in a t-if", () => {
    const template = `
      <div>
        <t t-if="condition">
          <span t-ref="name"/>
        </t>
        <p t-ref="p"/>
      </div>`;

    const node = mockNode();

    // false
    const bdom = renderToBdom(template, { condition: false, __owl__: node });
    expect(Object.keys(node.refs)).toEqual([]);
    mount(bdom, document.createElement("div"));
    expect(Object.keys(node.refs)).toEqual(["p"]);

    // true now
    const bdom2 = renderToBdom(template, { condition: true, __owl__: node });
    bdom.patch(bdom2, true);
    expect(Object.keys(node.refs)).toEqual(["p", "name"]);

    // false again
    const bdom3 = renderToBdom(template, { condition: false, __owl__: node });
    bdom.patch(bdom3, true);
    expect(Object.keys(node.refs)).toEqual(["p", "name"]);
    const span = node.refs.name;
    expect(span!.ownerDocument.contains(span)).toBe(false);
  });

  test("ref in a t-call", () => {
    const main = `<div><t t-call="sub"/></div>`;
    const sub = `<div>1<span t-ref="name"/>2</div>`;

    const node = mockNode();

    const app = new TemplateSet();
    app.addTemplate("main", main);
    app.addTemplate("sub", sub);

    const comp = { __owl__: node };
    const bdom = app.getTemplate("main").call(comp, comp, {});
    mount(bdom, document.createElement("div"));

    expect(node.refs.name!.tagName).toBe("SPAN");
  });
});
