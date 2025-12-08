import { Resource } from "../src/runtime/resource";

test("can add and get values", () => {
  const resource = new Resource();
  expect(resource.items()).toEqual([]);
  resource.add("value");
  expect(resource.items()).toEqual(["value"]);
});

test("can add multiple values (chainable)", () => {
  const resource = new Resource();
  expect(resource.items()).toEqual([]);
  resource.add("value").add("other");
  expect(resource.items()).toEqual(["value", "other"]);
});
