import { effect } from "../src";
import { Registry } from "../src/runtime/registry";
import { nextMicroTick } from "./helpers";

async function waitScheduler() {
  await nextMicroTick();
  await nextMicroTick();
}

describe("registry", () => {
  test("can set and get values", () => {
    const registry = new Registry();

    registry.add("key", "some value");
    expect(registry.get("key")).toBe("some value");
  });

  test("can check if it has a key/value set", () => {
    const registry = new Registry();

    expect(registry.has("key")).toBe(false);
    expect(registry.has("otherkey")).toBe(false);
    registry.add("key", "some value");
    expect(registry.has("key")).toBe(true);
    expect(registry.has("otherkey")).toBe(false);
  });

  test("can set and remove values", () => {
    const registry = new Registry();

    registry.add("key", "some value");
    expect(registry.get("key")).toBe("some value");
    registry.remove("key");
  });

  test("set method returns the registry, so it is chainable", () => {
    const registry = new Registry();

    registry.add("key", "some value").add("other", "value");
    expect(registry.get("key")).toBe("some value");
    expect(registry.get("other")).toBe("value");
  });

  test("can add element from id and get values", () => {
    const registry = new Registry();
    const obj = { id: "key", value: 3 };
    registry.addById(obj);
    expect(registry.get("key")).toBe(obj);
  });

  test("get default values", () => {
    const registry = new Registry();

    expect(registry.get("key", 1)).toBe(1);
    registry.add("key", "some value");
    expect(registry.get("key", 1)).toBe("some value");
  });

  test("items", async () => {
    const registry = new Registry();

    registry.add("key", "some value");
    const items = registry.items;
    expect(items()).toEqual(["some value"]);
    registry.add("other_key", "other value");
    expect(items()).toEqual(["some value", "other value"]);
    expect(registry.get("key")).toBe("some value");
  });

  test("items and effects", async () => {
    const registry: Registry<string> = new Registry();

    registry.add("key", "a");
    const items = registry.items;
    const steps: string[] = [];

    effect(() => {
      steps.push(...items());
    });
    expect(steps).toEqual(["a"]);
    registry.add("b", "b");
    expect(steps).toEqual(["a"]);
    await waitScheduler();
    expect(steps).toEqual(["a", "a", "b"]);
  });

  test("sequence", async () => {
    const registry = new Registry();

    registry.add("a", "a", 10);
    registry.add("b", "b");
    registry.add("c", "c", 14);
    registry.add("d", "d", 100);

    const items = registry.items;
    expect(items()).toEqual(["a", "c", "b", "d"]);
  });

  test("validation schema", async () => {
    const registry = new Registry("test", {
      type: Object,
      shape: {
        blip: String,
      },
    });

    registry.add("a", { blip: "asdf" });
    expect(() => {
      registry.add("a", { blip: 1 });
    }).toThrow();
  });

  test("validation schema, with a class", async () => {
    class A {}
    class B {}

    const registry = new Registry("test", { type: A });

    registry.add("a", new A());
    expect(() => {
      registry.add("a", new B());
    }).toThrow();
  });
});
