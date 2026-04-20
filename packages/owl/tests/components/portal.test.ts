import {
  App,
  Component,
  onError,
  onWillStart,
  Plugin,
  Portal,
  plugin,
  providePlugins,
  signal,
  xml,
} from "../../src";
import { makeDeferred, makeTestFixture, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

function makeOutside(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.querySelectorAll("[data-test-portal]").forEach((el) => el.remove());
});

test("renders nothing in place; mounts content into target Element", async () => {
  const target = makeOutside("portal-target-1");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="root">
        <Portal target="this.target">
          <span class="payload">hello</span>
        </Portal>
      </div>
    `;
    target = target;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();

  expect(fixture.innerHTML).toBe(`<div class="root"></div>`);
  expect(target.innerHTML).toContain(`<span class="payload">hello</span>`);
  app.destroy();
});

test("accepts a CSS selector string as target", async () => {
  const target = makeOutside("portal-target-2");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <Portal target="'#portal-target-2'">
        <span class="payload">via selector</span>
      </Portal>
    `;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();

  expect(target.innerHTML).toContain(`via selector`);
  app.destroy();
});

test("ref signal: waits for target to appear, then mounts", async () => {
  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="here" t-ref="this.targetRef"/>
      <Portal target="this.targetRef">
        <span class="payload">deferred</span>
      </Portal>
    `;
    targetRef = signal(null);
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  await nextTick();

  // Target is the in-tree <div class="here"> bound by t-ref. Once the parent
  // mounts, the ref fills in, the Portal's effect re-fires, and the content
  // commits inside that div.
  const here = fixture.querySelector(".here")!;
  expect(here.innerHTML).toContain(`<span class="payload">deferred</span>`);
  app.destroy();
});

test("slot content reads signals from outer (parent) scope", async () => {
  const target = makeOutside("portal-target-3");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <Portal target="this.target">
        <span class="payload" t-out="this.count()"/>
      </Portal>
    `;
    target = target;
    count = signal(0);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(target.querySelector(".payload")!.textContent).toBe("0");

  root.count.set(7);
  await nextTick();
  await nextTick();
  expect(target.querySelector(".payload")!.textContent).toBe("7");

  app.destroy();
});

test("forwards plugin chain: providePlugins ancestor is visible to portaled content", async () => {
  const target = makeOutside("portal-target-4");
  target.dataset.testPortal = "1";

  class FooPlugin extends Plugin {
    value = "from plugin";
  }

  let inside: any = null;
  class Inside extends Component {
    static template = xml`<span class="payload" t-out="this.foo.value"/>`;
    foo = plugin(FooPlugin);
    setup() {
      inside = this;
    }
  }

  class Root extends Component {
    static components = { Portal, Inside };
    static template = xml`
      <Portal target="this.target">
        <Inside/>
      </Portal>
    `;
    target = target;
    setup() {
      providePlugins([FooPlugin]);
    }
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();

  expect(inside).not.toBeNull();
  expect(inside.foo.value).toBe("from plugin");
  expect(target.querySelector(".payload")!.textContent).toBe("from plugin");

  app.destroy();
});

test("target signal change: tears down old root, mounts at new", async () => {
  const t1 = makeOutside("portal-target-5a");
  const t2 = makeOutside("portal-target-5b");
  t1.dataset.testPortal = "1";
  t2.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <Portal target="this.target">
        <span class="payload">x</span>
      </Portal>
    `;
    target = signal<HTMLElement | null>(t1);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();

  expect(t1.innerHTML).toContain("payload");
  expect(t2.innerHTML).toBe("");

  root.target.set(t2);
  await nextTick();
  await nextTick();

  expect(t1.innerHTML).toBe("");
  expect(t2.innerHTML).toContain("payload");

  app.destroy();
});

test("target signal flipping to null tears down the portal", async () => {
  const t1 = makeOutside("portal-target-6");
  t1.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <Portal target="this.target">
        <span class="payload">x</span>
      </Portal>
    `;
    target = signal<HTMLElement | null>(t1);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(t1.innerHTML).toContain("payload");

  root.target.set(null);
  await nextTick();
  await nextTick();
  expect(t1.innerHTML).toBe("");

  app.destroy();
});

test("portal teardown removes content from target on app destroy", async () => {
  const target = makeOutside("portal-target-7");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <Portal target="this.target">
        <span class="payload">x</span>
      </Portal>
    `;
    target = target;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(target.innerHTML).toContain("payload");

  app.destroy();
  await nextTick();
  expect(target.innerHTML).toBe("");
});

test("multiple portals to the same target stack as siblings", async () => {
  const target = makeOutside("portal-target-8");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <Portal target="this.target">
        <span class="a">A</span>
      </Portal>
      <Portal target="this.target">
        <span class="b">B</span>
      </Portal>
    `;
    target = target;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();

  expect(target.querySelector(".a")?.textContent).toBe("A");
  expect(target.querySelector(".b")?.textContent).toBe("B");

  app.destroy();
});

test("error in portaled content propagates to outer onError", async () => {
  const target = makeOutside("portal-target-9");
  target.dataset.testPortal = "1";

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
    static components = { Portal, Broken };
    static template = xml`
      <Portal target="this.target">
        <Broken/>
      </Portal>
    `;
    target = target;
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

test("waits for descendant onWillStart before mounting", async () => {
  const target = makeOutside("portal-target-10");
  target.dataset.testPortal = "1";
  const rpc = makeDeferred<string>();

  class AsyncChild extends Component {
    static template = xml`<span class="payload" t-out="this.data"/>`;
    data = "";
    setup() {
      onWillStart(async () => {
        this.data = await rpc;
      });
    }
  }

  class Root extends Component {
    static components = { Portal, AsyncChild };
    static template = xml`
      <Portal target="this.target">
        <AsyncChild/>
      </Portal>
    `;
    target = target;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  // Outer mount completed, but the portal's content is still loading.
  expect(target.innerHTML).toBe("");

  rpc.resolve("ready");
  await nextTick();
  await nextTick();
  expect(target.querySelector(".payload")!.textContent).toBe("ready");

  app.destroy();
});
