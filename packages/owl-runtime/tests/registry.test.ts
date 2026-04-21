import { App, effect, Plugin, Registry, types as t } from "../src";
import { PluginManager } from "../src/plugin_manager";
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
    registry.delete("key");
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

  test("add throws when the key is already registered", () => {
    const registry = new Registry({ name: "views" });

    registry.add("list", "A");
    expect(() => registry.add("list", "B")).toThrow(
      `Key "list" is already registered (registry 'views'). Use { force: true } to overwrite.`
    );
    expect(registry.get("list")).toBe("A");
  });

  test("add with { force: true } overwrites an existing key", () => {
    const registry = new Registry();

    registry.add("list", "A");
    registry.add("list", "B", { force: true });
    expect(registry.get("list")).toBe("B");
  });

  test("addById throws when the id is already registered", () => {
    const registry = new Registry();

    registry.addById({ id: "x", value: 1 });
    expect(() => registry.addById({ id: "x", value: 2 })).toThrow(`Key "x" is already registered`);
  });

  test("addById with { force: true } overwrites an existing id", () => {
    const registry = new Registry<{ id: string; value: number }>();

    const first = { id: "x", value: 1 };
    const second = { id: "x", value: 2 };
    registry.addById(first);
    registry.addById(second, { force: true });
    expect(registry.get("x")).toBe(second);
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

    registry.add("a", "a", { sequence: 10 });
    registry.add("b", "b");
    registry.add("c", "c", { sequence: 14 });
    registry.add("d", "d", { sequence: 100 });

    const items = registry.items;
    expect(items()).toEqual(["a", "c", "b", "d"]);
  });

  test("validation schema", async () => {
    const registry = new Registry({
      name: "test",
      validation: t.object({
        blip: t.string(),
      }),
    });

    registry.add("a", { blip: "asdf" });
    expect(() => {
      registry.add("b", { blip: 1 } as any);
    }).toThrow("Registry entry does not match the type");
  });

  test("validation schema, with a class", async () => {
    class A {}
    class B {}

    const registry = new Registry({
      name: "test",
      validation: t.instanceOf(A),
    });

    registry.add("a", new A());
    expect(() => {
      registry.add("b", new B());
    }).toThrow("Registry entry does not match the type");
  });

  describe("use()", () => {
    test("throws when called outside a component/plugin context", () => {
      const registry = new Registry<string>();
      expect(() => registry.use("key", "value")).toThrow("No active scope");
    });

    test("does not mutate when called outside a context", () => {
      const registry = new Registry<string>();
      expect(() => registry.use("key", "value")).toThrow();
      expect(registry.has("key")).toBe(false);
      expect(registry.items()).toEqual([]);
    });

    test("adds within plugin setup and removes on plugin destroy", () => {
      const shared = new Registry<string>();

      class A extends Plugin {
        setup() {
          shared.use("k", "v");
        }
      }

      const manager = new PluginManager(new App());
      manager.startPlugins([A]);
      expect(shared.get("k")).toBe("v");

      manager.destroy();
      expect(shared.has("k")).toBe(false);
    });

    test("throws when the key is already registered", () => {
      const shared = new Registry<string>({ name: "shared" });
      shared.add("k", "permanent");

      class A extends Plugin {
        setup() {
          shared.use("k", "from-A");
        }
      }

      const manager = new PluginManager(new App());
      expect(() => manager.startPlugins([A])).toThrow(
        `Key "k" is already registered (registry 'shared'). Use { force: true } to overwrite.`
      );
      // value untouched
      expect(shared.get("k")).toBe("permanent");
    });

    test("with { force: true } overwrites an existing key", () => {
      const shared = new Registry<string>();
      shared.add("k", "permanent");

      class A extends Plugin {
        setup() {
          shared.use("k", "from-A", { force: true });
        }
      }

      const manager = new PluginManager(new App());
      manager.startPlugins([A]);
      expect(shared.get("k")).toBe("from-A");

      // On destroy the key is removed entirely (no restore of the previous value).
      manager.destroy();
      expect(shared.has("k")).toBe(false);
    });

    test("useById with { force: true } overwrites an existing id", () => {
      const shared = new Registry<{ id: string; v: number }>();
      shared.addById({ id: "x", v: 1 });

      class A extends Plugin {
        setup() {
          shared.useById({ id: "x", v: 2 }, { force: true });
        }
      }

      const manager = new PluginManager(new App());
      manager.startPlugins([A]);
      expect(shared.get("x").v).toBe(2);

      manager.destroy();
      expect(shared.has("x")).toBe(false);
    });

    test("is chainable", () => {
      const shared = new Registry<string>();

      class A extends Plugin {
        setup() {
          shared.use("a", "1").use("b", "2");
        }
      }

      const manager = new PluginManager(new App());
      manager.startPlugins([A]);
      expect(shared.items()).toEqual(["1", "2"]);
    });

    test("respects sequence option", () => {
      const shared = new Registry<string>();

      class A extends Plugin {
        setup() {
          shared.use("a", "a", { sequence: 100 });
          shared.use("b", "b", { sequence: 10 });
          shared.use("c", "c");
        }
      }

      const manager = new PluginManager(new App());
      manager.startPlugins([A]);
      expect(shared.items()).toEqual(["b", "c", "a"]);
    });

    test("overwriting owner (with force) keeps the key after first owner is destroyed", () => {
      // Guard semantics: when B overwrites A's key via { force: true },
      // A's destroy must NOT delete B's entry.
      const shared = new Registry<string>();

      class A extends Plugin {
        setup() {
          shared.use("k", "from-A");
        }
      }
      class B extends Plugin {
        setup() {
          shared.use("k", "from-B", { force: true });
        }
      }

      const app = new App();
      const mA = new PluginManager(app);
      mA.startPlugins([A]);
      expect(shared.get("k")).toBe("from-A");

      const mB = new PluginManager(app);
      mB.startPlugins([B]);
      expect(shared.get("k")).toBe("from-B");

      mA.destroy();
      // A's cleanup sees k === "from-B" (not its own value) and leaves it alone.
      expect(shared.get("k")).toBe("from-B");

      mB.destroy();
      expect(shared.has("k")).toBe(false);
    });

    test("useById() adds and removes", () => {
      const shared = new Registry<{ id: string; value: number }>();

      class A extends Plugin {
        setup() {
          shared.useById({ id: "x", value: 42 });
        }
      }

      const manager = new PluginManager(new App());
      manager.startPlugins([A]);
      expect(shared.get("x")).toEqual({ id: "x", value: 42 });

      manager.destroy();
      expect(shared.has("x")).toBe(false);
    });

    test("useById() throws when item has no id", () => {
      const registry = new Registry<{ id: string }>({ name: "reg" });

      class A extends Plugin {
        setup() {
          registry.useById({ id: "" });
        }
      }

      const manager = new PluginManager(new App());
      expect(() => manager.startPlugins([A])).toThrow("Item should have an id key");
    });
  });
});
