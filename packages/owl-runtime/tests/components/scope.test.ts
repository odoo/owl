import {
  App,
  Component,
  onWillDestroy,
  onWillStart,
  plugin,
  Plugin,
  useScope,
  xml,
} from "../../src";
import { makeDeferred, makeTestFixture, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

test("component scope is set during setup", async () => {
  class PluginA extends Plugin {
    value = 123;
  }

  class Root extends Component {
    static template = xml``;
    a = plugin(PluginA);
  }

  const app = new App({ plugins: [PluginA] });
  const root = await app.createRoot(Root).mount(fixture);
  expect(root.a.value).toBe(123);
  app.destroy();
});

describe("useScope", () => {
  test("captures plugin scope", async () => {
    let captured: any;

    class PluginA extends Plugin {
      setup() {
        captured = useScope();
      }
    }

    class PluginB extends Plugin {
      value = 123;
    }

    const app = new App({ plugins: [PluginA] });
    expect(() => plugin(PluginB)).toThrow("No active scope");

    let value = 0;
    captured!.run(() => {
      const b = plugin(PluginB);
      value = b.value;
    });
    expect(value).toBe(123);

    app.destroy();
  });

  test("captures component scope", async () => {
    let captured: any;

    class PluginA extends Plugin {
      value = 123;
    }

    class Root extends Component {
      static template = xml``;

      setup() {
        captured = useScope();
      }
    }

    const app = new App({ plugins: [PluginA] });
    await app.createRoot(Root).mount(fixture);
    expect(() => plugin(PluginA)).toThrow("No active scope");

    let value = 0;
    captured!.run(() => {
      const a = plugin(PluginA);
      value = a.value;
    });
    expect(value).toBe(123);
    app.destroy();
  });

  test("throws outside any scope", () => {
    expect(() => useScope()).toThrow("No active scope");
  });
});

describe("async cancellation via signal", () => {
  test("signal.throwIfAborted throws after component destroy", async () => {
    let scope: any;

    class Root extends Component {
      static template = xml``;

      setup() {
        scope = useScope();
      }
    }
    const app = new App();
    await app.createRoot(Root).mount(fixture);

    const signal = scope!.abortSignal;
    expect(signal.aborted).toBe(false);

    app.destroy();
    expect(signal.aborted).toBe(true);
    expect(() => signal.throwIfAborted()).toThrow();
  });

  test("scope.until() rejects with AbortError after component destroy", async () => {
    const steps: string[] = [];
    let scope: any;

    class Root extends Component {
      static template = xml``;

      setup() {
        steps.push("setup");
        scope = useScope();
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

    const deferred = makeDeferred();
    await expect(scope!.until(deferred as Promise<unknown>)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  test("scope.until() resolves normally if scope is alive", async () => {
    const steps: string[] = [];
    let scope: any;

    class Root extends Component {
      static template = xml``;

      setup() {
        scope = useScope();
      }
    }
    const app = new App();
    await app.createRoot(Root).mount(fixture);

    const deferred = makeDeferred();
    scope!.until(deferred as Promise<unknown>).then(() => {
      steps.push("resolved");
    });
    await nextTick();

    deferred.resolve(42);
    await nextTick();
    expect(steps).toEqual(["resolved"]);
    app.destroy();
  });

  test("scope.until() method cancels chain when destroyed", async () => {
    const steps: string[] = [];

    class Root extends Component {
      static template = xml``;

      setup() {
        const scope = useScope();
        onWillStart(async () => {
          try {
            steps.push("before-rpc1");
            await scope.until(rpc1);
            steps.push("between");
            await scope.until(rpc2);
            steps.push("after-rpc2");
          } finally {
            steps.push("finally");
          }
        });
      }
    }

    const rpc1 = makeDeferred();
    const rpc2 = makeDeferred();
    const app = new App();
    app.createRoot(Root).mount(fixture);
    await nextTick();
    expect(steps).toEqual(["before-rpc1"]);

    app.destroy();
    rpc1.resolve("r1");
    await nextTick();
    await nextTick();

    expect(steps).toEqual(["before-rpc1", "finally"]);
    expect(rpc2).toBeDefined();
  });
});

describe("async cancellation via throwIfAborted", () => {
  test("throwIfAborted stops chain between awaits", async () => {
    const steps: string[] = [];

    class Root extends Component {
      static template = xml``;

      setup() {
        onWillStart(async ({ abortSignal }) => {
          try {
            steps.push("start");
            await rpc1;
            abortSignal.throwIfAborted();
            steps.push("after-rpc1");
          } finally {
            steps.push("finally");
          }
        });
      }
    }

    const rpc1 = makeDeferred();
    const app = new App();
    app.createRoot(Root).mount(fixture);
    await nextTick();
    expect(steps).toEqual(["start"]);

    app.destroy();
    rpc1.resolve("r1");
    await nextTick();
    await nextTick();

    expect(steps).toEqual(["start", "finally"]);
  });
});

describe("nested app mount", () => {
  test("mounting an inner app inside a hook works without saveContext", async () => {
    const inner = document.createElement("div");
    fixture.appendChild(inner);

    class Inner extends Component {
      static template = xml`<span>inner</span>`;
    }

    class Outer extends Component {
      static template = xml`<div>outer</div>`;

      setup() {
        let innerApp: App | null = null;
        onWillStart(async () => {
          innerApp = new App();
          await innerApp.createRoot(Inner).mount(inner);
        });
        onWillDestroy(() => innerApp?.destroy());
      }
    }

    const app = new App();
    await app.createRoot(Outer).mount(fixture);
    expect(fixture.innerHTML).toContain("inner");
    expect(fixture.innerHTML).toContain("outer");
    app.destroy();
  });
});

describe("plugin scope", () => {
  test("plugin destruction aborts its scope", async () => {
    let pluginSignal: AbortSignal | undefined;

    class PluginA extends Plugin {
      setup() {
        pluginSignal = useScope().abortSignal;
      }
    }

    const app = new App({ plugins: [PluginA] });
    expect(pluginSignal!.aborted).toBe(false);

    app.destroy();
    expect(pluginSignal!.aborted).toBe(true);
  });
});
