import { App, effect, Plugin, Resource, types as t } from "../src";
import { PluginManager } from "../src/plugin_manager";
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
      blip: t.string(),
    }),
  });

  resource.add({ blip: "asdf" });
  expect(() => {
    resource.add({ blip: 1 } as any);
  }).toThrow("Resource item does not match the type");
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
  }).toThrow("Resource item does not match the type");
});

describe("use()", () => {
  test("throws when called outside a component/plugin context", () => {
    const resource = new Resource<string>();
    expect(() => resource.use("red")).toThrow("No active scope");
  });

  test("does not mutate when called outside a context", () => {
    const resource = new Resource<string>();
    expect(() => resource.use("red")).toThrow();
    expect(resource.has("red")).toBe(false);
    expect(resource.items()).toEqual([]);
  });

  test("adds within plugin setup and removes on plugin destroy", () => {
    const shared = new Resource<string>();

    class A extends Plugin {
      setup() {
        shared.use("red");
      }
    }

    const manager = new PluginManager(new App());
    manager.startPlugins([A]);
    expect(shared.items()).toEqual(["red"]);

    manager.destroy();
    expect(shared.items()).toEqual([]);
  });

  test("is chainable", () => {
    const shared = new Resource<string>();

    class A extends Plugin {
      setup() {
        shared.use("a").use("b").use("c");
      }
    }

    const manager = new PluginManager(new App());
    manager.startPlugins([A]);
    expect(shared.items()).toEqual(["a", "b", "c"]);

    manager.destroy();
    expect(shared.items()).toEqual([]);
  });

  test("respects sequence option", () => {
    const shared = new Resource<string>();

    class A extends Plugin {
      setup() {
        shared.use("a", { sequence: 100 });
        shared.use("b", { sequence: 10 });
        shared.use("c");
      }
    }

    const manager = new PluginManager(new App());
    manager.startPlugins([A]);
    expect(shared.items()).toEqual(["b", "c", "a"]);
  });

  test("only items from destroyed scope are removed", () => {
    const shared = new Resource<string>();

    class A extends Plugin {
      setup() {
        shared.use("a");
      }
    }
    class B extends Plugin {
      setup() {
        shared.use("b");
      }
    }

    const app = new App();
    const parent = new PluginManager(app);
    parent.startPlugins([A]);

    const child = new PluginManager(app, { parent });
    child.startPlugins([B]);
    expect(shared.items()).toEqual(["a", "b"]);

    child.destroy();
    expect(shared.items()).toEqual(["a"]);

    parent.destroy();
    expect(shared.items()).toEqual([]);
  });
});
