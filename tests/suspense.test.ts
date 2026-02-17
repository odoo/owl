import {
  Component,
  mount,
  xml,
  onWillStart,
  onWillUpdateProps,
  onMounted,
  onWillPatch,
  onPatched,
  props,
  proxy,
  Suspense,
} from "../src";
import {
  makeTestFixture,
  nextTick,
  makeDeferred,
  // steps,
  logStep,
} from "./helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("Suspense", () => {
  // ---------------------------------------------------------------------------
  //  Sync content
  // ---------------------------------------------------------------------------

  test("sync content is shown directly, no fallback", async () => {
    class Child extends Component {
      static template = xml`<div>content</div>`;
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <Child/>
          <t t-set-slot="fallback">Loading...</t>
        </Suspense>`;
      static components = { Suspense, Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>content</div>");
  });

  // ---------------------------------------------------------------------------
  //  Async content (delay=0, default)
  // ---------------------------------------------------------------------------

  test("async content: fallback shown immediately (delay=0), then swapped", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div>async content</div>`;
      setup() {
        onWillStart(() => def);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <AsyncChild/>
          <t t-set-slot="fallback"><span>loading</span></t>
        </Suspense>`;
      static components = { Suspense, AsyncChild };
    }

    const prom = mount(Parent, fixture);
    await nextTick();
    // Fallback should be visible while content is loading
    expect(fixture.innerHTML).toBe("<span>loading</span>");

    def.resolve();
    await prom;
    await nextTick();
    // Content should replace fallback
    expect(fixture.innerHTML).toBe("<div>async content</div>");
  });

  // ---------------------------------------------------------------------------
  //  Async content with delay > 0
  // ---------------------------------------------------------------------------

  test("async content with delay: no fallback flash if content resolves before delay", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div>fast content</div>`;
      setup() {
        onWillStart(() => def);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense delay="5000">
          <AsyncChild/>
          <t t-set-slot="fallback"><span>loading</span></t>
        </Suspense>`;
      static components = { Suspense, AsyncChild };
    }

    const prom = mount(Parent, fixture);
    await nextTick();
    // Neither content nor fallback should be visible yet (delay hasn't expired)
    expect(fixture.innerHTML).toBe("");

    // Resolve before delay expires
    def.resolve();
    await prom;
    await nextTick();
    // Content should appear without ever showing fallback
    expect(fixture.innerHTML).toBe("<div>fast content</div>");
  });

  test("async content with delay: fallback shown after delay expires", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div>slow content</div>`;
      setup() {
        onWillStart(() => def);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense delay="10">
          <AsyncChild/>
          <t t-set-slot="fallback"><span>loading</span></t>
        </Suspense>`;
      static components = { Suspense, AsyncChild };
    }

    const prom = mount(Parent, fixture);
    await nextTick();
    // Before delay: nothing visible
    expect(fixture.innerHTML).toBe("");

    // Wait for delay to expire
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Fallback should now be visible
    expect(fixture.innerHTML).toBe("<span>loading</span>");

    // Resolve content
    def.resolve();
    await prom;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>slow content</div>");
  });

  // ---------------------------------------------------------------------------
  //  Update: keep old content visible (stale content)
  // ---------------------------------------------------------------------------

  test("update: old content stays visible while new content loads", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div><t t-out="this.props.value"/></div>`;
      props = props();
      setup() {
        onWillUpdateProps(() => def);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <AsyncChild value="this.state.val"/>
          <t t-set-slot="fallback"><span>loading</span></t>
        </Suspense>`;
      static components = { Suspense, AsyncChild };
      state = proxy({ val: "initial" });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>initial</div>");

    // Trigger update with async onWillUpdateProps
    parent.state.val = "updated";
    await nextTick();
    // Old content should still be visible (not fallback)
    expect(fixture.innerHTML).toBe("<div>initial</div>");

    // Resolve the update
    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>updated</div>");
  });

  // ---------------------------------------------------------------------------
  //  Lifecycle hooks
  // ---------------------------------------------------------------------------

  test("lifecycle hooks are called correctly for async content", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div>content</div>`;
      setup() {
        onWillStart(() => {
          logStep("child:willStart");
          return def;
        });
        onMounted(() => {
          logStep("child:mounted");
        });
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <AsyncChild/>
          <t t-set-slot="fallback"><span>loading</span></t>
        </Suspense>`;
      static components = { Suspense, AsyncChild };
    }

    const prom = mount(Parent, fixture);
    await nextTick();
    expect(["child:willStart"]).toBeLogged();

    def.resolve();
    await prom;
    await nextTick();
    expect(["child:mounted"]).toBeLogged();
  });

  test("willPatch and patched hooks called on content update", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div><t t-out="this.props.value"/></div>`;
      props = props();
      setup() {
        onWillUpdateProps(() => def);
        onWillPatch(() => logStep("child:willPatch"));
        onPatched(() => logStep("child:patched"));
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <AsyncChild value="this.state.val"/>
          <t t-set-slot="fallback"><span>loading</span></t>
        </Suspense>`;
      static components = { Suspense, AsyncChild };
      state = proxy({ val: "a" });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>a</div>");

    parent.state.val = "b";
    await nextTick();
    // No hooks yet (still loading)
    expect(fixture.innerHTML).toBe("<div>a</div>");

    def.resolve();
    await nextTick();
    expect(["child:willPatch", "child:patched"]).toBeLogged();
    expect(fixture.innerHTML).toBe("<div>b</div>");
  });

  // ---------------------------------------------------------------------------
  //  Multiple children in content slot
  // ---------------------------------------------------------------------------

  test("multiple sync children in content slot", async () => {
    class ChildA extends Component {
      static template = xml`<span>A</span>`;
    }
    class ChildB extends Component {
      static template = xml`<span>B</span>`;
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <ChildA/><ChildB/>
          <t t-set-slot="fallback">loading</t>
        </Suspense>`;
      static components = { Suspense, ChildA, ChildB };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>A</span><span>B</span>");
  });

  // ---------------------------------------------------------------------------
  //  Nested Suspense
  // ---------------------------------------------------------------------------

  test("nested Suspense: inner catches inner async, outer catches outer", async () => {
    const outerDef = makeDeferred();
    const innerDef = makeDeferred();

    class OuterAsync extends Component {
      static template = xml`<div>outer content</div>`;
      setup() {
        onWillStart(() => outerDef);
      }
    }

    class InnerAsync extends Component {
      static template = xml`<span>inner content</span>`;
      setup() {
        onWillStart(() => innerDef);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <OuterAsync/>
          <Suspense>
            <InnerAsync/>
            <t t-set-slot="fallback">inner loading</t>
          </Suspense>
          <t t-set-slot="fallback">outer loading</t>
        </Suspense>`;
      static components = { Suspense, OuterAsync, InnerAsync };
    }

    const prom = mount(Parent, fixture);
    await nextTick();
    // Outer fallback shown (outer content is async)
    expect(fixture.innerHTML).toBe("outer loading");

    // Resolve outer, but inner is still pending
    outerDef.resolve();
    await nextTick();
    await nextTick();
    // Outer content resolves, inner Suspense shows its fallback
    expect(fixture.innerHTML).toContain("outer content");
    expect(fixture.innerHTML).toContain("inner loading");

    // Resolve inner
    innerDef.resolve();
    await prom;
    await nextTick();
    expect(fixture.innerHTML).toContain("outer content");
    expect(fixture.innerHTML).toContain("inner content");
  });

  // ---------------------------------------------------------------------------
  //  Content toggling
  // ---------------------------------------------------------------------------

  test("toggling content with t-if inside Suspense", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div>async child</div>`;
      setup() {
        onWillStart(() => def);
      }
    }

    class SyncChild extends Component {
      static template = xml`<div>sync child</div>`;
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <AsyncChild t-if="this.state.showAsync"/>
          <SyncChild t-if="!this.state.showAsync"/>
          <t t-set-slot="fallback"><span>loading</span></t>
        </Suspense>`;
      static components = { Suspense, AsyncChild, SyncChild };
      state = proxy({ showAsync: false });
    }

    const parent = await mount(Parent, fixture);
    // Sync child visible immediately
    expect(fixture.innerHTML).toBe("<div>sync child</div>");

    // Switch to async child
    parent.state.showAsync = true;
    await nextTick();
    // Old content (sync) should still be visible while async loads
    // (or fallback if first mount of async child)
    // Actually, since AsyncChild is NEW, its willStart will run
    // and the boundary won't be ready
    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>async child</div>");
  });

  // ---------------------------------------------------------------------------
  //  No fallback slot
  // ---------------------------------------------------------------------------

  test("works without explicit fallback slot", async () => {
    const def = makeDeferred();

    class AsyncChild extends Component {
      static template = xml`<div>content</div>`;
      setup() {
        onWillStart(() => def);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <AsyncChild/>
        </Suspense>`;
      static components = { Suspense, AsyncChild };
    }

    const prom = mount(Parent, fixture);
    await nextTick();
    // No fallback, so empty or placeholder
    expect(fixture.innerHTML).toBe("");

    def.resolve();
    await prom;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>content</div>");
  });

  // ---------------------------------------------------------------------------
  //  Suspense with props
  // ---------------------------------------------------------------------------

  test("content receives props correctly", async () => {
    class Child extends Component {
      static template = xml`<div><t t-out="this.props.msg"/></div>`;
      props = props();
    }

    class Parent extends Component {
      static template = xml`
        <Suspense>
          <Child msg="'hello'"/>
          <t t-set-slot="fallback">loading</t>
        </Suspense>`;
      static components = { Suspense, Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>hello</div>");
  });
});
