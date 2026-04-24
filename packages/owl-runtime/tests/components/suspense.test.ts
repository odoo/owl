import { beforeEach, expect, test } from "vitest";
import { App, Component, onError, onMounted, onWillStart, Suspense, xml } from "../../src";
import { makeDeferred, makeTestFixture, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

test("fallback shows while descendant willStart is pending", async () => {
  const rpc = makeDeferred<string>();

  class AsyncChild extends Component {
    static template = xml`<span t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async () => {
        this.data = await rpc;
      });
    }
  }

  class Root extends Component {
    static components = { Suspense, AsyncChild };
    static template = xml`
      <Suspense>
        <t t-set-slot="fallback">loading...</t>
        <AsyncChild/>
      </Suspense>
    `;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  expect(fixture.innerHTML).toContain("loading...");
  expect(fixture.innerHTML).not.toContain("<span>");

  rpc.resolve("done");
  await nextTick();
  await nextTick();
  expect(fixture.innerHTML).toContain("<span>done</span>");
  expect(fixture.innerHTML).not.toContain("loading...");
  app.destroy();
});

test("sync subtree shows content with no fallback flash", async () => {
  class SyncChild extends Component {
    static template = xml`<span>sync</span>`;
  }

  class Root extends Component {
    static components = { Suspense, SyncChild };
    static template = xml`
      <Suspense>
        <t t-set-slot="fallback">loading...</t>
        <SyncChild/>
      </Suspense>
    `;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  // The sub-root finished its render phase synchronously during Suspense's
  // setup, so the first render skips the fallback entirely.
  expect(fixture.innerHTML).toContain("<span>sync</span>");
  expect(fixture.innerHTML).not.toContain("loading...");
  await nextTick();
  expect(fixture.innerHTML).toContain("<span>sync</span>");
  expect(fixture.innerHTML).not.toContain("loading...");
  app.destroy();
});

test("nested Suspense: each shows its own fallback", async () => {
  const outerRpc = makeDeferred<string>();
  const innerRpc = makeDeferred<string>();

  class Inner extends Component {
    static template = xml`<span class="inner" t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async () => {
        this.data = await innerRpc;
      });
    }
  }

  class Outer extends Component {
    static components = { Suspense, Inner };
    static template = xml`
      <div class="outer" t-out="this.data"/>
      <Suspense>
        <t t-set-slot="fallback">inner-loading</t>
        <Inner/>
      </Suspense>
    `;
    data = "";
    setup() {
      onWillStart(async () => {
        this.data = await outerRpc;
      });
    }
  }

  class Root extends Component {
    static components = { Suspense, Outer };
    static template = xml`
      <Suspense>
        <t t-set-slot="fallback">outer-loading</t>
        <Outer/>
      </Suspense>
    `;
  }

  const app = new App();
  const mounted = app.createRoot(Root).mount(fixture);
  await mounted;
  expect(fixture.innerHTML).toContain("outer-loading");

  outerRpc.resolve("o");
  await nextTick();
  await nextTick();
  // Outer is now committed; inner Suspense shows its own fallback.
  expect(fixture.innerHTML).toContain("inner-loading");
  expect(fixture.innerHTML).toContain('class="outer"');

  innerRpc.resolve("i");
  await nextTick();
  await nextTick();
  expect(fixture.innerHTML).toContain('class="inner"');
  expect(fixture.innerHTML).not.toContain("inner-loading");
  app.destroy();
});

test("unmount during pending aborts descendant willStart", async () => {
  const rpc = makeDeferred<string>();
  let capturedSignal: AbortSignal | undefined;

  class AsyncChild extends Component {
    static template = xml`<span t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async ({ abortSignal }) => {
        capturedSignal = abortSignal;
        this.data = await rpc;
      });
    }
  }

  class Root extends Component {
    static components = { Suspense, AsyncChild };
    static template = xml`
      <Suspense>
        <t t-set-slot="fallback">loading...</t>
        <AsyncChild/>
      </Suspense>
    `;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  // AsyncChild willStart has been kicked off; signal exists and is alive.
  expect(capturedSignal).toBeDefined();
  expect(capturedSignal!.aborted).toBe(false);

  app.destroy();
  expect(capturedSignal!.aborted).toBe(true);
  rpc.resolve("late"); // let the pending promise settle
});

test("error in descendant willStart propagates to outer onError", async () => {
  let caught: any = null;

  class Broken extends Component {
    static template = xml`<span>ok</span>`;
    setup() {
      onWillStart(async () => {
        throw new Error("boom");
      });
    }
  }

  class Root extends Component {
    static components = { Suspense, Broken };
    static template = xml`
      <Suspense>
        <t t-set-slot="fallback">loading...</t>
        <Broken/>
      </Suspense>
    `;
    setup() {
      onError((e) => {
        caught = e;
      });
    }
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  await nextTick();
  expect(caught).toBeInstanceOf(Error);
  expect(caught.message).toBe("boom");
  app.destroy();
});

test("multiple sibling async descendants share the fallback", async () => {
  const r1 = makeDeferred<string>();
  const r2 = makeDeferred<string>();

  class ChildA extends Component {
    static template = xml`<span class="a" t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async () => {
        this.data = await r1;
      });
    }
  }
  class ChildB extends Component {
    static template = xml`<span class="b" t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async () => {
        this.data = await r2;
      });
    }
  }

  class Root extends Component {
    static components = { Suspense, ChildA, ChildB };
    static template = xml`
      <Suspense>
        <t t-set-slot="fallback">loading...</t>
        <ChildA/>
        <ChildB/>
      </Suspense>
    `;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(fixture.innerHTML).toContain("loading...");

  r1.resolve("a");
  await nextTick();
  await nextTick();
  // Only one resolved — fallback still shown (RootFiber counter > 0).
  expect(fixture.innerHTML).toContain("loading...");

  r2.resolve("b");
  await nextTick();
  await nextTick();
  expect(fixture.innerHTML).toContain('class="a"');
  expect(fixture.innerHTML).toContain('class="b"');
  expect(fixture.innerHTML).not.toContain("loading...");
  app.destroy();
});

test("descendant willStart runs in parallel with async sibling", async () => {
  const order: string[] = [];
  const siblingRpc = makeDeferred<string>();
  const descendantRpc = makeDeferred<string>();

  class AsyncSibling extends Component {
    static template = xml`<span class="sibling"/>`;
    setup() {
      onWillStart(async () => {
        order.push("sibling:start");
        await siblingRpc;
        order.push("sibling:end");
      });
    }
  }

  class Descendant extends Component {
    static template = xml`<span class="descendant"/>`;
    setup() {
      onWillStart(async () => {
        order.push("descendant:start");
        await descendantRpc;
        order.push("descendant:end");
      });
    }
  }

  class Root extends Component {
    static components = { Suspense, AsyncSibling, Descendant };
    static template = xml`
      <AsyncSibling/>
      <Suspense>
        <t t-set-slot="fallback">loading...</t>
        <Descendant/>
      </Suspense>
    `;
  }

  const app = new App();
  app.createRoot(Root).mount(fixture);

  // Both willStarts kicked off in parallel, before anything mounted.
  await nextTick();
  expect(order).toContain("sibling:start");
  expect(order).toContain("descendant:start");

  // Descendant resolves first; nothing visible yet because Root hasn't mounted.
  descendantRpc.resolve("d");
  await nextTick();
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  expect(order).toContain("descendant:end");

  // Sibling resolves — Root mounts, Suspense shows content (descendant already
  // ready), fallback is not observed after mount.
  siblingRpc.resolve("s");
  await nextTick();
  await nextTick();
  expect(fixture.innerHTML).toContain('class="sibling"');
  expect(fixture.innerHTML).toContain('class="descendant"');
  app.destroy();
});

test("descendant onMounted sees final DOM (attached, not detached)", async () => {
  let parentAtMount: Node | null = null;
  let isConnectedAtMount = false;

  class AsyncChild extends Component {
    static template = xml`<span class="child"/>`;
    setup() {
      onWillStart(async () => {
        await Promise.resolve();
      });
      onMounted(() => {
        const el = fixture.querySelector(".child") as HTMLElement | null;
        if (el) {
          parentAtMount = el.parentNode;
          isConnectedAtMount = el.isConnected;
        }
      });
    }
  }

  class Root extends Component {
    static components = { Suspense, AsyncChild };
    static template = xml`
      <Suspense>
        <t t-set-slot="fallback">loading...</t>
        <AsyncChild/>
      </Suspense>
    `;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  await nextTick();
  expect(parentAtMount).not.toBe(null);
  expect(isConnectedAtMount).toBe(true);
  app.destroy();
});

test("fallback slot is optional", async () => {
  class SyncChild extends Component {
    static template = xml`<span>ok</span>`;
  }
  class Root extends Component {
    static components = { Suspense, SyncChild };
    static template = xml`
      <Suspense>
        <SyncChild/>
      </Suspense>
    `;
  }

  const app = new App({ test: true });
  await app.createRoot(Root).mount(fixture);
  expect(fixture.innerHTML).toContain("<span>ok</span>");
  app.destroy();
});
