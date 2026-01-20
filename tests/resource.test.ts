import { effect, types as t } from "../src";
import { Resource } from "../src/runtime/resource";
import { waitScheduler } from "./helpers";

test("can add and get values", () => {
  const resource = new Resource();
  expect(resource.items()).toEqual([]);
  resource.add("value");
  expect(resource.items()).toEqual(["value"]);
});

test("can check if it contains values", () => {
  const resource = new Resource();

  expect(resource.has("value")).toBe(false);
  resource.add("value");
  expect(resource.has("value")).toBe(true);
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
  resource.delete("b");
  expect(resource.items()).toEqual(["a", "c", "d"]);
  resource.delete("a").delete("d");
  expect(resource.items()).toEqual(["c"]);
});

test("sequence", async () => {
  const resource = new Resource<string>({ name: "r" });

  resource.add("a", { sequence: 10 });
  resource.add("b"); // default = 50
  resource.add("c", { sequence: 14 });
  resource.add("d", { sequence: 100 });

  const items = resource.items;
  expect(items()).toEqual(["a", "c", "b", "d"]);
});

test("items and effects", async () => {
  const resource: Resource<string> = new Resource();

  resource.add("a");
  const items = resource.items;
  const steps: string[] = [];

  effect(() => {
    steps.push(...items());
  });
  expect(steps).toEqual(["a"]);
  resource.add("b");
  expect(steps).toEqual(["a"]);
  await waitScheduler();
  expect(steps).toEqual(["a", "a", "b"]);
});

test("validation schema", async () => {
  const resource = new Resource({
    name: "test",
    validation: t.object({
      blip: t.string,
    }),
  });

  resource.add({ blip: "asdf" });
  expect(() => {
    resource.add({ blip: 1 } as any);
  }).toThrow("Value does not match the type");
});

test("validation schema, with a class", async () => {
  class A {}
  class B {}

  const resource = new Resource({
    name: "test",
    validation: t.instanceOf(A),
  });

  resource.add(new A());
  expect(() => {
    resource.add(new B());
  }).toThrow("Value does not match the type");
});
