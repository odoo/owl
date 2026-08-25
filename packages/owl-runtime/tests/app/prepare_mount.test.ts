import { App, Component, onMounted, onWillDestroy, onWillStart, status, xml } from "../../src";
import { makeDeferred, makeTestFixture, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

test("prepare() kicks off willStart before mount is called", async () => {
  const steps: string[] = [];
  const rpc = makeDeferred<string>();

  class Root extends Component {
    static template = xml`<span t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async () => {
        steps.push("willStart:start");
        this.data = await rpc;
        steps.push("willStart:end");
      });
      onMounted(() => steps.push("mounted"));
    }
  }

  const app = new App();
  const root = app.createRoot(Root);
  const prepared = root.prepare();

  // willStart fires immediately, before any mount.
  await nextTick();
  expect(steps).toEqual(["willStart:start"]);
  expect(fixture.innerHTML).toBe("");

  // Resolve RPC — render phase finishes.
  rpc.resolve("hello");
  await prepared;
  expect(steps).toEqual(["willStart:start", "willStart:end"]);
  // Still not mounted — mount has not been called.
  expect(fixture.innerHTML).toBe("");

  // Mount now attaches to the DOM and fires onMounted.
  await root.mount(fixture);
  expect(steps).toEqual(["willStart:start", "willStart:end", "mounted"]);
  expect(fixture.innerHTML).toBe("<span>hello</span>");
  app.destroy();
});

test("prepare() is idempotent", async () => {
  class Root extends Component {
    static template = xml`<span>ok</span>`;
  }

  const app = new App();
  const root = app.createRoot(Root);
  const p1 = root.prepare();
  const p2 = root.prepare();
  expect(p1).toBe(p2);
  await p1;
  await root.mount(fixture);
  expect(fixture.innerHTML).toBe("<span>ok</span>");
  app.destroy();
});

test("mount() without prior prepare() prepares internally", async () => {
  class Root extends Component {
    static template = xml`<span>ok</span>`;
  }

  const app = new App();
  const root = app.createRoot(Root);
  // No prepare() — mount() triggers it.
  await root.mount(fixture);
  expect(fixture.innerHTML).toBe("<span>ok</span>");
  app.destroy();
});

test("destroy() without mount() cleans up the prepared fiber", async () => {
  let destroyed = false;

  class Root extends Component {
    static template = xml`<span>ok</span>`;
    setup() {
      // Use onWillDestroy via a raw hook to observe destroy.
      this.__owl__.onDestroy(() => {
        destroyed = true;
      });
    }
  }

  const app = new App();
  const root = app.createRoot(Root);
  await root.prepare();
  // Never mount.
  root.destroy();
  expect(destroyed).toBe(true);
  app.destroy();
});

test("mount() validates the target, prepare() does not", async () => {
  class Root extends Component {
    static template = xml`<span>ok</span>`;
  }

  const app = new App();
  const root = app.createRoot(Root);
  // prepare does not touch the DOM — invalid target is fine until mount.
  await root.prepare();
  const detached = document.createElement("div"); // not attached to document
  expect(() => root.mount(detached)).toThrow(/detached/);
  app.destroy();
});

test("prepare-then-mount renders in parallel with another root", async () => {
  const order: string[] = [];
  const aRpc = makeDeferred<string>();
  const bRpc = makeDeferred<string>();

  class A extends Component {
    static template = xml`<span class="a"/>`;
    setup() {
      onWillStart(async () => {
        order.push("a:start");
        await aRpc;
        order.push("a:end");
      });
    }
  }

  class B extends Component {
    static template = xml`<span class="b"/>`;
    setup() {
      onWillStart(async () => {
        order.push("b:start");
        await bRpc;
        order.push("b:end");
      });
    }
  }

  const app = new App();
  const rootA = app.createRoot(A);
  const rootB = app.createRoot(B);
  // Both prepare in parallel — willStarts fire immediately.
  rootA.prepare();
  rootB.prepare();
  await nextTick();
  expect(order).toEqual(["a:start", "b:start"]);

  // Resolve in reverse order; both complete independently.
  bRpc.resolve("b");
  await nextTick();
  await nextTick();
  expect(order).toContain("b:end");

  aRpc.resolve("a");
  await nextTick();
  await nextTick();
  expect(order).toContain("a:end");
  app.destroy();
});

test("mount() after destroy() is a no-op", async () => {
  const steps: string[] = [];

  class Root extends Component {
    static template = xml`<span>ok</span>`;
    setup() {
      onMounted(() => steps.push("mounted"));
      onWillDestroy(() => steps.push("willDestroy"));
    }
  }

  const app = new App();
  const root = app.createRoot(Root);
  await root.prepare();
  root.destroy();
  expect(root.destroyed).toBe(true);

  // The target is perfectly valid here: nothing but the destroyed flag stops
  // the commit from resurrecting the finalized subtree.
  let mounted = false;
  root.mount(fixture).then(() => (mounted = true));
  await nextTick();
  expect(steps).toEqual(["willDestroy"]);
  expect(fixture.innerHTML).toBe("");
  // The mount was cancelled, not completed: its promise never settles.
  expect(mounted).toBe(false);
  app.destroy();
});

test("mount() after destroy() does not validate the target", async () => {
  class Root extends Component {
    static template = xml`<span>ok</span>`;
  }

  const app = new App();
  const root = app.createRoot(Root);
  await root.prepare();
  root.destroy();
  // A teardown often detaches the target before the root is destroyed: that
  // must not turn into a mount-time crash.
  const detached = document.createElement("div");
  expect(() => root.mount(detached)).not.toThrow();
  app.destroy();
});

test("destroy() while the render phase is pending resolves prepare()", async () => {
  const steps: string[] = [];
  const rpc = makeDeferred<string>();

  class Root extends Component {
    static template = xml`<span t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async () => {
        this.data = await rpc;
        steps.push("willStart:end");
      });
      onMounted(() => steps.push("mounted"));
    }
  }

  const app = new App();
  const root = app.createRoot(Root);
  const prepared = root.prepare();
  await nextTick();

  // Destroyed mid-render: the scheduler will drop the fiber, so complete()
  // never runs and prepare() would otherwise hang forever.
  root.destroy();
  rpc.resolve("hello");
  await prepared;

  root.mount(fixture);
  await nextTick();
  expect(steps).toEqual(["willStart:end"]);
  expect(fixture.innerHTML).toBe("");
  app.destroy();
});

test("prepare() after destroy() does not start a render", async () => {
  const steps: string[] = [];

  class Root extends Component {
    static template = xml`<span>ok</span>`;
    setup() {
      onWillStart(() => steps.push("willStart"));
    }
  }

  const app = new App();
  const root = app.createRoot(Root);
  root.destroy();

  const p1 = root.prepare();
  const p2 = root.prepare();
  expect(p1).toBe(p2);
  await p1;
  expect(steps).toEqual([]);
  expect(root.prepared).toBe(false);
  app.destroy();
});

test("destroy() is idempotent and keeps the component destroyed", async () => {
  const steps: string[] = [];

  class Root extends Component {
    static template = xml`<span>ok</span>`;
    setup() {
      onWillDestroy(() => steps.push("willDestroy"));
    }
  }

  const app = new App();
  const root = app.createRoot(Root);
  const component = await root.mount(fixture);
  expect(fixture.innerHTML).toBe("<span>ok</span>");

  root.destroy();
  root.destroy();
  expect(steps).toEqual(["willDestroy"]);
  expect(fixture.innerHTML).toBe("");
  expect(status(component)).toBe("destroyed");

  root.mount(fixture);
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  expect(status(component)).toBe("destroyed");
  app.destroy();
});
