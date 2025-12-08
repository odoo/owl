import { effect, onWillDestroy, plugin, Plugin, PluginManager } from "../src";
import { waitScheduler } from "./helpers";

describe("basic features", () => {
  test("can instantiate and destroy a plugin", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
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
    const plugin = manager.getPlugin("a");
    expect(plugin).toBe(a);
    expect(isDestroyed).toBe(false);

    manager.destroy();
    expect(isDestroyed).toBe(true);
  });

  test("destroy order is reverse of setup order", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup A");
        onWillDestroy(() => {
          steps.push("destroy A");
        });
      }
    }
    class B extends Plugin {
      static id = "b";
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

  test("fails if plugins has no id", () => {
    class A extends Plugin {}
    expect(() => new PluginManager(null).startPlugins([A])).toThrowError(`Plugin "A" has no id`);
  });

  test("plugins do not start twice", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";

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
    expect(manager.getPlugin<B>("b")!.a).toBe(a);
    expect(manager.getPlugin<C>("c")!.a).toBe(a);
    expect(manager.getPlugin<C>("c")!.b).toBe(b);
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
    expect(manager.getPlugin<B>("b")!.a).toBe(a);
    expect(manager.getPlugin<C>("c")!.a).toBe(a);
    expect(manager.getPlugin<C>("c")!.b).toBe(b);
  });

  test("dependency can be set in setup", () => {
    let a = null;

    class A extends Plugin {
      static id = "a";
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
    expect(manager.getPlugin<B>("b")!.a).toBe(a);
  });

  test("plugin fn cannot be called outside Plugin and Component", () => {
    class A extends Plugin {
      static id = "a";
    }
    expect(() => plugin(A)).toThrowError(
      `No active component (a hook function should only be called in 'setup')`
    );
  });
});

describe("sub plugin managers", () => {
  test("basic feature", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup A");
        onWillDestroy(() => {
          steps.push("destroy A");
        });
      }
    }

    class B extends Plugin {
      static id = "b";
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
      static id = "a";
      setup() {
        steps.push("setup A");
        onWillDestroy(() => {
          steps.push("destroy A");
        });
      }
    }

    class B extends Plugin {
      static id = "b";
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
      static id = "a";
      setup() {
        steps.push("setup A");
      }
      someFunction() {
        return 1;
      }
    }

    class B extends Plugin {
      static id = "b";

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
      static id = "a";

      someFunction() {
        return 1;
      }
    }

    class ShadowA extends Plugin {
      static id = "a";

      someFunction() {
        return 123;
      }
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A]);
    expect(manager.getPlugin<A>("a")!.someFunction()).toBe(1);

    const subManager = new PluginManager(manager);
    subManager.startPlugins([ShadowA]);
    expect(subManager.getPlugin<A>("a")!.someFunction()).toBe(123);
  });
});

describe("resource system", () => {
  test("can define a resource type", () => {
    class A extends Plugin {
      static id = "a";
      static resources = {
        colors: String,
      };
    }
    class B extends Plugin {
      static id = "b";
      resources = {
        colors: "red",
      };
    }
    class C extends Plugin {
      static id = "c";
      resources = {
        colors: ["green", "blue"],
      };
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A, B, C]);
    expect(manager.getResource("colors")).toEqual(["red", "green", "blue"]);
  });

  test("resources from child plugins are available in parent plugins", () => {
    class A extends Plugin {
      static id = "a";
      static resources = {
        colors: String,
      };
    }
    class B extends Plugin {
      static id = "b";
      resources = {
        colors: "red",
      };
    }
    class C extends Plugin {
      static id = "c";
      resources = {
        colors: ["green", "blue"],
      };
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A, B]);
    expect(manager.getResource("colors")).toEqual(["red"]);

    const subManager = new PluginManager(manager);
    subManager.startPlugins([C]);
    expect(manager.getResource("colors")).toEqual(["red", "green", "blue"]);
    expect(subManager.getResource("colors")).toEqual(["red", "green", "blue"]);

    subManager.destroy();
    expect(manager.getResource("colors")).toEqual(["red"]);
    expect(subManager.getResource("colors")).toEqual(["red"]);
  });

  test("resources are derived values, can be seen from effect", async () => {
    class A extends Plugin {
      static id = "a";
      static resources = {
        colors: String,
      };
    }
    class B extends Plugin {
      static id = "b";
      resources = {
        colors: "red",
      };
    }
    class C extends Plugin {
      static id = "c";
      resources = {
        colors: ["green", "blue"],
      };
    }

    const manager = new PluginManager(null);
    manager.startPlugins([A, B]);

    const steps: string[] = [];
    effect(() => {
      steps.push(manager.getResource("colors").join(","));
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
