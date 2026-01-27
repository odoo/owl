import {
  App,
  Component,
  mount,
  onWillDestroy,
  plugin,
  Plugin,
  props,
  useContext,
  xml,
} from "../../src";
import { makeDeferred, makeTestFixture, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("run", () => {
  test("capture plugin context", async () => {
    let context;

    class PluginA extends Plugin {
      setup() {
        context = useContext();
      }
    }

    class PluginB extends Plugin {
      value = 123;
    }

    const app = new App({ plugins: [PluginA] });
    expect(() => plugin(PluginB)).toThrow("No active context");

    let value = 0;
    context!.run(() => {
      const b = plugin(PluginB);
      value = b.value;
    });
    expect(value).toBe(123);

    app.destroy();
  });

  test("capture component context", async () => {
    let context;

    class PluginA extends Plugin {
      value = 123;
    }

    class Root extends Component {
      static template = xml``;

      setup() {
        context = useContext();
      }
    }

    await mount(Root, fixture, { plugins: [PluginA] });
    expect(() => plugin(PluginA)).toThrow("No active context");

    let value = 0;
    context!.run(() => {
      const a = plugin(PluginA);
      value = a.value;
    });
    expect(value).toBe(123);
  });

  test("fails if wrong context", async () => {
    let context;

    class PluginA extends Plugin {
      value = 123;

      setup() {
        context = useContext();
      }
    }

    const app = new App({ plugins: [PluginA] });
    expect(() => context!.run(() => props())).toThrow("Expected to be in a component context");

    app.destroy();
  });
});

describe("async protection", () => {
  test("call function after component is destroyed", async () => {
    const steps: string[] = [];
    let context;

    class Root extends Component {
      static template = xml``;

      setup() {
        steps.push("setup");
        context = useContext();
        onWillDestroy(() => {
          steps.push("destroy");
        });
      }
    }
    const app = new App();
    await app.createRoot(Root).mount(fixture);
    expect(steps.splice(0)).toEqual(["setup"]);

    app.destroy();
    expect(steps.splice(0)).toEqual(["destroy"]);

    expect(
      context!.runWithAsyncProtection(async () => {
        steps.push("crash");
      })
    ).rejects.toThrow("Function called after the end of life of the component");
    expect(steps.splice(0)).toEqual([]);
  });

  test("async function resolves before component is destroyed", async () => {
    const steps: string[] = [];
    let context;

    class Root extends Component {
      static template = xml``;

      setup() {
        steps.push("setup");
        context = useContext();
        onWillDestroy(() => {
          steps.push("destroy");
        });
      }
    }
    const app = new App();
    await app.createRoot(Root).mount(fixture);
    expect(steps.splice(0)).toEqual(["setup"]);

    const deferred = makeDeferred();
    context!
      .runWithAsyncProtection(() => deferred)
      .then(() => {
        steps.push("before deferred");
      });
    await nextTick();

    deferred.resolve();
    await nextTick();
    expect(steps.splice(0)).toEqual(["before deferred"]);

    app.destroy();
    expect(steps.splice(0)).toEqual(["destroy"]);
  });

  test("async function resolves after component is destroyed", async () => {
    const steps: string[] = [];
    let context;

    class Root extends Component {
      static template = xml``;

      setup() {
        steps.push("setup");
        context = useContext();
        onWillDestroy(() => {
          steps.push("destroy");
        });
      }
    }
    const app = new App();
    await app.createRoot(Root).mount(fixture);
    expect(steps.splice(0)).toEqual(["setup"]);

    const deferred = makeDeferred();
    context!
      .runWithAsyncProtection(() => deferred)
      .then(() => {
        steps.push("after deferred");
      });
    await nextTick();

    app.destroy();
    expect(steps.splice(0)).toEqual(["destroy"]);

    deferred.resolve();
    await nextTick();
    expect(steps.splice(0)).toEqual([]);
  });
});
