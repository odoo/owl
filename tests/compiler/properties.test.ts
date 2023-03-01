import { mount, patch } from "../../src/runtime/blockdom";
import { makeTestFixture, renderToBdom, renderToString, snapshotEverything } from "../helpers";

snapshotEverything();
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

test("dynamic input value: falsy values", () => {
  // 0 doesn't fall back to empty string
  expect(renderToBdom(`<input t-att-value="0"/>`)).toEqual({ data: [new String("0")] });
  expect(renderToBdom(`<input t-att-value="false"/>`)).toEqual({ data: [new String("")] });
  expect(renderToBdom(`<input t-att-value="undefined"/>`)).toEqual({ data: [new String("")] });
  expect(renderToBdom(`<input t-att-value="''"/>`)).toEqual({ data: [new String("")] });
});

test("updating property with falsy value", async () => {
  // render input with initial value
  const template = `<input t-att-value="v"></input>`;
  const bnode1 = renderToBdom(template, { v: false });
  const fixture = makeTestFixture();
  mount(bnode1, fixture);

  const input = fixture.querySelector("input")!;
  expect(input.value).toBe("");

  patch(bnode1, renderToBdom(template, { v: "owl" }));
  expect(input.value).toBe("owl");

  patch(bnode1, renderToBdom(template, { v: false }));
  expect(input.value).toBe("");

  patch(bnode1, renderToBdom(template, { v: "owl" }));
  expect(input.value).toBe("owl");

  patch(bnode1, renderToBdom(template, { v: undefined }));
  expect(input.value).toBe("");

  patch(bnode1, renderToBdom(template, { v: "owl" }));
  expect(input.value).toBe("owl");

  patch(bnode1, renderToBdom(template, { v: null }));
  expect(input.value).toBe("");
});


test("input type= checkbox, with t-att-checked", () => {
  const template = `<input type="checkbox" t-att-checked="flag"/>`;
  const result = renderToString(template, { flag: true });
  expect(result).toBe(`<input type="checkbox">`);
});

test("various boolean html attributes", () => {
  // will cause the template to be snapshotted
  renderToString(`
      <div>
        <input type="checkbox" checked="checked"/>
        <input checked="checked"/>
        <div checked="checked"/>
        <div selected="selected"/>
        <option selected="selected" other="1"/>
        <input readonly="readonly"/>
        <button disabled="disabled"/>
      </div>
      `);
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

test("input with t-att-value (patching with same value", () => {
  // render input with initial value
  const template = `<input t-att-value="v"/>`;
  const bnode1 = renderToBdom(template, { v: "zucchini" });
  const fixture = makeTestFixture();
  mount(bnode1, fixture);
  const input = fixture.querySelector("input")!;
  expect(input.value).toBe("zucchini");

  // change value manually in input, to simulate user input
  input.value = "tomato";
  expect(input.value).toBe("tomato");

  const bnode2 = renderToBdom(template, { v: "zucchini" });
  patch(bnode1, bnode2);
  expect(input.value).toBe("zucchini");
});

test("input, type checkbox, with t-att-checked (patching with same value", () => {
  // render input with initial value
  const template = `<input type="checkbox" t-att-checked="v"/>`;
  const bnode1 = renderToBdom(template, { v: true });
  const fixture = makeTestFixture();
  mount(bnode1, fixture);
  const input = fixture.querySelector("input")!;
  expect(input.checked).toBe(true);

  // change checked manually in input, to simulate user input
  input.checked = false;
  expect(input.checked).toBe(false);

  const bnode2 = renderToBdom(template, { v: true });
  patch(bnode1, bnode2);
  expect(input.checked).toBe(true);
});

test("input of type checkbox with t-att-indeterminate", () => {
  const template = `<input type="checkbox" t-att-indeterminate="v"/>`;
  const bnode1 = renderToBdom(template, { v: true });
  const fixture = makeTestFixture();
  mount(bnode1, fixture);
  const input = fixture.querySelector("input")!;
  expect(input.indeterminate).toBe(true);
});

test("textarea with t-att-value", () => {
  // render textarea with initial value
  const template = `<textarea t-att-value="v"/>`;
  const bnode1 = renderToBdom(template, { v: "zucchini" });
  const fixture = makeTestFixture();
  mount(bnode1, fixture);
  const elm = fixture.querySelector("textarea")!;
  expect(elm.value).toBe("zucchini");

  // change value manually in textarea, to simulate user textarea
  elm.value = "tomato";
  expect(elm.value).toBe("tomato");

  // rerender with a different value, and patch actual dom, to check that
  // textarea value was properly reset by owl
  const bnode2 = renderToBdom(template, { v: "potato" });
  patch(bnode1, bnode2);
  expect(elm.value).toBe("potato");
});

test("select with t-att-value", () => {
  const template = `
      <select t-att-value="value">
        <option value="potato">Potato</option>
        <option value="tomato">Tomato</option>
        <option value="onion">Onion</option>
      </select>`;
  const bnode1 = renderToBdom(template, { value: "tomato" });
  const fixture = makeTestFixture();
  mount(bnode1, fixture);
  const elm = fixture.querySelector("select")!;
  expect(elm.value).toBe("tomato");

  elm.value = "potato";
  expect(elm.value).toBe("potato");

  // rerender with a different value, and patch actual dom, to check that
  // select value was properly reset by owl
  const bnode2 = renderToBdom(template, { value: "onion" });
  patch(bnode1, bnode2);
  expect(elm.value).toBe("onion");
});
