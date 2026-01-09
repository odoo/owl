import { effect, onWillDestroy, plugin, Plugin, PluginManager, status } from "../src";
import { Resource, useResource } from "../src/runtime/resource";
import { waitScheduler } from "./helpers";

describe("basic features", () => {
  test("can instantiate and destroy a plugin", () => {
    const steps: string[] = [];

    class A extends Plugin {
      setup() {
        steps.push("setup");
        onWillDestroy(() => {
          steps.push("destroy");
        });
      }
    }

    const manager = new PluginManager(null);
    expect(steps.splice(0)).toEqual([]);

    manager.startPlugins([A]);
    expect(steps.splice(0)).toEqual(["setup"]);

    manager.destroy();
    expect(steps.splice(0)).toEqual(["destroy"]);
  });

  test("can set a custom id", () => {
    class A extends Plugin {
      static id = "plugin-id";
    }
    const pm = new PluginManager(null);
    pm.startPlugins([A]);
    expect(pm.getPluginById("A")).toBe(null);
    expect(pm.getPluginById("plugin-id")).toBeInstanceOf(A);
  });

  test("fails if plugins has falsy id", () => {
    class A extends Plugin {
      static id = "";
    }
    expect(() => new PluginManager(null).startPlugins([A])).toThrow(`Plugin "A" has no id`);
  });

  test("can get a plugin", () => {
    let a;
    let isDestroyed = false;

    class A extends Plugin {
      static id = "a";

      setup() {
        a = this;
        onWillDestroy(() => (isDestroyed = true));
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    const plugin = manager.getPluginById("a");
    expect(plugin).toBe(a);
    expect(isDestroyed).toBe(false);

    manager.destroy();
    expect(isDestroyed).toBe(true);
  });

  test("can get a plugin with no setup and no id", () => {
    class P extends Plugin {
      value = 1;
    }

    class A extends Plugin {
      p = plugin(P);
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    const a = manager.getPlugin(A)!;
    expect(a.p.value).toBe(1);
  });

  test("fails if trying to start two plugin with the same id", () => {
    class A extends Plugin {
      static id = "plugin";
    }
    class B extends Plugin {
      static id = "plugin";
    }
    expect(() => new PluginManager(null).startPlugins([A, B])).toThrow(
      `Trying to start a plugin with the same id as an other plugin (id: 'plugin', existing plugin: 'A', starting plugin: 'B')`
    );
  });

  test("plugin depending on another plugin with the same id (start only A, B is started implicitly)", () => {
    class A extends Plugin {
      static id = "plugin";
      b = plugin(B);
    }
    class B extends Plugin {
      static id = "plugin";
    }
    expect(() => new PluginManager(null).startPlugins([A])).not.toThrow();
  });

  test("plugin depending on another plugin with the same id (start A and B)", () => {
    class A extends Plugin {
      static id = "plugin";
      b = plugin(B);
    }
    class B extends Plugin {
      static id = "plugin";
    }
    expect(() => new PluginManager(null).startPlugins([A, B])).toThrow(
      `Trying to start a plugin with the same id as an other plugin (id: 'plugin', existing plugin: 'A', starting plugin: 'B')`
    );
  });

  test("plugin depending on another plugin with the same id (start B then A)", () => {
    class A extends Plugin {
      static id = "plugin";
      b = plugin(B);
    }
    class B extends Plugin {
      static id = "plugin";
    }
    expect(() => new PluginManager(null).startPlugins([B, A])).toThrow(
      `Trying to start a plugin with the same id as an other plugin (id: 'plugin', existing plugin: 'B', starting plugin: 'A')`
    );
  });

  test("destroy order is reverse of setup order", () => {
    const steps: string[] = [];

    class A extends Plugin {
      setup() {
        steps.push("setup A");
        onWillDestroy(() => {
          steps.push("destroy A");
        });
      }
    }
    class B extends Plugin {
      setup() {
        steps.push("setup B");
        onWillDestroy(() => {
          steps.push("destroy B");
        });
      }
    }

    const manager = new PluginManager(null);
    expect(steps.splice(0)).toEqual([]);

    manager.startPlugins([A, B]);
    expect(steps.splice(0)).toEqual(["setup A", "setup B"]);

    manager.destroy();
    expect(steps.splice(0)).toEqual(["destroy B", "destroy A"]);
  });

  test("plugins do not start twice", () => {
    const steps: string[] = [];

    class A extends Plugin {
      setup() {
        steps.push("setup");
      }
    }

    const manager = new PluginManager(null);
    expect(steps.splice(0)).toEqual([]);

    manager.startPlugins([A, A]);
    expect(steps.splice(0)).toEqual(["setup"]);
  });

  test("plugin can have dependencies", () => {
    const steps: string[] = [];
    let a = null;
    let b = null;

    class A extends Plugin {
      static id = "a";
      setup() {
        a = this;
        steps.push("setup A");
      }
    }

    class B extends Plugin {
      static id = "b";

      a = plugin(A);
      setup() {
        b = this;
        steps.push("setup B");
      }
    }

    class C extends Plugin {
      static id = "c";

      a = plugin(A);
      b = plugin(B);
      setup() {
        steps.push("setup C");
      }
    }

    const manager = new PluginManager(null);
    expect(steps.splice(0)).toEqual([]);

    manager.startPlugins([A, B, C]);
    expect(steps.splice(0)).toEqual(["setup A", "setup B", "setup C"]);
    expect(manager.getPluginById<B>("b")!.a).toBe(a);
    expect(manager.getPluginById<C>("c")!.a).toBe(a);
    expect(manager.getPluginById<C>("c")!.b).toBe(b);
  });

  test("can get plugins from pluginmanager", () => {
    let a = null;

    class A extends Plugin {
      static id = "a";
      setup() {
        a = this;
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    expect(manager.getPluginById<A>("a")).toBe(a);
    expect(manager.getPluginById<A>("b")).toBe(null);
    expect(manager.getPlugin(A)).toBe(a);
  });

  test("plugin auto start dependencies", () => {
    const steps: string[] = [];
    let a = null;
    let b = null;

    class A extends Plugin {
      static id = "a";
      setup() {
        a = this;
        steps.push("setup A");
      }
    }

    class B extends Plugin {
      static id = "b";

      a = plugin(A);
      setup() {
        b = this;
        steps.push("setup B");
      }
    }

    class C extends Plugin {
      static id = "c";

      b = plugin(B);
      a = plugin(A);
      setup() {
        steps.push("setup C");
      }
    }

    const manager = new PluginManager(null);
    expect(steps.splice(0)).toEqual([]);

    manager.startPlugins([C]); // note that we only start plugin C
    expect(steps.splice(0)).toEqual(["setup A", "setup B", "setup C"]);
    expect(manager.getPluginById<B>("b")!.a).toBe(a);
    expect(manager.getPluginById<C>("c")!.a).toBe(a);
    expect(manager.getPluginById<C>("c")!.b).toBe(b);
  });

  test("dependency can be set in setup", () => {
    let a = null;

    class A extends Plugin {
      setup() {
        a = this;
      }
    }

    class B extends Plugin {
      static id = "b";

      declare a: A;
      setup() {
        this.a = plugin(A);
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([B]);
    expect(manager.getPluginById<B>("b")!.a).toBe(a);
  });

  test("plugin fn cannot be called outside Plugin and Component", () => {
    class A extends Plugin {}
    expect(() => plugin(A)).toThrow(
      `No active component (a hook function should only be called in 'setup')`
    );
  });

  test("plugin lifecycle", () => {
    class A extends Plugin {
      status = status();
    }
    const manager = new PluginManager(null);
    expect(manager.status).toBe(0); // new;

    const [a] = manager.startPlugins([A]) as [A];
    expect(manager.status).toBe(1); // started
    expect(a.status()).toBe("started");

    manager.destroy();
    expect(manager.status).toBe(3); // destroyed
    expect(a.status()).toBe("destroyed");
  });
});

describe("sub plugin managers", () => {
  test("basic feature", () => {
    const steps: string[] = [];

    class A extends Plugin {
      setup() {
        steps.push("setup A");
        onWillDestroy(() => {
          steps.push("destroy A");
        });
      }
    }

    class B extends Plugin {
      setup() {
        steps.push("setup B");
        onWillDestroy(() => {
          steps.push("destroy B");
        });
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    expect(steps.splice(0)).toEqual(["setup A"]);

    const subManager = new PluginManager(manager);
    subManager.startPlugins([B]);
    expect(steps.splice(0)).toEqual(["setup B"]);

    subManager.destroy();
    expect(steps.splice(0)).toEqual(["destroy B"]);

    manager.destroy();
    expect(steps.splice(0)).toEqual(["destroy A"]);
  });

  test("destroying parent plugin manager destroys everything", () => {
    const steps: string[] = [];

    class A extends Plugin {
      setup() {
        steps.push("setup A");
        onWillDestroy(() => {
          steps.push("destroy A");
        });
      }
    }

    class B extends Plugin {
      setup() {
        steps.push("setup B");
        onWillDestroy(() => {
          steps.push("destroy B");
        });
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    new PluginManager(manager).startPlugins([B]);
    expect(steps.splice(0)).toEqual(["setup A", "setup B"]);

    manager.destroy();
    expect(steps.splice(0)).toEqual(["destroy B", "destroy A"]);
  });

  test("can access plugin in parent manager", () => {
    const steps: string[] = [];

    class A extends Plugin {
      setup() {
        steps.push("setup A");
      }
      someFunction() {
        return 1;
      }
    }

    class B extends Plugin {
      a = plugin(A);
      setup() {
        steps.push("setup B");
        steps.push("value " + this.a.someFunction());
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    expect(steps.splice(0)).toEqual(["setup A"]);

    new PluginManager(manager).startPlugins([B]);
    expect(steps).toEqual(["setup B", "value 1"]);
  });

  test("plugin can be shadowed", () => {
    class A extends Plugin {
      someFunction() {
        return 1;
      }
    }

    class ShadowA extends Plugin {
      static id = "A";

      someFunction() {
        return 123;
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    expect(manager.getPluginById<A>("A")!.someFunction()).toBe(1);

    const subManager = new PluginManager(manager);
    subManager.startPlugins([ShadowA]);
    expect(subManager.getPluginById<A>("A")!.someFunction()).toBe(123);
  });
});

describe("plugins and resources", () => {
  test("can define a resource type", () => {
    class A extends Plugin {
      colors = new Resource({ name: "colors", validation: String });
    }
    class B extends Plugin {
      a = plugin(A);

      setup() {
        this.a.colors.add("red");
      }
    }
    class C extends Plugin {
      setup() {
        useResource(plugin(A).colors, ["green", "blue"]);
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A, B, C]);
    const a = manager.getPluginById("A") as A;
    expect(a.colors.items()).toEqual(["red", "green", "blue"]);
  });

  test("resources from child plugins are available in parent plugins", () => {
    class A extends Plugin {
      colors = new Resource({ name: "colors", validation: String });
    }
    class B extends Plugin {
      setup() {
        useResource(plugin(A).colors, ["red"]);
      }
    }
    class C extends Plugin {
      setup() {
        useResource(plugin(A).colors, ["green", "blue"]);
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A, B]);
    const a = manager.getPlugin(A)!;
    expect(a.colors.items()).toEqual(["red"]);

    const subManager = new PluginManager(manager);
    subManager.startPlugins([C]);
    expect(a.colors.items()).toEqual(["red", "green", "blue"]);

    subManager.destroy();
    expect(a.colors.items()).toEqual(["red"]);
  });

  test("resources are derived values, can be seen from effect", async () => {
    class A extends Plugin {
      colors = new Resource<string>({ name: "colors", validation: String });
    }

    class B extends Plugin {
      setup() {
        useResource(plugin(A).colors, ["red"]);
      }
    }
    class C extends Plugin {
      setup() {
        useResource(plugin(A).colors, ["green", "blue"]);
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A, B]);
    const a = manager.getPlugin(A)!;

    const steps: string[] = [];
    effect(() => {
      steps.push(a.colors.items().join(","));
    });
    expect(steps.splice(0)).toEqual(["red"]);

    const subManager = new PluginManager(manager);
    subManager.startPlugins([C]);
    expect(steps.splice(0)).toEqual([]);

    await waitScheduler();
    expect(steps.splice(0)).toEqual(["red,green,blue"]);

    subManager.destroy();
    expect(steps.splice(0)).toEqual([]);

    await waitScheduler();
    expect(steps.splice(0)).toEqual(["red"]);
  });
});
