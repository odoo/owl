import { effect } from "../src";
import { Plugin, PluginManager } from "../src/runtime/plugins";
import { waitScheduler } from "./helpers";

describe("basic features", () => {
  test("can instantiate and destroy a plugin", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup");
      }
      destroy() {
        steps.push("destroy");
      }
    }
    expect(steps).toEqual([]);
    const manager = new PluginManager(null, [A]);
    expect(steps).toEqual(["setup"]);
    manager.destroy();
    expect(steps).toEqual(["setup", "destroy"]);
  });

  test("can get a plugin", () => {
    let a;
    class A extends Plugin {
      static id = "a";
      setup() {
        a = this;
      }
    }
    const manager = new PluginManager(null, [A]);
    const plugin = manager.getPlugin("a");
    expect(plugin).toBe(a);
    expect(plugin!.isDestroyed).toBe(false);
    manager.destroy();
    expect(plugin!.isDestroyed).toBe(true);
  });

  test("destroy order is reverse of setup order", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup A");
      }
      destroy() {
        steps.push("destroy A");
      }
    }
    class B extends Plugin {
      static id = "b";
      setup() {
        steps.push("setup B");
      }
      destroy() {
        steps.push("destroy B");
      }
    }

    expect(steps).toEqual([]);
    const manager = new PluginManager(null, [A, B]);
    expect(steps).toEqual(["setup A", "setup B"]);
    steps.splice(0);
    manager.destroy();
    expect(steps).toEqual(["destroy B", "destroy A"]);
  });

  test("fails if plugins has no id", () => {
    class A extends Plugin {}

    expect(() => new PluginManager(null, [A])).toThrowError("Plugin A has no id");
  });

  test("fails if same plugin is registered twice", () => {
    class A extends Plugin {
      static id = "a";
    }

    expect(() => new PluginManager(null, [A, A])).toThrowError(
      "A plugin with the same ID is already defined"
    );
  });

  test("plugins are instantiated by respecting the dependency order", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup A");
      }
      destroy() {
        steps.push("destroy A");
      }
    }
    class B extends Plugin {
      static id = "b";
      static dependencies = ["a"];
      setup() {
        steps.push("setup B");
      }
      destroy() {
        steps.push("destroy B");
      }
    }

    expect(steps).toEqual([]);
    const manager = new PluginManager(null, [B, A]);
    expect(steps).toEqual(["setup A", "setup B"]);
    steps.splice(0);
    manager.destroy();
    expect(steps).toEqual(["destroy B", "destroy A"]);
  });

  test("can access the dependency in the deps object", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";

      setup() {
        steps.push("setup A");
      }

      doSomething() {
        steps.push("dosomething");
        return 1;
      }
    }

    class B extends Plugin {
      static id = "b";
      static dependencies = ["a"];

      declare plugins: { a: A };

      setup() {
        steps.push("setup B");
        const value = this.plugins.a.doSomething();
        steps.push("value " + value);
      }
      destroy() {
        steps.push("destroy B");
      }
    }

    new PluginManager(null, [B, A]);
    expect(steps).toEqual(["setup A", "setup B", "dosomething", "value 1"]);
  });

  // test("pluginManager can be given a dynamic list of plugins", () => {
  //   const steps: string[] = [];

  //   class A extends Plugin {
  //     static id = "a";
  //     setup() {
  //       steps.push("setup A");
  //     }
  //     destroy() {
  //       steps.push("destroy A");
  //     }
  //   }
  //   class B extends Plugin {
  //     static id = "b";
  //     static dependencies = ["a"];
  //     setup() {
  //       steps.push("setup B");
  //     }
  //     destroy() {
  //       steps.push("destroy B");
  //     }
  //   }

  //   expect(steps).toEqual([]);

  //   const list = reactive([]);
  //   const fn = derived(() => {
  //     return list;
  //   })
  //   const manager = new PluginManager(null, [B, A]);
  //   expect(steps).toEqual(["setup A", "setup B"]);
  //   steps.splice(0);
  //   manager.destroy();
  //   expect(steps).toEqual(["destroy B", "destroy A"]);
  // });
});

describe("sub plugin managers", () => {
  test("basic feature", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup A");
      }
      destroy() {
        steps.push("destroy A");
      }
    }

    class B extends Plugin {
      static id = "b";
      setup() {
        steps.push("setup B");
      }
      destroy() {
        steps.push("destroy B");
      }
    }

    expect(steps).toEqual([]);
    const manager = new PluginManager(null, [A]);
    expect(steps).toEqual(["setup A"]);
    steps.splice(0);

    const subManager = new PluginManager(manager, [B]);
    expect(steps).toEqual(["setup B"]);
    steps.splice(0);

    subManager.destroy();
    expect(steps).toEqual(["destroy B"]);
    steps.splice(0);

    manager.destroy();
    expect(steps).toEqual(["destroy A"]);
  });

  test("destroying parent plugin manager destroys everything", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup A");
      }
      destroy() {
        steps.push("destroy A");
      }
    }

    class B extends Plugin {
      static id = "b";
      setup() {
        steps.push("setup B");
      }
      destroy() {
        steps.push("destroy B");
      }
    }

    const manager = new PluginManager(null, [A]);
    new PluginManager(manager, [B]);
    steps.splice(0);

    manager.destroy();
    expect(steps).toEqual(["destroy B", "destroy A"]);
  });

  test("can access plugin in parent manager", () => {
    const steps: string[] = [];

    class A extends Plugin {
      static id = "a";
      setup() {
        steps.push("setup A");
      }
      destroy() {
        steps.push("destroy A");
      }
      someFunction() {
        return 1;
      }
    }

    class B extends Plugin {
      static id = "b";
      static dependencies = ["a"];
      declare plugins: { a: A };

      setup() {
        steps.push("setup B");
        steps.push("value " + this.plugins.a.someFunction());
      }

      destroy() {
        steps.push("destroy B");
      }
    }

    const manager = new PluginManager(null, [A]);
    steps.splice(0);

    new PluginManager(manager, [B]);
    expect(steps).toEqual(["setup B", "value 1"]);
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
    const manager = new PluginManager(null, [A, B, C]);
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
    const manager = new PluginManager(null, [A, B]);
    expect(manager.getResource("colors")).toEqual(["red"]);
    const subManager = new PluginManager(manager, [C]);
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
    const manager = new PluginManager(null, [A, B]);
    const steps: string[] = [];
    effect(() => {
      steps.push(manager.getResource("colors").join(","));
    });
    expect(steps).toEqual(["red"]);
    const subManager = new PluginManager(manager, [C]);
    expect(steps).toEqual(["red"]);
    await waitScheduler();
    expect(steps).toEqual(["red", "red,green,blue"]);
    subManager.destroy();
    expect(steps).toEqual(["red", "red,green,blue"]);
    await waitScheduler();
    expect(steps).toEqual(["red", "red,green,blue", "red"]);
  });
});

// const registry = new Registry();

// const globalPlugins = registry.get("services");
// const manager = new PluginManager(null, []);

// const newPlugins = derived(() => {
//   return globalPlugins.items().filter(P => !manager.hasPlugin(P.id));
// });
// effect(() => {
//   for (const P of newPlugins() {
//       manager.addPlugin(P);
//   }
// });

// const env = {
//   plugins: new PluginManager(null, Plugins) ;
// };

// function usePlugin(name) {
//   const env = useEnv();
//   return env.plugins.getPlugin(name);
// }

// function providePlugins(Plugins) {
//     const env = useEnv();
//     usesubEnv({
//       plugins: new PluginManager(env.plugins, ASDF.Plugins)
//     })
// }

// class ADSF extends Component {
//   static Plugins = [A,B,C]

// }

// mount(Root, document.body, {
//   env,
//   props,
//   Plugins,
//   staticProcessor: {
//     Plugins: (instance, env) => {

//     }
//   }
// });

// class PieChartComponent extends Component {
//   static props = { someNumbers: ...};
//   static template = xml`<canvas t-ref="canvas"/>`;

//   setup() {
//     this.canvasRef = useRef("canvas");
//     onWillStart(() => loadJS("chart.js"));
//     onMounted(() => {
//       this.chartJS = new Chart({
//         target: this.canvasRef.el,
//         data: this.getPieChartDefinition(this.props);
//       })
//     });
//     onWillUnmount(() => {
//       this.chartJS.destroy();
//     });

//     onPatched(( => {
//       this.chartJs.destroy();
//       this.chartJS = new Chart({
//         target: this.canvasRef.el,
//         data: this.getPieChartDefinition(this.props);
//       })
//     })
//   }

//   getPieChartDefinition(props) {
//     return something(props);
//   }
// }

// class PieChartComponent extends Component {
//   static props = { someNumbers: ...};
//   static template = xml`<canvas t-ref="canvas"/>`;

//   setup() {
//     this.canvasRef = useRef("canvas");
//     const chartJS = asyncDerived(() => loadJS("char.js"));
//     effect()
//     this.chart = asyncDerived(async () => {
//       await chartJS();
//       if (this.chart) {
//         this.chart.destroy();
//       }
//       return new Chart({
//         target: this.canvasRef.el,
//         data: this.getPieChartDefinition()
//       });
//     })
//     onWillUnmount(() => {
//       this.chart.destroy();
//     });

//   }

//   getPieChartDefinition() {
//     return something(this.props);
//   }

// }
