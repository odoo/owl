import { beforeEach, expect, it, test } from "vitest";
import { App, Component, onMounted, onWillStart, xml } from "../../src";
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
