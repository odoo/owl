import { Component, t, types, validateType } from "../src";

class A {}

test("t is an alias of the runtime types namespace", () => {
  expect(t).toBe(types);
  // the runtime namespace extends the core one: the alias must carry it too
  expect(typeof t.component).toBe("function");
});

test("t.component()", () => {
  class MyComponent extends Component {}
  const issue = { message: "value is not 'Component' or an extension" };
  expect(validateType(Component, t.component())).toEqual([]);
  expect(validateType(MyComponent, t.component())).toEqual([]);
  expect(validateType(true, t.component())).toMatchObject([issue]);
  expect(validateType("abc", t.component())).toMatchObject([issue]);
  expect(validateType(A, t.component())).toMatchObject([issue]);
  expect(validateType(new MyComponent(null as any), t.component())).toMatchObject([issue]);
});
