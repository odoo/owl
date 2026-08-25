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
  OwlError,
  props,
  proxy,
  signal,
  useEffect,
  useListener,
  useOnChange,
  xml,
} from "../../src";
import {
  elem,
  logStep,
  makeTestFixture,
  nextTick,
  snapshotEverything,
  getConsoleOutput,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();
beforeEach(() => {
  fixture = makeTestFixture();
});

describe("hooks", () => {
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
      static template = xml`<div>hey<t t-out="this.state.value"/></div>`;
      state = proxy({ value: 1 });
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
      static template = xml`<div>hey<t t-out="this.state.value"/></div>`;
      state = proxy({ value: 1 });
      setup() {
        useMyHook(1);
        useMyHook(2);
      }
    }
    const app = new App();
    await app.createRoot(Test).mount(fixture);
    app.destroy();
    expect(steps).toEqual([
      "hook:mounted1",
      "hook:mounted2",
      "hook:willUnmount2",
      "hook:willUnmount1",
    ]);
  });

  describe("autofocus hook", () => {
    function useAutofocus() {
      let ref = signal<HTMLElement | null>(null);
      let isInDom = false;
      function updateFocus() {
        const el = ref();
        if (!isInDom && el) {
          isInDom = true;
          el.focus();
        } else if (isInDom && !el) {
          isInDom = false;
        }
      }
      // could be an effect
      onPatched(updateFocus);
      onMounted(updateFocus);

      return ref;
    }

    test("simple input", async () => {
      class Test extends Component {
        static template = xml`
            <div>
                <input/>
                <input t-ref="this.input"/>
            </div>`;

        input = useAutofocus();
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
                <input/>
                <t t-if="this.state.flag"><input t-ref="this.input"/></t>
            </div>`;

        state = proxy({ flag: false });
        input = useAutofocus();
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
      static template = xml`<span><t t-out="this.props.value"/></span>`;
      props = props();
      setup() {
        useMyHook();
        use2ndHook();
      }
    }
    class App extends Component {
      static template = xml`<MyComponent value="this.state.value"/>`;
      static components = { MyComponent };
      state = proxy({ value: 1 });
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

  test("onWillUpdateProps receives nextProps", async () => {
    let received: any = undefined;
    class Child extends Component {
      static template = xml`<span><t t-out="this.props.value"/></span>`;
      props = props();
      setup() {
        onWillUpdateProps((nextProps) => {
          received = nextProps;
        });
      }
    }
    class Parent extends Component {
      static template = xml`<Child value="this.value()"/>`;
      static components = { Child };
      value = signal(1);
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>1</span>");

    parent.value.set(2);
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>2</span>");
    expect(received).toBeDefined();
    expect(received.value).toBe(2);
  });

  test("onWillUpdateProps receives nextProps (dev mode)", async () => {
    let received: any = undefined;
    class Child extends Component {
      static template = xml`<span><t t-out="this.props.value"/></span>`;
      props = props();
      setup() {
        onWillUpdateProps((nextProps) => {
          received = nextProps;
        });
      }
    }
    class Parent extends Component {
      static template = xml`<Child value="this.value()"/>`;
      static components = { Child };
      value = signal(1);
    }

    const app = new App({ dev: true });
    const parent = await app.createRoot(Parent).mount(fixture);
    expect(fixture.innerHTML).toBe("<span>1</span>");

    parent.value.set(2);
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>2</span>");
    expect(received).toBeDefined();
    expect(received.value).toBe(2);
    app.destroy();
    expect(getConsoleOutput()).toEqual([`info:Owl is running in 'dev' mode.`]);
  });

  test("useListener", async () => {
    let n = 0;

    class MyComponent extends Component {
      static template = xml`<span><t t-out="this.props.value"/></span>`;
      props = props();
      setup() {
        useListener(window, "click", this.increment);
        window.dispatchEvent(new Event("click"));
      }
      increment() {
        n++;
      }
    }
    class App extends Component {
      static template = xml`<MyComponent t-if="this.state.flag"/>`;
      static components = { MyComponent };
      state = proxy({ flag: false });
    }

    const app = await mount(App, fixture);

    expect(n).toBe(0);
    window.dispatchEvent(new Event("click"));
    expect(n).toBe(0);
    app.state.flag = true;
    await nextTick();
    expect(n).toBe(1);
    window.dispatchEvent(new Event("click"));
    expect(n).toBe(2);
    app.state.flag = false;
    await nextTick();
    window.dispatchEvent(new Event("click"));
    expect(n).toBe(2);
  });

  test("useListener work with references", async () => {
    class MyComponent extends Component {
      static template = xml`<span t-ref="this.span"><t t-out="this.value()"/></span>`;
      value = signal(0);
      span = signal(null);
      setup() {
        useListener(this.span, "click", () => this.increment());
      }
      increment() {
        this.value.set(this.value() + 1);
      }
    }

    await mount(MyComponent, fixture);

    expect(fixture.innerHTML).toBe("<span>0</span>");
    const span = fixture.getElementsByTagName("span")[0];
    span.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>1</span>");
  });

  // jsdom dispatches with a non-empty JS stack, so no microtask checkpoint
  // happens mid-dispatch and a component cannot really be created while its
  // creating event still bubbles. The tests below recreate that by dispatching
  // the same event object a second time, which is what the guard keys on.
  test("useListener ignores the event that created its component", async () => {
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<div>child</div>`;
      setup() {
        useListener(window, "click", () => steps.push("clicked"));
      }
    }
    class Parent extends Component {
      static template = xml`
        <button t-on-click="() => this.show.set(true)">open</button>
        <Child t-if="this.show()"/>`;
      static components = { Child };
      show = signal(false);
    }

    await mount(Parent, fixture);
    const button = fixture.getElementsByTagName("button")[0];

    const ev = new MouseEvent("click", { bubbles: true });
    button.dispatchEvent(ev);
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>open</button><div>child</div>");

    // the click that created Child is still propagating: Child must not see it
    window.dispatchEvent(ev);
    expect(steps).toEqual([]);

    // any subsequent click is a normal one
    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(steps).toEqual(["clicked"]);
  });

  test("useListener ignores the event that created its component, from another useListener", async () => {
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<div>child</div>`;
      setup() {
        useListener(window, "click", () => steps.push("clicked"));
      }
    }
    class Parent extends Component {
      static template = xml`<Child t-if="this.show()"/>`;
      static components = { Child };
      show = signal(false);
      setup() {
        useListener(window, "click", () => this.show.set(true));
      }
    }

    await mount(Parent, fixture);

    const ev = new MouseEvent("click", { bubbles: true });
    window.dispatchEvent(ev);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>child</div>");

    window.dispatchEvent(ev);
    expect(steps).toEqual([]);

    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(steps).toEqual(["clicked"]);
  });

  test("useListener still receives an event dispatched while it is being attached", async () => {
    // the guard only skips an event that was already in flight: an event
    // dispatched by `setup()` itself is newer than the listener
    let n = 0;

    class MyComponent extends Component {
      static template = xml`<div/>`;
      setup() {
        useListener(window, "click", () => n++);
        window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }
    class Parent extends Component {
      static template = xml`
        <button t-on-click="() => this.show.set(true)">open</button>
        <MyComponent t-if="this.show()"/>`;
      static components = { MyComponent };
      show = signal(false);
    }

    await mount(Parent, fixture);
    fixture
      .getElementsByTagName("button")[0]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();

    expect(n).toBe(1);
  });

  test("useListener keeps the event target as `this`", async () => {
    let receiver: any = null;
    let reference: any = null;

    class MyComponent extends Component {
      static template = xml`<div/>`;
      setup() {
        useListener(window, "click", function (this: EventTarget) {
          receiver = this;
        });
      }
    }

    await mount(MyComponent, fixture);
    // compare with what a plain listener receives, rather than with `window`
    // itself: jsdom's global `window` is not the object handed to listeners
    window.addEventListener(
      "click",
      function (this: EventTarget) {
        reference = this;
      },
      { once: true }
    );
    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(reference).not.toBe(null);
    expect(receiver).toBe(reference);
  });

  describe("useEffect hook", () => {
    test("effect runs on mount, is reapplied on patch, and is cleaned up on unmount and before reapplying", async () => {
      let cleanupRun = 0;
      let steps = [];
      class MyComponent extends Component {
        state = proxy({
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
          <t t-if="this.state.value">
            <div t-ref="this.ref"/>
          </t>`;
        state = proxy({
          value: false,
        });
        ref = signal<HTMLElement | null>(null);
        setup() {
          // could be effect()
          useEffect(() => {
            const el = this.ref();
            logStep("effect started:" + (el ? "EL" : "NULL"));
            return () => logStep("cleaning up effect:" + (el ? "EL" : "NULL"));
          });
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
        state = proxy({
          a: 0,
          b: 0,
        });
        setup() {
          useEffect(() => {
            let a = this.state.a;
            steps.push(`Effect a: ${a}`);
            return () => steps.push(`cleaning up for a: ${a}`);
          });
          useEffect(() => {
            let b = this.state.b;
            steps.push(`Effect b: ${b}`);
            return () => steps.push(`cleaning up for b: ${b}`);
          });
          useEffect(() => {
            let a = this.state.a;
            let b = this.state.b;
            steps.push(`Effect ab: {a: ${a}, b: ${b}}`);
            return () => steps.push(`cleaning up for ab: {a: ${a}, b: ${b}}`);
          });
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

    test("effect that depends on a value is rerun if value changes", async () => {
      let steps = [];
      class MyComponent extends Component {
        state = proxy({
          value: 0,
        });
        setup() {
          useEffect(() => {
            let value = this.state.value;
            steps.push(`value is ${value}`);
            return () => steps.push(`cleaning up for ${value}`);
          });
        }
      }
      MyComponent.template = xml`<div t-out="this.state.value"/>`;

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
        "cleaning up for 0",
        "value is 1",
        "after state mutation",
        "cleaning up for 1",
      ]);
    });

    test("properly behaves when the effect function throws", async () => {
      class MyComponent extends Component {
        static template = xml`<div/>`;
        setup() {
          useEffect(() => {
            throw new Error("Intentional error");
          });
        }
      }

      let error: OwlError;
      try {
        await mount(MyComponent, fixture);
      } catch (e: any) {
        error = e;
      }
      expect(error!.message).toBe("Intentional error");
      expect(getConsoleOutput()).toEqual([]);
    });
  });

  describe("useOnChange hook", () => {
    test("callback runs on mount, on dependency change and is cleaned up", async () => {
      class MyComponent extends Component {
        static template = xml`<div/>`;
        state = proxy({ value: 0 });
        setup() {
          useOnChange(
            () => [this.state.value],
            (value) => {
              logStep(`value is ${value}`);
              return () => logStep(`cleaning up for ${value}`);
            }
          );
        }
      }

      const component = await mount(MyComponent, fixture);
      expect(["value is 0"]).toBeLogged();

      component.state.value++;
      await nextTick();
      expect(["cleaning up for 0", "value is 1"]).toBeLogged();

      await component.__owl__.destroy();
      expect(["cleaning up for 1"]).toBeLogged();
    });

    test("does not run the callback on mount with initialRun=false", async () => {
      class MyComponent extends Component {
        static template = xml`<div/>`;
        value = signal(0);
        setup() {
          useOnChange(
            () => [this.value()],
            (value) => {
              logStep(`value is ${value}`);
              return () => logStep(`cleaning up for ${value}`);
            },
            { initialRun: false }
          );
        }
      }

      const component = await mount(MyComponent, fixture);
      expect([]).toBeLogged();

      component.value.set(1);
      await nextTick();
      expect(["value is 1"]).toBeLogged();

      component.value.set(2);
      await nextTick();
      expect(["cleaning up for 1", "value is 2"]).toBeLogged();

      await component.__owl__.destroy();
      expect(["cleaning up for 2"]).toBeLogged();
    });

    test("reactive values read in the callback are not dependencies", async () => {
      class MyComponent extends Component {
        static template = xml`<div/>`;
        a = signal(0);
        b = signal(0);
        setup() {
          useOnChange(
            () => [this.a()],
            (a) => {
              // reading b here should not subscribe the callback to it
              logStep(`a=${a}, b=${this.b()}`);
              // ... and writing to b should not retrigger it either
              this.b.set(this.b() + 1);
            }
          );
        }
      }

      const component = await mount(MyComponent, fixture);
      expect(["a=0, b=0"]).toBeLogged();

      component.b.set(10);
      await nextTick();
      expect([]).toBeLogged();

      component.a.set(1);
      await nextTick();
      expect(["a=1, b=10"]).toBeLogged();
    });

    test("callback does not run if the dependency values are unchanged", async () => {
      class MyComponent extends Component {
        static template = xml`<div/>`;
        count = signal(0);
        setup() {
          useOnChange(
            () => [this.count() > 10],
            (isBig) => {
              logStep(`isBig=${isBig}`);
              return () => logStep(`cleaning up for isBig=${isBig}`);
            }
          );
        }
      }

      const component = await mount(MyComponent, fixture);
      expect(["isBig=false"]).toBeLogged();

      // count changed, but the dependency value did not
      component.count.set(2);
      await nextTick();
      expect([]).toBeLogged();

      component.count.set(3);
      await nextTick();
      expect([]).toBeLogged();

      // the dependency value now changes
      component.count.set(11);
      await nextTick();
      expect(["cleaning up for isBig=false", "isBig=true"]).toBeLogged();

      component.count.set(12);
      await nextTick();
      expect([]).toBeLogged();
    });

    test("callback receives each dependency as an argument", async () => {
      class MyComponent extends Component {
        static template = xml`<div/>`;
        state = proxy({ a: 1, b: "x" });
        setup() {
          useOnChange(
            () => [this.state.a, this.state.b],
            (a, b) => logStep(`${a.toFixed(1)}/${b.toUpperCase()}`)
          );
        }
      }

      const component = await mount(MyComponent, fixture);
      expect(["1.0/X"]).toBeLogged();

      component.state.b = "y";
      await nextTick();
      expect(["1.0/Y"]).toBeLogged();
    });
  });
});
