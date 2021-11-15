import {
  App,
  Component,
  mount,
  useRef,
  useState,
  useComponent,
  useEnv,
  useSubEnv,
  onMounted,
  onPatched,
  onWillStart,
  onWillUpdateProps,
  onWillPatch,
  xml,
  onWillUnmount,
} from "../../src/index";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();
beforeEach(() => {
  fixture = makeTestFixture();
});

describe("hooks", () => {
  test("useRef hook: basic use", async () => {
    let counter: Counter;
    class Counter extends Component {
      static template = xml`<div><button t-ref="button"><t t-esc="value"/></button></div>`;
      button = useRef("button");
      value = 0;
      setup() {
        counter = this;
      }
      increment() {
        this.value++;
        this.button.el!.innerHTML = String(this.value);
      }
    }
    const mounted = mount(Counter, fixture);
    expect(counter!.button.el).toBe(null);
    await mounted;
    expect(fixture.innerHTML).toBe("<div><button>0</button></div>");
    expect(counter!.button.el).not.toBe(null);
    expect(counter!.button.el).toBe(fixture.querySelector("button"));
    counter!.increment();
    expect(fixture.innerHTML).toBe("<div><button>1</button></div>");
  });
  // TODO: rename like next test (ensures willPatch/patched calls are symmetrical)
  test("two different call to willPatch/patched should work", async () => {
    const steps: string[] = [];
    function useMyHook(i: number) {
      onPatched(() => {
        steps.push("hook:patched" + i);
      });
      onWillPatch(() => {
        steps.push("hook:willPatch" + i);
      });
    }
    class Test extends Component {
      static template = xml`<div>hey<t t-esc="state.value"/></div>`;
      state = useState({ value: 1 });
      setup() {
        useMyHook(1);
        useMyHook(2);
      }
    }
    const component = await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("<div>hey1</div>");
    component.state.value++;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>hey2</div>");

    expect(steps).toEqual(["hook:willPatch2", "hook:willPatch1", "hook:patched1", "hook:patched2"]);
  });

  test("mounted callbacks should be called in reverse order from willUnmount callbacks", async () => {
    const steps: string[] = [];
    function useMyHook(i: number) {
      onMounted(() => {
        steps.push("hook:mounted" + i);
      });
      onWillUnmount(() => {
        steps.push("hook:willUnmount" + i);
      });
    }
    class Test extends Component {
      static template = xml`<div>hey<t t-esc="state.value"/></div>`;
      state = useState({ value: 1 });
      setup() {
        useMyHook(1);
        useMyHook(2);
      }
    }
    const app = new App(Test);
    await app.mount(fixture);
    app.destroy();
    expect(steps).toEqual([
      "hook:mounted1",
      "hook:mounted2",
      "hook:willUnmount2",
      "hook:willUnmount1",
    ]);
  });

  describe("autofocus hook", () => {
    function useAutofocus(name: string) {
      let ref = useRef(name);
      let isInDom = false;
      function updateFocus() {
        if (!isInDom && ref.el) {
          isInDom = true;
          ref.el.focus();
        } else if (isInDom && !ref.el) {
          isInDom = false;
        }
      }
      onPatched(updateFocus);
      onMounted(updateFocus);
    }

    test("simple input", async () => {
      class Test extends Component {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <input t-ref="input2"/>
            </div>`;

        setup() {
          useAutofocus("input2");
        }
      }

      await mount(Test, fixture);
      expect(fixture.innerHTML).toBe("<div><input><input></div>");
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });

    test("input in a t-if", async () => {
      class Test extends Component {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <t t-if="state.flag"><input t-ref="input2"/></t>
            </div>`;

        state = useState({ flag: false });
        setup() {
          useAutofocus("input2");
        }
      }

      const component = await mount(Test, fixture);
      expect(fixture.innerHTML).toBe("<div><input></div>");
      expect(document.activeElement).toBe(document.body);

      component.state.flag = true;
      await nextTick();
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });
  });

  test("can use useEnv", async () => {
    expect.assertions(3);
    class Test extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      setup() {
        expect(useEnv()).toBe(this.env);
      }
    }
    const env = { val: 1 };
    await new App(Test).configure({ env }).mount(fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");
  });

  test("use sub env does not pollute user env", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      setup() {
        useSubEnv({ val2: 1 });
      }
    }
    const env = { val: 3 };
    const component = await new App(Test).configure({ env }).mount(fixture);
    expect(fixture.innerHTML).toBe("<div>3</div>");
    expect(component.env).not.toHaveProperty("val2");
    expect(component.env).toHaveProperty("val");
  });

  test("can use useComponent", async () => {
    expect.assertions(2);
    class Test extends Component {
      static template = xml`<div></div>`;
      setup() {
        expect(useComponent()).toBe(this);
      }
    }
    await mount(Test, fixture);
  });

  test("parent and child env", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
    }

    class Parent extends Component {
      static template = xml`<t t-esc="env.val"/><Child/>`;
      static components = { Child };
      setup() {
        useSubEnv({ val: 5 });
      }
    }
    const env = { val: 3 };
    await new App(Parent).configure({ env }).mount(fixture);
    expect(fixture.innerHTML).toBe("3<div>5</div>");
  });

  test("can use onWillStart, onWillUpdateProps", async () => {
    const steps: string[] = [];
    async function slow(): Promise<string> {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve("slow");
        }, 0);
      });
    }
    function useMyHook() {
      onWillStart(async () => {
        steps.push(await slow());
        steps.push("onWillStart");
      });
      onWillUpdateProps(async (nextProps) => {
        expect(nextProps).toEqual({ value: 2 });
        steps.push(await slow());
        steps.push("onWillUpdateProps");
      });
    }
    function use2ndHook() {
      onWillStart(() => {
        steps.push("on2ndStart");
      });
      onWillUpdateProps((nextProps) => {
        expect(nextProps).toEqual({ value: 2 });
        steps.push("on2ndUpdate");
      });
    }
    class MyComponent extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
      setup() {
        useMyHook();
        use2ndHook();
      }
    }
    class App extends Component {
      static template = xml`<MyComponent value="state.value"/>`;
      static components = { MyComponent };
      state = useState({ value: 1 });
    }

    const app = await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<span>1</span>");

    // NOTE: 'on2ndStart' appears first in the list even though
    // the 'use2ndHook' is declared after 'useMyHook'. This is
    // because Promise.all is used to call the callbacks specified
    // in the hooks, which runs them simultaneously.
    // Additionally, 'slow' should be listed before 'onWillStart'
    // because call to `slow` is awaited.
    expect(steps).toEqual(["on2ndStart", "slow", "onWillStart"]);

    app.state.value = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>2</span>");
    expect(steps).toEqual([
      "on2ndStart",
      "slow",
      "onWillStart",
      "on2ndUpdate",
      "slow",
      "onWillUpdateProps",
    ]);
  });

  test.skip("useExternalListener", async () => {
    let n = 0;

    class MyComponent extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
      setup() {
        //useExternalListener(window as any, "click", this.increment);
      }
      increment() {
        n++;
      }
    }
    class App extends Component {
      static template = xml`<MyComponent t-if="state.flag"/>`;
      static components = { MyComponent };
      state = useState({ flag: false });
    }

    const app = await mount(App, fixture);

    expect(n).toBe(0);
    window.dispatchEvent(new Event("click"));
    expect(n).toBe(0);
    app.state.flag = true;
    await nextTick();
    window.dispatchEvent(new Event("click"));
    expect(n).toBe(1);
    app.state.flag = false;
    await nextTick();
    window.dispatchEvent(new Event("click"));
    expect(n).toBe(1);
  });
});
