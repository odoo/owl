import {
  App,
  Component,
  computed,
  input,
  mount,
  plugin,
  Plugin,
  PluginInstance,
  PluginManager,
  providePlugins,
  Resource,
  types as t,
  useApp,
  useResource,
  xml,
} from "../../src";
import { makeTestFixture, snapshotEverything } from "../helpers";

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

  const pluginManager = new PluginManager();
  pluginManager.startPlugins([PluginA]);

  await mount(Test, fixture, { pluginManager });
  expect(fixture.innerHTML).toBe("value from plugin");
});

test("can be started with plugin list", async () => {
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

  const pluginManager = new PluginManager();
  pluginManager.startPlugins([PluginA]);

  await mount(Test, fixture, { pluginManager });
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

  const pluginManager = new PluginManager();
  await mount(Test, fixture, { pluginManager });

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

  const pluginManager = new PluginManager();
  pluginManager.startPlugins([PluginA]);

  await mount(Test, fixture, { pluginManager });
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

  const pluginManager = new PluginManager();

  await mount(Level1, fixture, { pluginManager });
  expect(pluginManager.getPluginById("a")).toBe(null);
  expect(pluginManager.getPluginById("b")).toBe(null);
  expect(fixture.innerHTML).toBe("1 | 2: pA | 3: pA - pB");
});

test("components can give values to plugins", async () => {
  class PluginA extends Plugin {
    inputA = input("inputAlias", t.string);
  }

  class PluginB extends Plugin {
    inputB = input("otherInput", t.number);
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

  const pluginManager = new PluginManager();
  pluginManager.startPlugins([PluginA]);

  await mount(Level1, fixture, { pluginManager });
  expect(fixture.innerHTML).toBe("a | shadow");
});

test("components can register resources", async () => {
  class PluginA extends Plugin {
    colors = new Resource({ name: "colors", validation: t.string });

    value = computed(() => {
      return this.colors.items().join("|");
    });
  }

  class Level2 extends Component {
    static template = xml`2: <t t-out="this.a.value()"/> `;

    a = plugin(PluginA);
    setup() {
      useResource(this.a.colors, ["from lvl 2"]);
      expect(this.a.colors.items()).toEqual(["from lvl 1", "from lvl 2"]);
    }
  }

  class Level1 extends Component {
    static template = xml`1 | <Level2/>`;
    static components = { Level2 };

    setup() {
      const a = plugin(PluginA);
      useResource(a.colors, ["from lvl 1"]);
      expect(a.colors.items()).toEqual(["from lvl 1"]);
    }
  }

  const pluginManager = new PluginManager();
  pluginManager.startPlugins([PluginA]);
  const a = pluginManager.getPlugin(PluginA)!;
  expect(a.colors.items()).toEqual([]);

  await mount(Level1, fixture, { pluginManager });
  expect(a.colors.items()).toEqual(["from lvl 1", "from lvl 2"]);
  expect(fixture.innerHTML).toBe("1 | 2: from lvl 1|from lvl 2 ");
});
