import { TemplateSet } from "../../src/core";
import { renderToBdom, snapshotTemplateCode } from "../helpers";

// -----------------------------------------------------------------------------
// t-ref
// -----------------------------------------------------------------------------

describe("t-ref", () => {
  test("can get a ref on a node", () => {
    const template = `<div><span t-ref="myspan"/></div>`;
    snapshotTemplateCode(template);
    const bdom = renderToBdom(template);
    expect(bdom.refs).toEqual({});
    bdom.mount(document.createElement("div"));
    expect(bdom.refs!.myspan.tagName).toBe("SPAN");
  });

  test("can get a dynamic ref on a node", () => {
    const template = `<div><span t-ref="myspan{{id}}"/></div>`;
    snapshotTemplateCode(template);
    const bdom = renderToBdom(template, { id: 3 });
    expect(bdom.refs).toEqual({});
    bdom.mount(document.createElement("div"));
    expect(bdom.refs!.myspan3.tagName).toBe("SPAN");
  });

  test("refs in a loop", () => {
    const template = `<div>
        <t t-foreach="items" t-as="item">
          <div t-ref="{{item}}" t-key="item"><t t-esc="item"/></div>
        </t>
      </div>`;
    snapshotTemplateCode(template);
    const bdom = renderToBdom(template, { items: [1, 2, 3] });
    expect(bdom.refs).toEqual({});
    bdom.mount(document.createElement("div"));
    expect(Object.keys(bdom.refs!)).toEqual(["1", "2", "3"]);
  });

  test("ref in a t-if", () => {
    const template = `
      <div>
        <t t-if="condition">
          <span t-ref="name"/>
        </t>
      </div>`;
    snapshotTemplateCode(template);

    // false
    const bdom = renderToBdom(template, { condition: false });
    expect(bdom.refs).toEqual({});
    bdom.mount(document.createElement("div"));
    expect(bdom.refs).toEqual({});

    // true now
    const bdom2 = renderToBdom(template, { condition: true });
    bdom.patch(bdom2);
    expect(bdom.refs!.name.tagName).toBe("SPAN");

    // false again
    const bdom3 = renderToBdom(template, { condition: false });
    bdom.patch(bdom3);
    expect(bdom.refs).toEqual({});
  });

  test("two refs, one in a t-if", () => {
    const template = `
      <div>
        <t t-if="condition">
          <span t-ref="name"/>
        </t>
        <p t-ref="p"/>
      </div>`;
    snapshotTemplateCode(template);

    // false
    const bdom = renderToBdom(template, { condition: false });
    expect(Object.keys(bdom.refs!)).toEqual([]);
    bdom.mount(document.createElement("div"));
    expect(Object.keys(bdom.refs!)).toEqual(["p"]);

    // true now
    const bdom2 = renderToBdom(template, { condition: true });
    bdom.patch(bdom2);
    expect(Object.keys(bdom.refs!)).toEqual(["p", "name"]);

    // false again
    const bdom3 = renderToBdom(template, { condition: false });
    bdom.patch(bdom3);
    expect(Object.keys(bdom.refs!)).toEqual(["p"]);
  });

  test("ref in a t-call", () => {
    const main = `<div><t t-call="sub"/></div>`;
    const sub = `<div>1<span t-ref="name"/>2</div>`;
    snapshotTemplateCode(main);
    snapshotTemplateCode(sub);

    const templateSet = new TemplateSet();
    templateSet.add("main", main);
    templateSet.add("sub", sub);

    const bdom = templateSet.getFunction("main")({});
    bdom.mount(document.createElement("div"));

    expect(bdom.refs!.name.tagName).toBe("SPAN");
  });
});
