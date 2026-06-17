import {
  App,
  Component,
  mount,
  onMounted,
  onPatched,
  onWillDestroy,
  proxy,
  xml,
  props,
  signal,
  computed,
  Resource,
} from "../../src";
import { logStep, makeTestFixture, nextAppError, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();
let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("refs", () => {
  test("basic use", async () => {
    class Test extends Component {
      static template = xml`<div t-ref="this.button"/>`;
      button = signal<HTMLDivElement | null>(null);
    }
    const test = await mount(Test, fixture);
    expect(test.button()).toBe(fixture.firstChild);
  });

  test("basic use with signal.ref", async () => {
    class Test extends Component {
      static template = xml`<input t-ref="this.input"/>`;
      input = signal.ref(HTMLInputElement);
    }
    const test = await mount(Test, fixture);
    expect(test.input()).toBe(fixture.firstChild);
    test.input()!.value = "test"; // typed as HTMLInputElement | null
    expect((fixture.firstChild as HTMLInputElement).value).toBe("test");
  });

  test("refs are properly bound in slots", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-call-slot="footer"/></span>`;
      props = props();
    }

    class Parent extends Component {
      static template = xml`
            <div>
              <span class="counter"><t t-out="this.state.val"/></span>
              <Dialog>
                <t t-set-slot="footer"><button t-ref="this.button" t-on-click="this.doSomething">do something</button></t>
              </Dialog>
            </div>
          `;
      static components = { Dialog };
      state = proxy({ val: 0 });
      button = signal<HTMLButtonElement | null>(null);
      doSomething() {
        this.state.val++;
      }
    }
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    parent.button()!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
  });

  test("use 2 refs in a t-if/t-else situation", async () => {
    class Test extends Component {
      static template = xml`
        <t t-if="this.state.value">
          <div t-ref="this.ref1"/>
        </t>
        <t t-else="">
          <span t-ref="this.ref2"/>
        </t>`;

      state = proxy({ value: true });
      ref1 = signal<HTMLElement | null>(null);
      ref2 = signal<HTMLElement | null>(null);
      ref = computed(() => this.ref1() || this.ref2());
    }
    const test = await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(test.ref()!.tagName).toBe("DIV");

    test.state.value = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");
    expect(test.ref()!.tagName).toBe("SPAN");

    test.state.value = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(test.ref()!.tagName).toBe("DIV");
  });

  test("ref is unset when t-if goes to false after unrelated render", async () => {
    class Comp extends Component {
      static template = xml`<div t-if="this.state.show" t-att-class="this.state.class" t-ref="this.ref"/>`;
      state = proxy({ show: true, class: "test" });
      ref = signal<HTMLDivElement | null>(null);
    }

    const comp = await mount(Comp, fixture);
    expect(comp.ref()).not.toBeNull();

    comp.state.class = "test2";
    await nextTick();

    comp.state.show = false;
    await nextTick();
    expect(comp!.ref()).toBeNull();

    comp.state.show = true;
    await nextTick();
    expect(comp!.ref()).not.toBeNull();
  });

  test.skip("throws if there are 2 same refs at the same time", async () => {
    class Test extends Component {
      static template = xml`
        <div t-ref="this.ref"/>
        <span t-ref="this.ref"/>`;

      state = proxy({ value: true });
      ref = signal<HTMLElement | null>(null);
    }

    const app = new App({ test: true });
    const root = app.createRoot(Test);
    const errorProm = nextAppError(app);
    const mountProm = expect(root.mount(fixture)).rejects.toThrow(
      'Cannot set the same ref more than once in the same component, ref "coucou" was set multiple times in Test'
    );
    const error = await errorProm;
    expect(error.message).toContain(
      'Cannot set the same ref more than once in the same component, ref "coucou" was set multiple times in Test'
    );
    await mountProm;
  });

  test("refs and recursive templates", async () => {
    class Test extends Component {
      static components = {};
      static template = xml`
        <p t-ref="this.root">
          <t t-out="this.props.tree.value"/>
          <t t-if="this.props.tree.child"><Test tree="this.props.tree.child"/></t>
        </p>`;
      props = props();
      root = signal<HTMLElement | null>(null);

      setup() {
        onMounted(() => logStep(this.root()!.outerHTML));
      }
    }
    Test.components = { Test };

    const tree = { value: "a", child: { value: "b", child: null } };

    await mount(Test, fixture, { props: { tree } });
    expect(fixture.innerHTML).toBe("<p>a<p>b</p></p>");
    expect(["<p>b</p>", "<p>a<p>b</p></p>"]).toBeLogged();
  });

  test("refs and t-key", async () => {
    let el;
    class Test extends Component {
      static components = {};
      static template = xml`
        <button t-on-click="() => this.state.renderId++" />
        <p t-ref="this.root" t-key="this.state.renderId"/>`;
      root = signal<HTMLElement | null>(null);
      state = proxy({ renderId: 1 });

      setup() {
        onMounted(() => {
          el = this.root();
        });
        onPatched(() => {
          el = this.root();
        });
      }
    }
    await mount(Test, fixture);

    expect(el).toBe(fixture.querySelector("p"));
    const _el = el;
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(el).not.toBe(_el);
    expect(el).toBe(fixture.querySelector("p"));
  });

  test("ref is set by child component", async () => {
    class Child extends Component {
      static template = xml`<div id="ref" t-ref="this.props.ref"/>`;
      props = props({ ref: Function });
    }

    class Parent extends Component {
      static template = xml`<Child ref="this.ref"/>`;
      static components = { Child };
      ref = signal<HTMLElement | null>(null);
    }

    const comp = await mount(Parent, fixture);
    expect(comp.ref()).toBe(fixture.querySelector("#ref"));
  });

  test("resource can be used for multi ref", async () => {
    class Test extends Component {
      static template = xml`
        <t t-foreach="this.items()" t-as="item" t-key="item">
          <p t-ref="this.refs" t-attf-id="item-{{item}}"/>
        </t>
      `;
      items = signal([0, 1, 2]);
      refs = new Resource<HTMLElement>({ name: "elements" });
    }

    const comp = await mount(Test, fixture);
    const ids = computed(() => comp.refs.items().map((el) => el.getAttribute("id")));
    expect(ids()).toEqual(["item-0", "item-1", "item-2"]);

    comp.items.set([0, 2, 4]);
    await nextTick();
    expect(ids()).toEqual(["item-0", "item-2", "item-4"]);

    comp.items.set([0, 1, 2]);
    await nextTick();
    expect(ids()).toEqual(["item-0", "item-2", "item-1"]);
  });

  test("ref shared between t-if and t-else, plain", async () => {
    class Root extends Component {
      static template = xml`
        <t t-if="this.cond()">
          <div class="ifbranch" t-ref="this.ref"/>
        </t>
        <t t-else="">
          <div class="elsebranch" t-ref="this.ref"/>
        </t>`;
      ref = signal<HTMLElement | null>(null);
      cond = signal(false);
    }

    const root = await mount(Root, fixture);
    expect(root.ref()).toBe(fixture.querySelector(".elsebranch"));

    root.cond.set(true);
    await nextTick();
    expect(root.ref()).toBe(fixture.querySelector(".ifbranch"));
  });

  test("ref shared between t-if and t-else, t-else has a slotted component", async () => {
    class SlotCp extends Component {
      static template = xml`<t t-call-slot="default"/>`;
    }
    class Root extends Component {
      static components = { SlotCp };
      static template = xml`
        <t t-if="this.cond()">
          <div class="ifbranch" t-ref="this.ref"/>
        </t>
        <t t-else="">
          <SlotCp>
            <div class="elsebranch" t-ref="this.ref"/>
          </SlotCp>
        </t>`;
      ref = signal<HTMLElement | null>(null);
      cond = signal(false);
    }

    const root = await mount(Root, fixture);
    expect(root.ref()).toBe(fixture.querySelector(".elsebranch"));

    root.cond.set(true);
    await nextTick();
    expect(root.ref()).toBe(fixture.querySelector(".ifbranch"));

    root.cond.set(false);
    await nextTick();
    expect(root.ref()).toBe(fixture.querySelector(".elsebranch"));
  });

  test("ref in slot is unset when the slot host is removed", async () => {
    class Wrapper extends Component {
      static template = xml`<div><t t-call-slot="default"/></div>`;
    }
    class Root extends Component {
      static components = { Wrapper };
      static template = xml`
        <t t-if="this.visible()">
          <Wrapper>
            <div class="slotted" t-ref="this.myRef">Coucou</div>
          </Wrapper>
        </t>`;
      visible = signal(false);
      myRef = signal.ref();
    }

    const root = await mount(Root, fixture);
    expect(root.myRef()).toBeNull();

    root.visible.set(true);
    await nextTick();
    expect(root.myRef()).toBe(fixture.querySelector(".slotted"));

    // Removing the wrapper removes the slotted element from the DOM; the ref
    // signal (owned by the surviving Root) must be cleared too.
    root.visible.set(false);
    await nextTick();
    expect(fixture.innerHTML).not.toContain("Coucou");
    expect(root.myRef()).toBeNull();
  });

  test("ref in slot is unset across a t-if nested inside the slot content", async () => {
    class Wrapper extends Component {
      static template = xml`<section><t t-call-slot="default"/></section>`;
    }
    class Root extends Component {
      static components = { Wrapper };
      static template = xml`
        <t t-if="this.visible()">
          <Wrapper>
            <t t-if="this.inner()"><span t-ref="this.myRef">hi</span></t>
          </Wrapper>
        </t>`;
      visible = signal(true);
      inner = signal(true);
      myRef = signal.ref();
    }

    const root = await mount(Root, fixture);
    expect(root.myRef()).not.toBeNull();

    // tearing down the host (and the slot content with it) clears the ref
    root.visible.set(false);
    await nextTick();
    expect(root.myRef()).toBeNull();
  });

  test("ref in slot is unset when forwarded through a nested component", async () => {
    class Inner extends Component {
      static template = xml`<i><t t-call-slot="default"/></i>`;
    }
    class Wrapper extends Component {
      static components = { Inner };
      static template = xml`<div><Inner><t t-call-slot="default"/></Inner></div>`;
    }
    class Root extends Component {
      static components = { Wrapper };
      static template = xml`
        <t t-if="this.visible()">
          <Wrapper><b t-ref="this.myRef">x</b></Wrapper>
        </t>`;
      visible = signal(true);
      myRef = signal.ref();
    }

    const root = await mount(Root, fixture);
    expect(root.myRef()).not.toBeNull();

    root.visible.set(false);
    await nextTick();
    expect(root.myRef()).toBeNull();
  });

  test("ref in slot is unset when the host removes it in place (host survives)", async () => {
    class Wrapper extends Component {
      static template = xml`<div t-if="this.show()"><t t-call-slot="default"/></div>`;
      show = signal(true);
    }
    class Root extends Component {
      static components = { Wrapper };
      static template = xml`<Wrapper><span class="slotted" t-ref="this.myRef">hi</span></Wrapper>`;
      myRef = signal.ref();
    }

    const root = await mount(Root, fixture);
    expect(root.myRef()).toBe(fixture.querySelector(".slotted"));

    // Wrapper is NOT unmounted; toggling its own t-if removes the slot element
    // in place, so the ref is cleared by Wrapper's post-patch sweep.
    const wrapper = Object.values((root as any).__owl__.children)[0] as any;
    wrapper.component.show.set(false);
    await nextTick();
    expect(fixture.querySelector(".slotted")).toBeNull();
    expect(root.myRef()).toBeNull();
  });

  test("ref in slot is unset when an intermediate host is removed in place", async () => {
    class Inner extends Component {
      static template = xml`<i><t t-call-slot="default"/></i>`;
    }
    class Root extends Component {
      static components = { Inner };
      // The ref is hosted by Inner (it owns the slotted span's dom), but Inner
      // is a block-child of a t-if that Root removes in place: Root survives, so
      // its own post-patch sweep doesn't cover Inner, and Inner.remove() never
      // fires (the block bulk-removes it). The removal must still clear the ref.
      static template = xml`<div t-if="this.show()"><Inner><span t-ref="this.myRef">x</span></Inner></div>`;
      show = signal(true);
      myRef = signal.ref();
    }

    const root = await mount(Root, fixture);
    expect(root.myRef()).not.toBeNull();

    root.show.set(false);
    await nextTick();
    expect(fixture.innerHTML).toBe("");
    expect(root.myRef()).toBeNull();
  });

  test("ref is unset even when a sub-root is destroyed re-entrantly mid-removal", async () => {
    const subApp = new App({ test: true });
    class Sub extends Component {
      static template = xml`<p>sub</p>`;
    }
    const subFixture = document.createElement("div");
    document.body.appendChild(subFixture);
    await subApp.createRoot(Sub).mount(subFixture);

    class Wrapper extends Component {
      static template = xml`<div><t t-call-slot="default"/></div>`;
      setup() {
        // Like Portal/Suspense: tear down a sub-root from this component's own
        // teardown — a removal that re-enters while the parent patch that hosts
        // our ref is still collecting. Only the outermost removal must sweep.
        onWillDestroy(() => subApp.destroy());
      }
    }
    class Root extends Component {
      static components = { Wrapper };
      static template = xml`<t t-if="this.show()"><Wrapper><span t-ref="this.myRef">hi</span></Wrapper></t>`;
      show = signal(true);
      myRef = signal.ref();
    }

    const root = await mount(Root, fixture);
    expect(root.myRef()).not.toBeNull();

    root.show.set(false);
    await nextTick();
    expect(root.myRef()).toBeNull();
  });
});
