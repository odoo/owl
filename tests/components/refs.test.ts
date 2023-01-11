import { App, Component, mount, onMounted, useRef, useState, xml } from "../../src/index";
import { logStep, makeTestFixture, nextAppError, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();
let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("refs", () => {
  test("basic use", async () => {
    class Test extends Component {
      static template = xml`<div t-ref="div"/>`;
      button = useRef("div");
    }
    const test = await mount(Test, fixture);
    expect(test.button.el).toBe(fixture.firstChild);
  });

  test("refs are properly bound in slots", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="footer"/></span>`;
    }

    class Parent extends Component {
      static template = xml`
            <div>
              <span class="counter"><t t-esc="state.val"/></span>
              <Dialog>
                <t t-set-slot="footer"><button t-ref="myButton" t-on-click="doSomething">do something</button></t>
              </Dialog>
            </div>
          `;
      static components = { Dialog };
      state = useState({ val: 0 });
      button = useRef("myButton");
      doSomething() {
        this.state.val++;
      }
    }
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    parent.button.el!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
  });

  test("can use 2 refs with same name in a t-if/t-else situation", async () => {
    class Test extends Component {
      static template = xml`
        <t t-if="state.value">
          <div t-ref="coucou"/>
        </t>
        <t t-else="">
          <span t-ref="coucou"/>
        </t>`;

      state = useState({ value: true });
      ref = useRef("coucou");
    }
    const test = await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(test.ref.el!.tagName).toBe("DIV");

    test.state.value = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");
    expect(test.ref.el!.tagName).toBe("SPAN");

    test.state.value = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(test.ref.el!.tagName).toBe("DIV");
  });

  test("throws if there are 2 same refs at the same time", async () => {
    const consoleWarn = console.warn;
    console.warn = jest.fn();
    class Test extends Component {
      static template = xml`
        <div t-ref="coucou"/>
        <span t-ref="coucou"/>`;

      state = useState({ value: true });
      ref = useRef("coucou");
    }

    const app = new App(Test, { test: true });
    const mountProm = expect(app.mount(fixture)).rejects.toThrowError(
      "Cannot have 2 elements with same ref name at the same time"
    );
    await expect(nextAppError(app)).resolves.toThrow(
      "Cannot have 2 elements with same ref name at the same time"
    );
    await mountProm;
    expect(console.warn).toBeCalledTimes(1);
    console.warn = consoleWarn;
  });

  test("refs and recursive templates", async () => {
    class Test extends Component {
      static components = {};
      static template = xml`
        <p t-ref="root">
          <t t-esc="props.tree.value"/>
          <t t-if="props.tree.child"><Test tree="props.tree.child"/></t>
        </p>`;
      root = useRef("root");

      setup() {
        onMounted(() => logStep(this.root.el!.outerHTML));
      }
    }
    Test.components = { Test };

    const tree = { value: "a", child: { value: "b", child: null } };

    await mount(Test, fixture, { props: { tree } });
    expect(fixture.innerHTML).toBe("<p>a<p>b</p></p>");
    expect(["<p>b</p>", "<p>a<p>b</p></p>"]).toBeLogged();
  });
});
