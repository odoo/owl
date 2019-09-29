import { makeTestEnv, makeTestFixture, nextTick } from "./helpers";
import { Component, Env } from "../src/component/component";
import { useState, onMounted, onWillUnmount, useRef, onPatched, onWillPatch } from "../src/hooks";
import { xml } from "../src/tags";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - env: a WEnv, necessary to create new components

let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("hooks", () => {
  test("can use a state hook", async () => {
    class Counter extends Component<any, any> {
      static template = xml`<div><t t-esc="counter.value"/></div>`;
      counter = useState({ value: 42 });
    }
    const counter = new Counter(env);
    await counter.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");
    counter.counter.value = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });

  test("can use onMounted, onWillUnmount", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("mounted");
      });
      onWillUnmount(() => {
        steps.push("willunmount");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook();
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(component).not.toHaveProperty("mounted");
    expect(component).not.toHaveProperty("willUnmount");
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    expect(steps).toEqual(["mounted"]);
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual(["mounted", "willunmount"]);
  });

  test("mounted, willUnmount, onMounted, onWillUnmount order", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("hook:mounted");
      });
      onWillUnmount(() => {
        steps.push("hook:willunmount");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook();
      }
      mounted() {
        steps.push("comp:mounted");
      }
      willUnmount() {
        steps.push("comp:willunmount");
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual(["comp:mounted", "hook:mounted", "hook:willunmount", "comp:willunmount"]);
  });

  test("two different call to mounted/willunmount should work", async () => {
    const steps: string[] = [];
    function useMyHook(i) {
      onMounted(() => {
        steps.push("hook:mounted" + i);
      });
      onWillUnmount(() => {
        steps.push("hook:willunmount" + i);
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey</div>`;
      constructor(env) {
        super(env);
        useMyHook(1);
        useMyHook(2);
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual([
      "hook:mounted1",
      "hook:mounted2",
      "hook:willunmount2",
      "hook:willunmount1"
    ]);
  });

  test("useRef hook", async () => {
    class Counter extends Component<any, any> {
      static template = xml`<div><button t-ref="button"><t t-esc="value"/></button></div>`;
      button = useRef("button");
      value = 0;
      increment() {
        this.value++;
        (this.button.el as HTMLButtonElement).innerHTML = String(this.value);
      }
    }
    const counter = new Counter(env);
    await counter.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><button>0</button></div>");
    counter.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>1</button></div>");
  });

  test("can use onPatched, onWillPatch", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onWillPatch(() => {
        steps.push("willPatch");
      });
      onPatched(() => {
        steps.push("patched");
      });
    }

    class MyComponent extends Component<any, any> {
      static template = xml`<div><t t-if="state.flag">hey</t></div>`;
      state = useState({ flag: true });

      constructor(env) {
        super(env);
        useMyHook();
      }
    }

    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(component).not.toHaveProperty("patched");
    expect(component).not.toHaveProperty("willPatch");
    expect(steps).toEqual([]);

    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    expect(steps).toEqual(["willPatch", "patched"]);
  });

  test("patched, willPatch, onPatched, onWillPatch order", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onPatched(() => {
        steps.push("hook:patched");
      });
      onWillPatch(() => {
        steps.push("hook:willPatch");
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div><t t-if="state.flag">hey</t></div>`;
      state = useState({ flag: true });

      constructor(env) {
        super(env);
        useMyHook();
      }
      willPatch() {
        steps.push("comp:willPatch");
      }
      patched() {
        steps.push("comp:patched");
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.state.flag = false;
    await nextTick();

    expect(steps).toEqual(["hook:willPatch", "comp:willPatch", "comp:patched", "hook:patched"]);
  });

  test("two different call to willPatch/patched should work", async () => {
    const steps: string[] = [];
    function useMyHook(i) {
      onPatched(() => {
        steps.push("hook:patched" + i);
      });
      onWillPatch(() => {
        steps.push("hook:willPatch" + i);
      });
    }
    class MyComponent extends Component<any, any> {
      static template = xml`<div>hey<t t-esc="state.value"/></div>`;
      state = useState({ value: 1 });
      constructor(env) {
        super(env);
        useMyHook(1);
        useMyHook(2);
      }
    }
    const component = new MyComponent(env);
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey1</div>");
    component.state.value++;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>hey2</div>");

    expect(steps).toEqual([
      "hook:willPatch2",
      "hook:willPatch1",
      "hook:patched1",
      "hook:patched2"
    ]);
  });

  describe("autofocus hook", () => {
    function useAutofocus(name) {
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
      class SomeComponent extends Component<any, any> {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <input t-ref="input2"/>
            </div>`;

        constructor(env) {
          super(env);
          useAutofocus("input2");
        }
      }

      const component = new SomeComponent(env);
      await component.mount(fixture);
      expect(fixture.innerHTML).toBe("<div><input><input></div>");
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });

    test("input in a t-if", async () => {
      class SomeComponent extends Component<any, any> {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <t t-if="state.flag"><input t-ref="input2"/></t>
            </div>`;

        state = useState({ flag: false });
        constructor(env) {
          super(env);
          useAutofocus("input2");
        }
      }

      const component = new SomeComponent(env);
      await component.mount(fixture);
      expect(fixture.innerHTML).toBe("<div><input></div>");
      expect(document.activeElement).toBe(document.body);

      component.state.flag = true;
      await nextTick();
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });
  });
});
