import {
  App,
  Component,
  computed,
  config,
  mount,
  onError,
  onWillDestroy,
  onWillStart,
  plugin,
  Plugin,
  PluginConstructor,
  PluginInstance,
  providePlugins,
  Resource,
  Scope,
  signal,
  types as t,
  useApp,
  useEffect,
  usePlugin,
  xml,
} from "../../src";
import {
  makeDeferred,
  makeTestFixture,
  nextMicroTick,
  snapshotEverything,
  nextTick,
  getConsoleOutput,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();
beforeEach(() => {
  fixture = makeTestFixture();
});

test("basic use", async () => {
  class PluginA extends Plugin {
    value = "value from plugin";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.value"/>`;
    a = plugin(PluginA);
  }

  await mount(Test, fixture, { plugins: [PluginA] });
  expect(fixture.innerHTML).toBe("value from plugin");
});

test("can be started with resource", async () => {
  class PluginA extends Plugin {
    value = "value from plugin";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.value"/>`;
    a = plugin(PluginA);
  }

  const plugins = new Resource<PluginConstructor>().add(PluginA);
  await mount(Test, fixture, { plugins });
  expect(fixture.innerHTML).toBe("value from plugin");
});

test("plugins added to resource starts automatically", async () => {
  const steps: string[] = [];

  class PluginA extends Plugin {
    setup() {
      steps.push("PluginA started");
    }
  }

  class Test extends Component {
    static template = xml``;
  }

  const plugins = new Resource<PluginConstructor>();
  await mount(Test, fixture, { plugins });
  expect(steps.splice(0)).toEqual([]);

  plugins.add(PluginA);
  await nextMicroTick();
  expect(steps.splice(0)).toEqual(["PluginA started"]);
});

test("a global plugin can import the current app", async () => {
  let _appFromPlugin: any = null;

  class PluginA extends Plugin {
    setup() {
      _appFromPlugin = useApp();
    }
  }

  class Test extends Component {
    static template = xml`coucou`;
  }

  const app = new App({ plugins: [PluginA] });
  await app.createRoot(Test).mount(fixture);
  expect(fixture.innerHTML).toBe("coucou");
  expect(_appFromPlugin).toBe(app);
});

test("basic use (setup)", async () => {
  class PluginA extends Plugin {
    value = "value from plugin";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.value"/>`;
    declare a: PluginInstance<typeof PluginA>;

    setup() {
      this.a = plugin(PluginA);
    }
  }

  await mount(Test, fixture, { plugins: [PluginA] });
  expect(fixture.innerHTML).toBe("value from plugin");
});

test("get plugin which is not started", async () => {
  const steps: string[] = [];

  class PluginA extends Plugin {
    static id = "a";
    value = "value from plugin";
  }

  class Test extends Component {
    static template = xml``;
    declare a: PluginInstance<typeof PluginA>;

    setup() {
      try {
        this.a = plugin(PluginA);
      } catch (e) {
        steps.push((e as Error).message);
      }
    }
  }

  await mount(Test, fixture);
  expect(steps.splice(0)).toEqual([`Unknown plugin "a"`]);
});

test("components can start plugins", async () => {
  class PluginA extends Plugin {
    value = "value from plugin A";
  }

  class PluginB extends Plugin {
    value = "value from plugin B";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.value"/> - <t t-out="this.b.value"/>`;
    declare a: PluginInstance<typeof PluginA>;
    declare b: PluginInstance<typeof PluginB>;

    setup() {
      this.a = plugin(PluginA); // PluginA is already started, we can get it
      // PluginB is not started yet so we'll crash if we try to get it (tested in a previous test)

      providePlugins([PluginB]);
      this.b = plugin(PluginB); // PluginB is now started, we can get it
    }
  }

  await mount(Test, fixture, { plugins: [PluginA] });
  expect(fixture.innerHTML).toBe("value from plugin A - value from plugin B");
});

test("components start plugins at their level", async () => {
  class PluginA extends Plugin {
    static id = "a";
    value = "pA";
  }

  class PluginB extends Plugin {
    static id = "b";
    value = "pB";
  }

  class Level3 extends Component {
    static template = xml`3: <t t-out="this.a.value"/> - <t t-out="this.b.value"/>`;

    a = plugin(PluginA);
    b = plugin(PluginB);
  }

  class Level2 extends Component {
    static template = xml`2: <t t-out="this.a.value"/> | <Level3/>`;
    static components = { Level3 };

    a = plugin(PluginA);

    setup() {
      providePlugins([PluginB]);
    }
  }

  class Level1 extends Component {
    static template = xml`1 | <Level2/>`;
    static components = { Level2 };

    setup() {
      providePlugins([PluginA]);
    }
  }

  const app = new App();
  await app.createRoot(Level1).mount(fixture);
  expect(app.pluginManager.getPluginById("a")).toBe(null);
  expect(app.pluginManager.getPluginById("b")).toBe(null);
  expect(fixture.innerHTML).toBe("1 | 2: pA | 3: pA - pB");
});

test("components can give config to plugins", async () => {
  class PluginA extends Plugin {
    inputA = config("inputAlias", t.string());
  }

  class PluginB extends Plugin {
    inputB = config("otherInput", t.number());
    other = 1;
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.inputA"/>-<t t-out="this.b.inputB"/>`;
    declare a: PluginInstance<typeof PluginA>;
    declare b: PluginInstance<typeof PluginB>;

    setup() {
      providePlugins([PluginA, PluginB], { inputAlias: "hamburger", otherInput: 123 });
      this.a = plugin(PluginA);
      this.b = plugin(PluginB);
    }
  }
  await mount(Test, fixture);
  expect(fixture.innerHTML).toBe("hamburger-123");
});

test("plugin config are validated", async () => {
  class PluginA extends Plugin {
    inputA = config("input", t.string());
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.inputA"/>`;
    declare a: PluginInstance<typeof PluginA>;

    setup() {
      providePlugins([PluginA], { input: 123 } as any);
      this.a = plugin(PluginA);
    }
  }
  await expect(mount(Test, fixture, { dev: true })).rejects.toThrow(
    "Config does not match the type"
  );
  expect(getConsoleOutput()).toEqual([`info:Owl is running in 'dev' mode.`]);
});

test("optional plugin config work as expected (value given)", async () => {
  class PluginA extends Plugin {
    inputA = config("input", t.string().optional()) || "abc";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.inputA"/>`;
    a = plugin(PluginA);
  }
  await mount(Test, fixture, { plugins: [PluginA], dev: true, config: { input: "def" } });
  expect(fixture.innerHTML).toBe("def");
});

test("optional plugin config work as expected (no value given)", async () => {
  class PluginA extends Plugin {
    inputA = config("input", t.string().optional()) || "abc";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.inputA"/>`;
    a = plugin(PluginA);
  }
  await mount(Test, fixture, { plugins: [PluginA], dev: true, config: {} });
  expect(fixture.innerHTML).toBe("abc");
});

test("optional plugin config work as expected (no config given)", async () => {
  class PluginA extends Plugin {
    inputA = config("input", t.string().optional()) || "abc";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.inputA"/>`;
    a = plugin(PluginA);
  }
  await mount(Test, fixture, { plugins: [PluginA], dev: true });
  expect(fixture.innerHTML).toBe("abc");
});

test("shadow plugin", async () => {
  class PluginA extends Plugin {
    static id = "a";
    value = "a";
  }

  class ShadowPluginA extends Plugin {
    static id = "a";
    value = "shadow";
  }

  class Level3 extends Component {
    static template = xml`<t t-out="this.a.value"/>`;
    a = plugin(PluginA);
  }

  class Level2 extends Component {
    static template = xml`<Level3/>`;
    static components = { Level3 };

    setup() {
      providePlugins([ShadowPluginA]);
    }
  }

  class Level1 extends Component {
    static template = xml`<t t-out="this.a.value"/> | <Level2/>`;
    static components = { Level2 };

    a = plugin(PluginA);
  }

  await mount(Level1, fixture, { plugins: [PluginA] });
  expect(fixture.innerHTML).toBe("a | shadow");
});

test("components can register resources", async () => {
  class PluginA extends Plugin {
    colors = new Resource({ name: "colors", validation: t.string() });

    value = computed(() => {
      return this.colors.items().join("|");
    });
  }

  class Level2 extends Component {
    static template = xml`2: <t t-out="this.a.value()"/> `;

    a = plugin(PluginA);
    setup() {
      this.a.colors.use("from lvl 2");
      expect(this.a.colors.items()).toEqual(["from lvl 1", "from lvl 2"]);
    }
  }

  class Level1 extends Component {
    static template = xml`1 | <Level2/>`;
    static components = { Level2 };

    setup() {
      const a = plugin(PluginA);
      a.colors.use("from lvl 1");
      expect(a.colors.items()).toEqual(["from lvl 1"]);
    }
  }

  const app = new App({ plugins: [PluginA] });
  const a = app.pluginManager.getPlugin(PluginA)!;
  expect(a.colors.items()).toEqual([]);

  await app.createRoot(Level1).mount(fixture);
  expect(a.colors.items()).toEqual(["from lvl 1", "from lvl 2"]);
  expect(fixture.innerHTML).toBe("1 | 2: from lvl 1|from lvl 2 ");
});

test("components, plugins, useEffect", async () => {
  const value = signal("a");
  const derived = signal("a");

  class P extends Plugin {
    setup() {
      useEffect(() => {
        derived.set(value());
      });
      // this triggers the bug
      value();
    }
  }

  class R extends Component {
    static template = xml`
      <t t-out="this.value()"/>
      <t t-out="this.derived()"/>`;

    value = value;
    derived = derived;
  }

  await mount(R, fixture, { plugins: [P] });
  expect(fixture.innerHTML).toBe("aa");

  value.set("b");
  await nextTick();
  expect(fixture.innerHTML).toBe("bb");
  value.set("c");
  await nextTick();
  expect(fixture.innerHTML).toBe("cc");
});

test("components mounted by plugin", async () => {
  class R2 extends Component {
    static template = xml`<t t-out="this.p.value"/>`;
    p = plugin(P);
  }

  class P extends Plugin {
    value = "def";
    setup() {
      const app = useApp();
      const root = app.createRoot(R2);
      root.mount(fixture);
      onWillDestroy(() => {
        root.destroy();
      });
    }
  }

  class R extends Component {
    static template = xml`abc`;
  }

  await mount(R, fixture, { plugins: [P] });
  expect(fixture.innerHTML).toBe("defabc");
});

test("usePlugin returns the scoped view when the plugin defines one", async () => {
  class ORM extends Plugin {
    static scoped(self: ORM, scope: Scope): ORM {
      return Object.assign(Object.create(self), {
        read: scope.run.bind(scope, self.read),
      });
    }
    unscoped = this;
    read = async (id: number) => `record ${id}`;
  }

  let comp: Test;
  class Test extends Component {
    static template = xml``;
    orm = plugin(ORM);
    orm2 = plugin(ORM);
    setup() {
      comp = this;
    }
  }

  const app = new App({ plugins: [ORM] });
  await app.createRoot(Test).mount(fixture);

  const rawOrm = app.pluginManager.getPlugin(ORM)!;
  expect(comp!.orm).not.toBe(rawOrm);
  expect(comp!.orm.unscoped).toBe(rawOrm);
  expect(Object.getPrototypeOf(comp!.orm)).toBe(rawOrm);
  // one view per usePlugin call
  expect(comp!.orm2).not.toBe(comp!.orm);
  expect(await comp!.orm.read(3)).toBe("record 3");
  app.destroy();
});

test("scoped plugin methods are guarded by the consumer's lifetime", async () => {
  const request = makeDeferred<string>();

  class ORM extends Plugin {
    static scoped(self: ORM, scope: Scope): ORM {
      return Object.assign(Object.create(self), {
        read: scope.run.bind(scope, self.read),
      });
    }
    unscoped = this;
    read = () => request;
  }

  let comp: Test;
  class Test extends Component {
    static template = xml``;
    orm = plugin(ORM);
    setup() {
      comp = this;
    }
  }

  const app = new App({ plugins: [ORM] });
  await app.createRoot(Test).mount(fixture);

  const guarded = comp!.orm.read();
  const unguarded = comp!.orm.unscoped.read();
  app.destroy();
  request.resolve("data");

  await expect(guarded).rejects.toThrow("The operation was aborted");
  await expect(unguarded).resolves.toBe("data");
});

test("providePlugins respects plugin sequence", async () => {
  const rpc = makeDeferred<string>();
  const steps: string[] = [];

  class Foundation extends Plugin {
    static sequence = 10;
    data: string | null = null;
    setup() {
      onWillStart(async () => {
        this.data = await rpc;
      });
    }
  }

  class Feature extends Plugin {
    foundation = plugin(Foundation);
    setup() {
      steps.push(`feature:setup (data=${this.foundation.data})`);
    }
  }

  class Child extends Component {
    static template = xml`<span>child</span>`;
  }

  class Parent extends Component {
    static template = xml`<Child/>`;
    static components = { Child };
    setup() {
      providePlugins([Feature, Foundation]);
    }
  }

  const app = new App();
  const mounted = app.createRoot(Parent).mount(fixture);
  await nextTick();
  // Feature's setup waits for Foundation, which delays the component render
  expect(steps.splice(0)).toEqual([]);
  expect(fixture.innerHTML).toBe("");

  rpc.resolve("hello");
  await mounted;
  expect(steps.splice(0)).toEqual(["feature:setup (data=hello)"]);
  expect(fixture.innerHTML).toBe("<span>child</span>");
  app.destroy();
});

test("a plugin can handle errors coming from the subtree it is provided in", async () => {
  class ErrorPlugin extends Plugin {
    error = signal(null);
    setup() {
      onError((e) => this.error.set(e));
    }
  }

  class Boom extends Component {
    static template = xml`<div t-out="this.a.b.c"/>`;
  }

  class Parent extends Component {
    static template = xml`<t t-if="this.errors.error()">Error</t><t t-else=""><Boom/></t>`;
    static components = { Boom };
    errors: any;
    setup() {
      providePlugins([ErrorPlugin]);
      this.errors = usePlugin(ErrorPlugin);
    }
  }

  class Root extends Component {
    static template = xml`<Parent/>`;
    static components = { Parent };
  }

  await mount(Root, fixture);
  expect(fixture.innerHTML).toBe("Error");
  expect(getConsoleOutput()).toEqual([]);
});

test("app-level plugins can handle errors escaping the root component", async () => {
  const flag = signal(false);
  let caught: any = null;

  class ErrorPlugin extends Plugin {
    setup() {
      onError((e) => {
        caught = e;
        flag.set(false);
      });
    }
  }

  class Root extends Component {
    static template = xml`<t t-if="this.flag()" t-out="this.a.b.c"/><t t-else="">ok</t>`;
    flag = flag;
  }

  await mount(Root, fixture, { plugins: [ErrorPlugin] });
  expect(fixture.innerHTML).toBe("ok");

  flag.set(true);
  await nextTick();
  expect(caught).toBeInstanceOf(TypeError);
  expect(fixture.innerHTML).toBe("ok");
  expect(getConsoleOutput()).toEqual([]);
});

test("plugin onError handlers can rethrow, after the host's own handlers", async () => {
  const steps: string[] = [];

  class ErrorPlugin extends Plugin {
    setup() {
      onError((e) => {
        steps.push("plugin");
        throw e;
      });
    }
  }

  class Boom extends Component {
    static template = xml`<div t-out="this.a.b.c"/>`;
  }

  class Provider extends Component {
    static template = xml`<Boom/>`;
    static components = { Boom };
    setup() {
      providePlugins([ErrorPlugin]);
      onError((e) => {
        steps.push("provider");
        throw e;
      });
    }
  }

  class Root extends Component {
    static template = xml`<t t-if="this.error()">Error</t><t t-else=""><Provider/></t>`;
    static components = { Provider };
    error = signal(false);
    setup() {
      onError(() => {
        steps.push("root");
        this.error.set(true);
      });
    }
  }

  await mount(Root, fixture);
  expect(fixture.innerHTML).toBe("Error");
  expect(steps).toEqual(["provider", "plugin", "root"]);
});
