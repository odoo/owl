import { xml } from "../../src";
import { mount, patch } from "../../src/blockdom";
import { makeTestFixture, renderToBdom, renderToString, snapshotEverything } from "../helpers";

snapshotEverything();
// -----------------------------------------------------------------------------
// attributes
// -----------------------------------------------------------------------------

describe("attributes", () => {
  test("static attributes", () => {
    const template = `<div foo="a" bar="b" baz="c"/>`;
    expect(renderToString(template)).toBe(`<div foo="a" bar="b" baz="c"></div>`);
  });

  test("two classes", () => {
    const template = `<div class="a b"/>`;
    expect(renderToString(template)).toBe(`<div class="a b"></div>`);
  });

  test("static attributes with dashes", () => {
    const template = `<div aria-label="Close"/>`;
    expect(renderToString(template)).toBe(`<div aria-label="Close"></div>`);
  });

  test("static attributes on void elements", () => {
    const template = `<img src="/test.skip.jpg" alt="Test"/>`;
    expect(renderToString(template)).toBe(`<img src="/test.skip.jpg" alt="Test">`);
  });

  test("dynamic attributes", () => {
    const template = `<div t-att-foo="'bar'"/>`;
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("two dynamic attributes", () => {
    const template = `<div t-att-foo="'bar'" t-att-bar="'foo'"/>`;
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar" bar="foo"></div>`);
  });

  test("dynamic class attribute", () => {
    const template = `<div t-att-class="c"/>`;
    const result = renderToString(template, { c: "abc" });
    expect(result).toBe(`<div class="abc"></div>`);
  });

  test("dynamic empty class attribute", () => {
    const template = `<div t-att-class="c"/>`;
    const result = renderToString(template, { c: "" });
    expect(result).toBe(`<div></div>`);
  });

  test("dynamic attribute with a dash", () => {
    const template = `<div t-att-data-action-id="id"/>`;
    const result = renderToString(template, { id: 32 });
    expect(result).toBe(`<div data-action-id="32"></div>`);
  });

  test("dynamic formatted attributes with a dash", () => {
    const template = `<div t-attf-aria-label="Some text {{id}}"/>`;
    const result = renderToString(template, { id: 32 });
    expect(result).toBe(`<div aria-label="Some text 32"></div>`);
  });

  test("fixed variable", () => {
    const template = `<div t-att-foo="value"/>`;
    const result = renderToString(template, { value: "ok" });
    expect(result).toBe(`<div foo="ok"></div>`);
  });

  test("dynamic attribute evaluating to 0", () => {
    const template = `<div t-att-foo="value"/>`;
    const result = renderToString(template, { value: 0 });
    expect(result).toBe(`<div foo="0"></div>`);
  });

  test("dynamic class attribute evaluating to 0", () => {
    const template = `<div t-att-class="value"/>`;
    const result = renderToString(template, { value: 0 });
    expect(result).toBe(`<div class="0"></div>`);
  });

  test("dynamic attribute falsy variable ", () => {
    const template = `<div t-att-foo="value"/>`;
    const result = renderToString(template, { value: false });
    expect(result).toBe(`<div></div>`);
  });

  test("tuple literal", () => {
    const template = `<div t-att="['foo', 'bar']"/>`;
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("tuple variable", () => {
    const template = `<div t-att="value"/>`;
    const result = renderToString(template, { value: ["foo", "bar"] });
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("object", () => {
    const template = `<div t-att="value"/>`;
    const result = renderToString(template, {
      value: { a: 1, b: 2, c: 3 },
    });
    expect(result).toBe(`<div a="1" b="2" c="3"></div>`);
  });

  test("format literal", () => {
    const template = `<div t-attf-foo="bar"/>`;
    const result = renderToString(template);
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("format value", () => {
    const template = `<div t-attf-foo="b{{value}}r"/>`;
    const result = renderToString(template, { value: "a" });
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("t-attf-class", () => {
    const template = `<div t-attf-class="hello"/>`;
    const result = renderToString(template);
    expect(result).toBe(`<div class="hello"></div>`);
  });

  test("t-attf-class with multiple classes", () => {
    const template = `<div t-attf-class="hello {{word}}"/>`;
    const result = renderToString(template, { word: "world" });
    expect(result).toBe(`<div class="hello world"></div>`);
  });

  test("t-attf-class with multiple classes separated by multiple spaces", () => {
    const template = `<div t-attf-class="hello  {{word}}"/>`;
    const result = renderToString(template, { word: "world" });
    expect(result).toBe(`<div class="hello world"></div>`);
  });

  test("t-attf-class should combine with class", () => {
    const template = `<div class="hello" t-attf-class="world"/>`;
    const result = renderToString(template);
    expect(result).toBe(`<div class="hello world"></div>`);
  });

  test("from variables set previously", () => {
    const template = `<div><t t-set="abc" t-value="'def'"/><span t-att-class="abc"/></div>`;
    const result = renderToString(template);
    expect(result).toBe('<div><span class="def"></span></div>');
  });

  test("from variables set previously (no external node)", () => {
    const template = `
      <t t-set="abc" t-value="'def'"/>
      <span t-att-class="abc"/>`;
    const result = renderToString(template);
    expect(result).toBe('<span class="def"></span>');
  });

  test("from object variables set previously", () => {
    // Note: standard qweb does not allow this...
    const template = `
      <div>
        <t t-set="o" t-value="{a:'b'}"/>
        <span t-att-class="o.a"/>
      </div>`;
    const result = renderToString(template);
    expect(result).toBe('<div><span class="b"></span></div>');
  });

  test("format expression", () => {
    const template = `<div t-attf-foo="{{value + 37}}"/>`;
    const result = renderToString(template, { value: 5 });
    expect(result).toBe(`<div foo="42"></div>`);
  });

  test("format multiple", () => {
    const template = `<div t-attf-foo="a {{value1}} is {{value2}} of {{value3}} ]"/>`;
    const result = renderToString(template, {
      value1: 0,
      value2: 1,
      value3: 2,
    });
    expect(result).toBe(`<div foo="a 0 is 1 of 2 ]"></div>`);
  });

  test("various escapes", () => {
    // not needed??
    const template = `
      <div foo="&lt;foo"
        t-att-bar="bar"
        t-attf-baz="&lt;{{baz}}&gt;"
        t-att="qux"/>`;

    const result = renderToString(template, {
      bar: 0,
      baz: 1,
      qux: { qux: "<>" },
    });
    const expected = '<div foo="<foo" bar="0" baz="<1>" qux="<>"></div>';
    expect(result).toBe(expected);
  });

  test("t-att-class and class should combine together", () => {
    const template = `<div class="hello" t-att-class="value"/>`;
    const result = renderToString(template, { value: "world" });
    expect(result).toBe(`<div class="hello world"></div>`);
  });

  test("class and t-att-class should combine together", () => {
    const template = `<div t-att-class="value" class="hello" />`;
    const result = renderToString(template, { value: "world" });
    expect(result).toBe(`<div class="hello world"></div>`);
  });

  test("class and t-attf-class with ternary operation", () => {
    const template = `<div class="hello" t-attf-class="{{value ? 'world' : ''}}"/>`;
    const result = renderToString(template, { value: true });
    expect(result).toBe(`<div class="hello world"></div>`);
  });

  test("t-att-class with object", () => {
    const template = `<div class="static" t-att-class="{a: b, c: d, e: f}"/>`;
    const result = renderToString(template, { b: true, d: false, f: true });
    expect(result).toBe(`<div class="static a e"></div>`);
  });

  test("t-att-class with multiple classes", () => {
    expect(renderToString(`<div t-att-class="{'a b c': value}" />`, { value: true })).toBe(
      '<div class="a b c"></div>'
    );
    expect(renderToString(`<div t-att-class="{['a b c']: value}" />`, { value: true })).toBe(
      '<div class="a b c"></div>'
    );
  });

  test("changing an attribute with t-att-", () => {
    // render input with initial value
    const template = `<div t-att-value="v"/>`;
    const bnode1 = renderToBdom(template, { v: "zucchini" });
    const fixture = makeTestFixture();
    mount(bnode1, fixture);

    expect(fixture.innerHTML).toBe('<div value="zucchini"></div>');

    const bnode2 = renderToBdom(template, { v: "potato" });
    patch(bnode1, bnode2);
    expect(fixture.innerHTML).toBe('<div value="potato"></div>');

    const bnode3 = renderToBdom(template, { v: "" });
    patch(bnode1, bnode3);
    // not sure about this. maybe we want to remove the attribute?
    expect(fixture.innerHTML).toBe('<div value=""></div>');
  });

  test("changing a class with t-att-class", () => {
    // render input with initial value
    const template = `<div t-att-class="v"/>`;
    const bnode1 = renderToBdom(template, { v: "zucchini" });
    const fixture = makeTestFixture();
    mount(bnode1, fixture);

    expect(fixture.innerHTML).toBe('<div class="zucchini"></div>');

    const bnode2 = renderToBdom(template, { v: "potato" });
    patch(bnode1, bnode2);
    expect(fixture.innerHTML).toBe('<div class="potato"></div>');

    const bnode3 = renderToBdom(template, { v: "" });
    patch(bnode1, bnode3);
    // not sure about this. maybe we want to remove the attribute?
    expect(fixture.innerHTML).toBe('<div class=""></div>');
  });

  test("changing a class with t-att-class (preexisting class", () => {
    // render input with initial value
    const template = `<div class="hoy" t-att-class="v"/>`;
    const bnode1 = renderToBdom(template, { v: "zucchini" });
    const fixture = makeTestFixture();
    mount(bnode1, fixture);

    expect(fixture.innerHTML).toBe('<div class="hoy zucchini"></div>');

    const bnode2 = renderToBdom(template, { v: "potato" });
    patch(bnode1, bnode2);
    expect(fixture.innerHTML).toBe('<div class="hoy potato"></div>');

    const bnode3 = renderToBdom(template, { v: "" });
    patch(bnode1, bnode3);
    // not sure about this. maybe we want to remove the attribute?
    expect(fixture.innerHTML).toBe('<div class="hoy"></div>');
  });

  test("updating classes (with obj notation)", () => {
    // render input with initial value
    const template = `<div class="hoy" t-att-class="{'a b': condition}"/>`;
    const bnode1 = renderToBdom(template, { condition: true });
    const fixture = makeTestFixture();
    mount(bnode1, fixture);

    expect(fixture.innerHTML).toBe('<div class="hoy a b"></div>');

    const bnode2 = renderToBdom(template, { condition: false });
    patch(bnode1, bnode2);
    expect(fixture.innerHTML).toBe('<div class="hoy"></div>');

    const bnode3 = renderToBdom(template, { condition: true });
    patch(bnode1, bnode3);
    // not sure about this. maybe we want to remove the attribute?
    expect(fixture.innerHTML).toBe('<div class="hoy a b"></div>');
  });
});

describe("special cases for some specific html attributes/properties", () => {
  test("input type= checkbox, with t-att-checked", () => {
    const template = `<input type="checkbox" t-att-checked="flag"/>`;
    const result = renderToString(template, { flag: true });
    expect(result).toBe(`<input type="checkbox">`);
  });

  test("various boolean html attributes", () => {
    // the unique assertion here is the code snapshot automatically done by
    // renderToString
    xml`
      <div>
        <input type="checkbox" checked="checked"/>
        <input checked="checked"/>
        <div checked="checked"/>
        <div selected="selected"/>
        <option selected="selected" other="1"/>
        <input readonly="readonly"/>
        <button disabled="disabled"/>
      </div>
      `;
  });

  test("input with t-att-value", () => {
    // render input with initial value
    const template = `<input  t-att-value="v"/>`;
    const bnode1 = renderToBdom(template, { v: "zucchini" });
    const fixture = makeTestFixture();
    mount(bnode1, fixture);
    const input = fixture.querySelector("input")!;
    expect(input.value).toBe("zucchini");

    // change value manually in input, to simulate user input
    input.value = "tomato";
    expect(input.value).toBe("tomato");

    // rerender with a different value, and patch actual dom, to check that
    // input value was properly reset by owl
    const bnode2 = renderToBdom(template, { v: "potato" });
    patch(bnode1, bnode2);
    expect(input.value).toBe("potato");
  });

  test("input of type checkbox with t-att-indeterminate", () => {
    const template = `<input type="checkbox" t-att-indeterminate="v"/>`;
    const bnode1 = renderToBdom(template, { v: true });
    const fixture = makeTestFixture();
    mount(bnode1, fixture);
    const input = fixture.querySelector("input")!;
    expect(input.indeterminate).toBe(true);
  });
});
