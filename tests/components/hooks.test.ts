import {
  App,
  Component,
  mount,
  onMounted,
  onPatched,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  onWillUpdateProps,
  useComponent,
  useEffect,
  useEnv,
  useExternalListener,
  useRef,
  useState,
  useChildSubEnv,
  useSubEnv,
  xml,
  OwlError,
} from "../../src/index";
import {
  elem,
  logStep,
  makeTestFixture,
  nextAppError,
  nextTick,
  snapshotEverything,
} from "../helpers";

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
    await mount(Test, fixture, { env });
    expect(fixture.innerHTML).toBe("<div>1</div>");
  });

  test("useSubEnv modifies user env", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      setup() {
        useSubEnv({ val2: 1 });
      }
    }
    const env = { val: 3 };
    const component = await mount(Test, fixture, { env });
    expect(fixture.innerHTML).toBe("<div>3</div>");
    expect(component.env).toHaveProperty("val2");
    expect(component.env).toHaveProperty("val");
  });

  test("useChildSubEnv does not pollute user env", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      setup() {
        useChildSubEnv({ val2: 1 });
      }
    }
    const env = { val: 3 };
    const component = await mount(Test, fixture, { env });
    expect(fixture.innerHTML).toBe("<div>3</div>");
    expect(component.env).not.toHaveProperty("val2");
    expect(component.env).toHaveProperty("val");
  });

  test("useSubEnv supports arbitrary descriptor", async () => {
    let someVal = "maggot";
    let someVal2 = "brain";

    class Child extends Component {
      static template = xml`<div><t t-esc="env.someVal" /> <t t-esc="env.someVal2" /></div>`;
    }

    class Test extends Component {
      static template = xml`<Child />`;
      static components = { Child };
      setup() {
        useSubEnv({
          get someVal2() {
            return someVal2;
          },
        });
      }
    }

    const env = {
      get someVal() {
        return someVal;
      },
    };
    const component = await mount(Test, fixture, { env });
    expect(fixture.innerHTML).toBe("<div>maggot brain</div>");
    someVal = "brain";
    someVal2 = "maggot";
    component.render(true);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>brain maggot</div>");
  });

  test("useChildSubEnv supports arbitrary descriptor", async () => {
    let someVal = "maggot";
    let someVal2 = "brain";

    class Child extends Component {
      static template = xml`<div><t t-esc="env.someVal" /> <t t-esc="env.someVal2" /></div>`;
    }

    class Test extends Component {
      static template = xml`<Child />`;
      static components = { Child };
      setup() {
        useChildSubEnv({
          get someVal2() {
            return someVal2;
          },
        });
      }
    }
    someVal = "maggot";
    const env = {
      get someVal() {
        return someVal;
      },
    };
    const component = await mount(Test, fixture, { env });
    expect(fixture.innerHTML).toBe("<div>maggot brain</div>");
    someVal = "brain";
    someVal2 = "maggot";
    component.render(true);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>brain maggot</div>");
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

  test("parent and child env (with useSubEnv)", async () => {
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
    await mount(Parent, fixture, { env });
    expect(fixture.innerHTML).toBe("5<div>5</div>");
  });

  test("parent and child env (with useChildSubEnv)", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
    }

    class Parent extends Component {
      static template = xml`<t t-esc="env.val"/><Child/>`;
      static components = { Child };
      setup() {
        useChildSubEnv({ val: 5 });
      }
    }
    const env = { val: 3 };
    await mount(Parent, fixture, { env });
    expect(fixture.innerHTML).toBe("3<div>5</div>");
  });

  test("parent and child env (with useChildSubEnv then useSubEnv)", async () => {
    class Child extends Component {
      static template = xml`<div t-if="env.hasParent"><t t-esc="env.val"/></div>`;
    }

    class Parent extends Component {
      static template = xml`<t t-esc="env.val"/><Child/>`;
      static components = { Child };
      setup() {
        useChildSubEnv({ hasParent: true });
        useSubEnv({ val: 5 });
      }
    }
    const env = { val: 3 };
    await mount(Parent, fixture, { env });
    expect(fixture.innerHTML).toBe("5<div>5</div>");
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

  test("useExternalListener", async () => {
    let n = 0;

    class MyComponent extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
      setup() {
        useExternalListener(window, "click", this.increment);
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

  describe("useEffect hook", () => {
    test("effect runs on mount, is reapplied on patch, and is cleaned up on unmount and before reapplying", async () => {
      let cleanupRun = 0;
      let steps = [];
      class MyComponent extends Component {
        state = useState({
          value: 0,
        });
        setup() {
          useEffect(() => {
            steps.push(`value is ${this.state.value}`);
            return () =>
              steps.push(`cleaning up for value = ${this.state.value} (cleanup ${cleanupRun++})`);
          });
        }
      }
      MyComponent.template = xml`<div/>`;

      const component = await mount(MyComponent, fixture);

      steps.push("before state mutation");
      component.state.value++;
      // Wait for an owl render
      await new Promise((resolve) => requestAnimationFrame(resolve));
      steps.push("after state mutation");
      await component.__owl__.destroy();

      expect(steps).toEqual([
        "value is 0",
        "before state mutation",
        // While one might expect value to be 0 at cleanup, because the value is
        // read during cleanup from the state rather than captured by a dependency
        // it already has the new value. Having this in business code is a symptom
        // of a missing dependency and can lead to bugs.
        "cleaning up for value = 1 (cleanup 0)",
        "value is 1",
        "after state mutation",
        "cleaning up for value = 1 (cleanup 1)",
      ]);
    });

    test("effect can depend on stuff in dom", async () => {
      class MyComponent extends Component {
        static template = xml`
          <t t-if="state.value">
            <div t-ref="div"/>
          </t>`;
        state = useState({
          value: false,
        });
        setup() {
          const ref = useRef("div");
          useEffect(
            (el) => {
              logStep("effect started:" + (el ? "EL" : "NULL"));
              return () => logStep("cleaning up effect:" + (el ? "EL" : "NULL"));
            },
            () => [ref.el]
          );
        }
      }
      const component = await mount(MyComponent, fixture);

      expect(["effect started:NULL"]).toBeLogged();

      component.state.value = true;
      await nextTick();
      expect(["cleaning up effect:NULL", "effect started:EL"]).toBeLogged();
    });

    test("dependencies prevent effects from rerunning when unchanged", async () => {
      let steps = [];
      class MyComponent extends Component {
        state = useState({
          a: 0,
          b: 0,
        });
        setup() {
          useEffect(
            (a) => {
              steps.push(`Effect a: ${a}`);
              return () => steps.push(`cleaning up for a: ${a}`);
            },
            () => [this.state.a]
          );
          useEffect(
            (b) => {
              steps.push(`Effect b: ${b}`);
              return () => steps.push(`cleaning up for b: ${b}`);
            },
            () => [this.state.b]
          );
          useEffect(
            (a, b) => {
              steps.push(`Effect ab: {a: ${a}, b: ${b}}`);
              return () => steps.push(`cleaning up for ab: {a: ${a}, b: ${b}}`);
            },
            () => [this.state.a, this.state.b]
          );
        }
      }
      MyComponent.template = xml`<div/>`;
      steps.push("before mount");
      const component = await mount(MyComponent, fixture);
      steps.push("after mount");

      steps.push("before state mutation: a");
      component.state.a++;
      // Wait for an owl render
      await new Promise((resolve) => requestAnimationFrame(resolve));
      steps.push("after state mutation: a");

      steps.push("before state mutation: b");
      component.state.b++;
      // Wait for an owl render
      await new Promise((resolve) => requestAnimationFrame(resolve));
      steps.push("after state mutation: b");
      await component.__owl__.destroy();

      expect(steps).toEqual([
        // All effects run on mount
        "before mount",
        "Effect a: 0",
        "Effect b: 0",
        "Effect ab: {a: 0, b: 0}",
        "after mount",

        "before state mutation: a",
        // Cleanups run in reverse order
        // Cleanup for b is not run
        "cleaning up for a: 0",

        "Effect a: 1",
        "cleaning up for ab: {a: 0, b: 0}",
        // Effect b is not run
        "Effect ab: {a: 1, b: 0}",
        "after state mutation: a",

        "before state mutation: b",
        "cleaning up for b: 0",
        // Cleanup for a is not run

        // Effect a is not run
        "Effect b: 1",
        "cleaning up for ab: {a: 1, b: 0}",
        "Effect ab: {a: 1, b: 1}",
        "after state mutation: b",

        // All cleanups run on unmount
        "cleaning up for ab: {a: 1, b: 1}",
        "cleaning up for b: 1",
        "cleaning up for a: 1",
      ]);
    });

    test("effect with empty dependency list never reruns", async () => {
      let steps = [];
      class MyComponent extends Component {
        state = useState({
          value: 0,
        });
        setup() {
          useEffect(
            () => {
              steps.push(`value is ${this.state.value}`);
              return () => steps.push(`cleaning up for ${this.state.value}`);
            },
            () => []
          );
        }
      }
      MyComponent.template = xml`<div t-esc="state.value"/>`;

      const component = await mount(MyComponent, fixture);

      steps.push("before state mutation");
      component.state.value++;
      // Wait for an owl render
      await new Promise((resolve) => requestAnimationFrame(resolve));
      // Value was correctly changed inside the component
      expect(elem(component).textContent).toBe("1");
      steps.push("after state mutation");
      await component.__owl__.destroy();

      expect(steps).toEqual([
        "value is 0",
        "before state mutation",
        // no cleanup or effect caused by mutation
        "after state mutation",
        // Value being clean
        "cleaning up for 1",
      ]);
    });

    test("properly behaves when the effect function throws", async () => {
      let originalconsoleError = console.error;
      let originalconsoleWarn = console.warn;
      console.error = jest.fn(() => {});
      console.warn = jest.fn(() => {});
      class MyComponent extends Component {
        static template = xml`<div/>`;
        setup() {
          useEffect(
            () => {
              throw new Error("Intentional error");
            },
            () => []
          );
        }
      }

      let error: OwlError;
      const app = new App(MyComponent);
      const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
      await expect(nextAppError(app)).resolves.toThrow("error occured in the owl lifecycle");
      await mountProm;
      expect(error!.cause.message).toBe("Intentional error");
      // no console.error because the error has been caught in this test
      expect(console.error).toHaveBeenCalledTimes(0);
      console.error = originalconsoleError;
      // 1 console.warn because app is destroyed
      expect(console.warn).toHaveBeenCalledTimes(1);
      console.warn = originalconsoleWarn;
    });
  });
});
