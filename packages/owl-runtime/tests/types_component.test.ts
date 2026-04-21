import { Component, types as t, validateType } from "../src";

class A {}

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
