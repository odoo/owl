import {
  App,
  Component,
  onError,
  onWillStart,
  Plugin,
  Portal,
  providePlugins,
  signal,
  usePlugin,
  xml,
} from "../../src";
import { PortalGroup } from "../../src/portal";
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

test("slot content is not re-rendered when the guard removing it flips", async () => {
  const target = makeOutside("portal-target-guard");
  target.dataset.testPortal = "1";

  const seen: boolean[] = [];

  class Popover extends Component {
    static components = { Portal };
    static template = xml`
      <Portal target="this.target">
        <t t-call-slot="default"/>
      </Portal>`;
    target = target;
  }

  class Root extends Component {
    static components = { Popover };
    static template = xml`
      <button>toggle</button>
      <Popover t-if="this.open()">open<t t-out="this.probe()"/></Popover>`;
    open = signal(false);
    probe() {
      seen.push(this.open());
      return "";
    }
  }

  const app = new App();
  const root = (await app.createRoot(Root).mount(fixture)) as InstanceType<typeof Root>;
  await nextTick();
  expect(seen).toEqual([]);

  root.open.set(true);
  await nextTick();
  expect(target.textContent).toBe("open");
  expect(seen).toEqual([true]);

  root.open.set(false);
  await nextTick();
  expect(target.textContent).toBe("");
  // The slot must never have been evaluated with the guard value that
  // removed it: the sub-root render has to yield to the ancestor's.
  expect(seen).toEqual([true]);
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
    foo = usePlugin(FooPlugin);
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

// -----------------------------------------------------------------------------
// ordered portals
// -----------------------------------------------------------------------------

function orderIn(target: HTMLElement): string {
  return [...target.querySelectorAll(".payload")].map((el) => el.textContent).join("");
}

test("position: content is placed in position order, not in mount order", async () => {
  const target = makeOutside("portal-position-1");
  target.dataset.testPortal = "1";
  const def = makeDeferred();

  class Slow extends Component {
    static template = xml`<span class="payload">A</span>`;
    setup() {
      onWillStart(() => def);
    }
  }

  class Root extends Component {
    static components = { Portal, Slow };
    static template = xml`
      <div class="src">
        <Portal target="this.target" position="0"><Slow/></Portal>
        <Portal target="this.target" position="1"><span class="payload">B</span></Portal>
      </div>
    `;
    target = target;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();

  // "A" is still held back by its onWillStart, so only "B" has mounted.
  expect(orderIn(target)).toBe("B");

  def.resolve();
  await nextTick();

  // Plain appending would have produced "BA".
  expect(orderIn(target)).toBe("AB");
  app.destroy();
});

test("position: a portal appearing later lands in the middle, not last", async () => {
  const target = makeOutside("portal-position-2");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="src">
        <Portal target="this.target" position="0"><span class="payload">A</span></Portal>
        <t t-if="this.showB()">
          <Portal target="this.target" position="1"><span class="payload">B</span></Portal>
        </t>
        <Portal target="this.target" position="2"><span class="payload">C</span></Portal>
      </div>
    `;
    target = target;
    showB = signal(false);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(orderIn(target)).toBe("AC");

  root.showB.set(true);
  await nextTick();

  // Plain appending would have produced "ACB".
  expect(orderIn(target)).toBe("ABC");
  app.destroy();
});

test("position: a keyed t-foreach reorder re-sorts the target", async () => {
  const target = makeOutside("portal-position-3");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="src">
        <Portal
          t-foreach="this.names()"
          t-as="name"
          t-key="name"
          target="this.target"
          position="name_index">
          <span class="payload"><t t-out="name"/></span>
        </Portal>
      </div>
    `;
    target = target;
    names = signal(["A", "B", "C"]);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(orderIn(target)).toBe("ABC");

  root.names.set(["C", "A", "B"]);
  await nextTick();
  expect(orderIn(target)).toBe("CAB");

  app.destroy();
});

test("position: the Portal may sit under any markup inside the reordered item", async () => {
  const target = makeOutside("portal-position-4");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="src">
        <div t-foreach="this.names()" t-as="name" t-key="name" class="wrap">
          <Portal target="this.target" position="name_index">
            <span class="payload"><t t-out="name"/></span>
          </Portal>
        </div>
      </div>
    `;
    target = target;
    names = signal(["A", "B", "C"]);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(orderIn(target)).toBe("ABC");

  // The reorder happens on the wrapping divs: the anchors the Portals leave
  // behind never change parent, and their own parents see no mutation at all.
  root.names.set(["C", "A", "B"]);
  await nextTick();
  expect(orderIn(target)).toBe("CAB");

  app.destroy();
});

test("position: removing one portal leaves the others in order", async () => {
  const target = makeOutside("portal-position-5");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="src">
        <Portal
          t-foreach="this.names()"
          t-as="name"
          t-key="name"
          target="this.target"
          position="name_index">
          <span class="payload"><t t-out="name"/></span>
        </Portal>
      </div>
    `;
    target = target;
    names = signal(["A", "B", "C"]);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();

  root.names.set(["C", "A"]);
  await nextTick();
  expect(orderIn(target)).toBe("CA");

  app.destroy();
});

test("position: multi-root content is placed as a unit", async () => {
  const target = makeOutside("portal-position-multi-1");
  target.dataset.testPortal = "1";
  const def = makeDeferred();

  class Slow extends Component {
    static template = xml`
      <span class="payload">A1</span>
      <span class="payload">A2</span>
    `;
    setup() {
      onWillStart(() => def);
    }
  }

  class Root extends Component {
    static components = { Portal, Slow };
    static template = xml`
      <div class="src">
        <Portal target="this.target" position="0"><Slow/></Portal>
        <Portal target="this.target" position="1">
          <span class="payload">B1</span>
          <span class="payload">B2</span>
        </Portal>
      </div>
    `;
    target = target;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(orderIn(target)).toBe("B1B2");

  def.resolve();
  await nextTick();

  // Every root of a portal's content moves with it: plain appending would have
  // produced "B1B2A1A2", and moving only the first node would interleave them.
  expect(orderIn(target)).toBe("A1A2B1B2");
  app.destroy();
});

test("position: a keyed reorder moves every root of each content", async () => {
  const target = makeOutside("portal-position-multi-2");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="src">
        <Portal
          t-foreach="this.names()"
          t-as="name"
          t-key="name"
          target="this.target"
          position="name_index">
          <span class="payload"><t t-out="name"/>1</span>
          <span class="payload"><t t-out="name"/>2</span>
        </Portal>
      </div>
    `;
    target = target;
    names = signal(["A", "B", "C"]);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(orderIn(target)).toBe("A1A2B1B2C1C2");

  root.names.set(["C", "A", "B"]);
  await nextTick();
  expect(orderIn(target)).toBe("C1C2A1A2B1B2");

  app.destroy();
  await nextTick();
  expect(target.innerHTML).toBe("");
});

test("position: a content whose first root appears later stays in place", async () => {
  const target = makeOutside("portal-position-multi-3");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="src">
        <Portal target="this.target" position="0">
          <span t-if="this.showA1()" class="payload">A1</span>
          <span class="payload">A2</span>
        </Portal>
        <Portal target="this.target" position="1">
          <span class="payload">B1</span>
        </Portal>
      </div>
    `;
    target = target;
    showA1 = signal(false);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();
  expect(orderIn(target)).toBe("A2B1");

  // The absent root leaves an anchor behind, so the content keeps a stable
  // first node and stays contiguous when the root fills in.
  root.showA1.set(true);
  await nextTick();
  expect(orderIn(target)).toBe("A1A2B1");
  app.destroy();
});

test("position: the group drains as portals go away", async () => {
  const target = makeOutside("portal-position-7");
  target.dataset.testPortal = "1";

  class Root extends Component {
    static components = { Portal };
    static template = xml`
      <div class="src">
        <Portal
          t-foreach="this.names()"
          t-as="name"
          t-key="name"
          target="this.target"
          position="name_index">
          <span class="payload"><t t-out="name"/></span>
        </Portal>
      </div>
    `;
    target = target;
    names = signal(["A", "B", "C"]);
  }

  const app = new App();
  const root = await app.createRoot(Root).mount(fixture);
  await nextTick();

  // The entries are held in a plain Set (placing means iterating them, and a
  // WeakSet is not iterable), so every way a portal can go away has to remove
  // its entry, or the group retains the portaled content forever.
  const group = PortalGroup.groups.get(target)!;
  expect(group.entries.size).toBe(3);

  root.names.set(["A"]);
  await nextTick();
  expect(group.entries.size).toBe(1);

  app.destroy();
  await nextTick();
  expect(group.entries.size).toBe(0);
  expect(target.innerHTML).toBe("");
});

test("portals without a position keep appending in mount order", async () => {
  const target = makeOutside("portal-position-6");
  target.dataset.testPortal = "1";
  const def = makeDeferred();

  class Slow extends Component {
    static template = xml`<span class="payload">A</span>`;
    setup() {
      onWillStart(() => def);
    }
  }

  class Root extends Component {
    static components = { Portal, Slow };
    static template = xml`
      <div class="src">
        <Portal target="this.target"><Slow/></Portal>
        <Portal target="this.target"><span class="payload">B</span></Portal>
      </div>
    `;
    target = target;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  await nextTick();

  def.resolve();
  await nextTick();

  // A stack of dialogs or toasts wants the order they opened in.
  expect(orderIn(target)).toBe("BA");
  app.destroy();
});
