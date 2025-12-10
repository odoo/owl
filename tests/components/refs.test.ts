import {
  App,
  Component,
  mount,
  onMounted,
  onPatched,
  proxy,
  xml,
  props,
  signal,
  derived,
} from "../../src/index";
import { inOwnerDocument } from "../../src/runtime/utils";
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

  test("refs are properly bound in slots", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-call-slot="footer"/></span>`;
      props = props();
    }

    class Parent extends Component {
      static template = xml`
            <div>
              <span class="counter"><t t-esc="state.val"/></span>
              <Dialog>
                <t t-set-slot="footer"><button t-ref="this.button" t-on-click="doSomething">do something</button></t>
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
        <t t-if="state.value">
          <div t-ref="this.ref1"/>
        </t>
        <t t-else="">
          <span t-ref="this.ref2"/>
        </t>`;

      state = proxy({ value: true });
      ref1 = signal<HTMLElement | null>(null);
      ref2 = signal<HTMLElement | null>(null);
      ref = derived(() => this.ref1() || this.ref2());
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
      static template = xml`<div t-if="state.show" t-att-class="state.class" t-ref="this.ref"/>`;
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
    const consoleWarn = console.warn;
    console.warn = jest.fn();
    class Test extends Component {
      static template = xml`
        <div t-ref="this.ref"/>
        <span t-ref="this.ref"/>`;

      state = proxy({ value: true });
      ref = signal<HTMLElement | null>(null);
    }

    const app = new App({ test: true });
    const mountProm = expect(app.createRoot(Test).mount(fixture)).rejects.toThrowError(
      'Cannot set the same ref more than once in the same component, ref "coucou" was set multiple times in Test'
    );
    await expect(nextAppError(app)).resolves.toThrow(
      'Cannot set the same ref more than once in the same component, ref "coucou" was set multiple times in Test'
    );
    await mountProm;
    expect(console.warn).toBeCalledTimes(1);
    console.warn = consoleWarn;
  });

  test("refs and recursive templates", async () => {
    class Test extends Component {
      static components = {};
      static template = xml`
        <p t-ref="this.root">
          <t t-esc="this.props.tree.value"/>
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
        <button t-on-click="() => state.renderId++" />
        <p t-ref="this.root" t-key="state.renderId"/>`;
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

  test("multi ref", async () => {
    function refs() {
      let elements: HTMLElement[] = [];
      let rev = 0;
      const currentRev = signal(0);

      const reader = () => {
        if (rev !== currentRev()) {
          rev = currentRev();
          elements = elements.filter((el) => inOwnerDocument(el));
        }
        return elements;
      };

      reader.set = (el: HTMLElement | null) => {
        if (el) {
          elements.push(el);
          currentRev.update((rev) => rev + 1);
        }
      };

      return reader;
    }

    class Test extends Component {
      static template = xml`
        <t t-foreach="this.items()" t-as="item" t-key="item">
          <p t-ref="refs" t-attf-id="item-{{item}}"/>
        </t>
      `;
      items = signal([0, 1, 2]);
      refs = refs();
    }

    const comp = await mount(Test, fixture);
    const ids = derived(() => comp.refs().map((el) => el.getAttribute("id")));
    expect(ids()).toEqual(["item-0", "item-1", "item-2"]);

    comp.items.update(() => [0, 2, 4]);
    await nextTick();
    expect(ids()).toEqual(["item-0", "item-2", "item-4"]);

    comp.items.update(() => [0, 1, 2]);
    await nextTick();
    expect(ids()).toEqual(["item-0", "item-2", "item-1"]);
  });
});
