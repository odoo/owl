import { TemplateSet } from "../../src/runtime/template_set";
import { mount } from "../../src/runtime/blockdom";
import { renderToBdom, snapshotEverything } from "../helpers";
import { derived, signal } from "../../src";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-ref
// -----------------------------------------------------------------------------

describe("t-ref", () => {
  test("can get a ref on a node", () => {
    const template = `<div><span t-ref="myspan"/></div>`;
    const myspan = signal<HTMLElement | null>(null);
    const bdom = renderToBdom(template, { myspan });
    expect(myspan()).toEqual(null);
    mount(bdom, document.createElement("div"));
    expect(myspan()!.tagName).toBe("SPAN");
  });

  test("refs in a loop", () => {
    const template = `<div>
        <t t-foreach="items" t-as="item" t-key="item.id">
          <div t-ref="item.ref" t-key="item.id"><t t-out="item.id"/></div>
        </t>
      </div>`;
    const items = [
      { id: 1, ref: signal<any>(null) },
      { id: 2, ref: signal<any>(null) },
      { id: 3, ref: signal<any>(null) },
    ];
    const refs = derived(() => items.map((item) => item.ref()));
    const bdom = renderToBdom(template, { items });
    expect(refs()).toEqual([null, null, null]);
    mount(bdom, document.createElement("div"));
    expect(refs()).toEqual([expect.anything(), expect.anything(), expect.anything()]);
  });

  test("ref in a t-if", () => {
    const template = `
      <div>
        <t t-if="condition">
          <span t-ref="name"/>
        </t>
      </div>`;

    const name = signal<any>(null);

    // false
    const bdom = renderToBdom(template, { condition: false, name });
    expect(name()).toBe(null);
    mount(bdom, document.createElement("div"));
    expect(name()).toBe(null);

    // true now
    const bdom2 = renderToBdom(template, { condition: true, name });
    bdom.patch(bdom2, true);
    expect(name().tagName).toBe("SPAN");

    // false again
    const bdom3 = renderToBdom(template, { condition: false, name });
    bdom.patch(bdom3, true);
    expect(name()).toBe(null);
  });

  test("two refs, one in a t-if", () => {
    const template = `
      <div>
        <t t-if="condition">
          <span t-ref="refs.name"/>
        </t>
        <p t-ref="refs.p"/>
      </div>`;

    const refs = {
      name: signal<any>(null),
      p: signal<any>(null),
    };
    const refValues = derived(() => [refs.name(), refs.p()]);

    // false
    const bdom = renderToBdom(template, { condition: false, refs });
    expect(refValues()).toEqual([null, null]);
    mount(bdom, document.createElement("div"));
    expect(refValues()).toEqual([null, expect.anything()]);

    // true now
    const bdom2 = renderToBdom(template, { condition: true, refs });
    bdom.patch(bdom2, true);
    expect(refValues()).toEqual([expect.anything(), expect.anything()]);

    // false again
    const bdom3 = renderToBdom(template, { condition: false, refs });
    bdom.patch(bdom3, true);
    expect(refValues()).toEqual([null, expect.anything()]);
  });

  test("ref in a t-call", () => {
    const main = `<div><t t-call="sub"/></div>`;
    const sub = `<div>1<span t-ref="name"/>2</div>`;

    const app = new TemplateSet();
    app.addTemplate("main", main);
    app.addTemplate("sub", sub);

    const name = signal<any>(null);
    const bdom = app.getTemplate("main").call(null, { name }, {});
    mount(bdom, document.createElement("div"));

    expect(name().tagName).toBe("SPAN");
  });
});
