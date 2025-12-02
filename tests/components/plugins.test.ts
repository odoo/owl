import { Component, mount, plugin, Plugin, PluginManager, usePlugins, xml } from "../../src";
import { makeTestFixture, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();
beforeEach(() => {
  fixture = makeTestFixture();
});

test("basic use", async () => {
  class PluginA extends Plugin {
    static id = "a";
    value = "value from plugin";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.value"/>`;
    a = plugin(PluginA);
  }

  const pluginManager = new PluginManager(null);
  pluginManager.startPlugins([PluginA]);

  await mount(Test, fixture, { pluginManager });
  expect(fixture.innerHTML).toBe("value from plugin");
});

test("basic use (setup)", async () => {
  class PluginA extends Plugin {
    static id = "a";
    value = "value from plugin";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.value"/>`;
    declare a: PluginA;

    setup() {
      this.a = plugin(PluginA);
    }
  }

  const pluginManager = new PluginManager(null);
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
    declare a: PluginA;

    setup() {
      try {
        this.a = plugin(PluginA);
      } catch (e) {
        steps.push((e as Error).message);
      }
    }
  }

  const pluginManager = new PluginManager(null);
  await mount(Test, fixture, { pluginManager });

  expect(steps.splice(0)).toEqual([`Unknown plugin "a"`]);
});

test("components can start plugins", async () => {
  class PluginA extends Plugin {
    static id = "a";
    value = "value from plugin A";
  }

  class PluginB extends Plugin {
    static id = "b";
    value = "value from plugin B";
  }

  class Test extends Component {
    static template = xml`<t t-out="this.a.value"/> - <t t-out="this.b.value"/>`;
    declare a: PluginA;
    declare b: PluginB;

    setup() {
      this.a = plugin(PluginA); // PluginA is already started, we can get it
      // PluginB is not started yet so we'll crash if we try to get it (tested in a previous test)

      usePlugins([PluginB]);
      this.b = plugin(PluginB); // PluginB is now started, we can get it
    }
  }

  const pluginManager = new PluginManager(null);
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
      usePlugins([PluginB]);
    }
  }

  class Level1 extends Component {
    static template = xml`1 | <Level2/>`;
    static components = { Level2 };

    setup() {
      usePlugins([PluginA]);
    }
  }

  const pluginManager = new PluginManager(null);

  await mount(Level1, fixture, { pluginManager });
  expect(pluginManager.getPlugin("a")).toBe(null);
  expect(pluginManager.getPlugin("b")).toBe(null);
  expect(fixture.innerHTML).toBe("1 | 2: pA | 3: pA - pB");
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
      usePlugins([ShadowPluginA]);
    }
  }

  class Level1 extends Component {
    static template = xml`<t t-out="this.a.value"/> | <Level2/>`;
    static components = { Level2 };

    a = plugin(PluginA);
  }

  const pluginManager = new PluginManager(null);
  pluginManager.startPlugins([PluginA]);

  await mount(Level1, fixture, { pluginManager });
  expect(fixture.innerHTML).toBe("a | shadow");
});
