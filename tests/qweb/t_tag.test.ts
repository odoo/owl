import { mount, patch } from "../../src/blockdom";
import { makeTestFixture, renderToBdom, renderToString, snapshotEverything } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

describe("qweb t-tag", () => {
  test("simple usecases", () => {
    expect(renderToString(`<t t-tag="'div'"></t>`)).toBe("<div></div>");
    expect(renderToString(`<t t-tag="tag">text</t>`, { tag: "span" })).toBe("<span>text</span>");
  });

  test("with multiple child nodes", () => {
    const template = `
      <t t-tag="tag">
          pear
          <span>apple</span>
          strawberry
      </t>`;
    expect(renderToString(template, { tag: "div" })).toBe(
      "<div> pear <span>apple</span> strawberry </div>"
    );
  });

  test("with multiple attributes", () => {
    const template = `<t t-tag="tag" class="blueberry" taste="raspberry">gooseberry</t>`;
    const expected = `<div class=\"blueberry\" taste=\"raspberry\">gooseberry</div>`;
    expect(renderToString(template, { tag: "div" })).toBe(expected);
  });

  test("can fallback if falsy tag", () => {
    const template = `<fallback t-tag="tag"/>`;
    expect(renderToString(template, { tag: "div" })).toBe(`<div></div>`);
    expect(renderToString(template, { tag: "" })).toBe(`<fallback></fallback>`);
    expect(renderToString(template, { tag: undefined })).toBe(`<fallback></fallback>`);
    expect(renderToString(template, { tag: null })).toBe(`<fallback></fallback>`);
    expect(renderToString(template, { tag: false })).toBe(`<fallback></fallback>`);
  });

  test("with multiple t-tag in same template", () => {
    const template = `<t t-tag="outer"><t t-tag="inner">baz</t></t>`;
    expect(renderToString(template, { outer: "foo", inner: "bar" })).toBe(
      `<foo><bar>baz</bar></foo>`
    );
  });

  test("with multiple t-tag in same template, part 2", () => {
    const template = `<t t-tag="brother">bar</t><t t-tag="brother">baz</t>`;
    expect(renderToString(template, { brother: "foo" })).toBe(`<foo>bar</foo><foo>baz</foo>`);
  });

  test("can update", () => {
    const template = `<t t-tag="tag"></t>`;
    const bdom = renderToBdom(template, { tag: "yop" });
    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("<yop></yop>");
    patch(bdom, renderToBdom(template, { tag: "gnap" }));
    expect(fixture.innerHTML).toBe("<gnap></gnap>");
  });
});
