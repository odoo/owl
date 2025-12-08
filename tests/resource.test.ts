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


test("can remove values", () => {
  const resource = new Resource();
  resource.add("a").add("b").add("c").add("d");
  expect(resource.items()).toEqual(["a", "b", "c", "d"]);
  resource.remove("b");
  expect(resource.items()).toEqual(["a", "c", "d"]);
  resource.remove("a").remove("d");
  expect(resource.items()).toEqual(["c"]);
});
