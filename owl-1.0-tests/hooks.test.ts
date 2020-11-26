import { makeTestEnv, makeTestFixture, nextTick } from "../tests/helpers";
import { Component, Env } from "../src/component/component";
import {
  useState,
  onMounted,
  onWillUnmount,
  useRef,
  onPatched,
  onWillPatch,
  onWillStart,
  onWillUpdateProps,
  useSubEnv,
  useExternalListener,
} from "../src/hooks";
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
  Component.env = env;
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("hooks", () => {
  test("can use a state hook", async () => {
    class Counter extends Component {
      static template = xml`<div><t t-esc="counter.value"/></div>`;
      counter = useState({ value: 42 });
    }
    const counter = new Counter();
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
    class MyComponent extends Component {
      static template = xml`<div>hey</div>`;
      constructor() {
        super();
        useMyHook();
      }
    }
    const component = new MyComponent();
    await component.mount(fixture);
    expect(component).not.toHaveProperty("mounted");
    expect(component).not.toHaveProperty("willUnmount");
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    expect(steps).toEqual(["mounted"]);
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual(["mounted", "willunmount"]);
  });

  test("can use onMounted, onWillUnmount, part 2", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("mounted");
      });
      onWillUnmount(() => {
        steps.push("willunmount");
      });
    }
    class MyComponent extends Component {
      static template = xml`<div>hey</div>`;
      constructor(parent, props) {
        super(parent, props);
        useMyHook();
      }
    }

    class Parent extends Component {
      static template = xml`<div><MyComponent t-if="state.flag"/></div>`;
      static components = { MyComponent };
      state = useState({ flag: true });
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>hey</div></div>");
    expect(steps).toEqual(["mounted"]);

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
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
    class MyComponent extends Component {
      static template = xml`<div>hey</div>`;
      constructor() {
        super();
        useMyHook();
      }
      mounted() {
        steps.push("comp:mounted");
      }
      willUnmount() {
        steps.push("comp:willunmount");
      }
    }
    const component = new MyComponent();
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual(["comp:mounted", "hook:mounted", "hook:willunmount", "comp:willunmount"]);
  });

  test("mounted, willUnmount, onMounted, onWillUnmount order, part 2", async () => {
    const steps: string[] = [];
    function useMyHook() {
      onMounted(() => {
        steps.push("hook:mounted");
      });
      onWillUnmount(() => {
        steps.push("hook:willunmount");
      });
    }
    class MyComponent extends Component {
      static template = xml`<div>hey</div>`;
      constructor(parent, props) {
        super(parent, props);
        useMyHook();
      }
      mounted() {
        steps.push("comp:mounted");
      }
      willUnmount() {
        steps.push("comp:willunmount");
      }
    }

    class Parent extends Component {
      static template = xml`<div><MyComponent t-if="state.flag"/></div>`;
      static components = { MyComponent };
      state = useState({ flag: true });
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>hey</div></div>");
    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

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
    class MyComponent extends Component {
      static template = xml`<div>hey</div>`;
      constructor() {
        super();
        useMyHook(1);
        useMyHook(2);
      }
    }
    const component = new MyComponent();
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    component.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual([
      "hook:mounted1",
      "hook:mounted2",
      "hook:willunmount2",
      "hook:willunmount1",
    ]);
  });

  test("useRef hook", async () => {
    class Counter extends Component {
      static template = xml`<div><button t-ref="button"><t t-esc="value"/></button></div>`;
      button = useRef("button");
      value = 0;
      increment() {
        this.value++;
        (this.button.el as HTMLButtonElement).innerHTML = String(this.value);
      }
    }
    const counter = new Counter();
    expect(counter.button.el).toBe(null);
    await counter.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><button>0</button></div>");
    expect(counter.button.el).not.toBe(null);
    expect(counter.button.el).toBe(fixture.querySelector("button"));
    counter.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>1</button></div>");
  });

  test("useRef hook is null if ref is removed ", async () => {
    expect.assertions(4);
    class TestRef extends Component {
      static template = xml`<div><span t-if="state.flag" t-ref="span">owl</span></div>`;
      spanRef = useRef("span");
      state = useState({ flag: true });
      willPatch() {
        expect(this.spanRef.el).not.toBeNull();
      }
      patched() {
        expect(this.spanRef.el).toBeNull();
      }
    }
    const component = new TestRef();
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>owl</span></div>");
    component.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test("t-refs on widget are components", async () => {
    class WidgetB extends Component {
      static template = xml`<div>b</div>`;
    }
    class WidgetC extends Component {
      static template = xml`<div class="outer-div">Hello<WidgetB t-ref="mywidgetb" /></div>`;
      static components = { WidgetB };
      ref = useRef<WidgetB>("mywidgetb");
    }

    const widget = new WidgetC();
    expect(widget.ref.comp).toBe(null);
    expect(widget.ref.el).toBe(null);
    await widget.mount(fixture);
    expect(widget.ref.comp).toBeInstanceOf(WidgetB);
    expect(widget.ref.el).toEqual(fixture.querySelector(".outer-div > div"));
  });

  test("t-refs are bound at proper timing", async () => {
    expect.assertions(2);
    class Widget extends Component {
      static template = xml`<div>widget</div>`;
    }

    class ParentWidget extends Component {
      static template = xml`
        <div>
          <t t-foreach="state.list" t-as="elem" t-ref="child" t-key="elem" t-component="Widget"/>
        </div>
      `;
      static components = { Widget };
      state = useState({ list: <any>[] });
      child = useRef("child");
      willPatch() {
        expect(this.child.comp).toBeNull();
      }
      patched() {
        expect(this.child.comp).not.toBeNull();
      }
    }

    const parent = new ParentWidget();
    await parent.mount(fixture);
    parent.state.list.push(1);
    await nextTick();
  });

  test("t-refs are bound at proper timing (2)", async () => {
    expect.assertions(10);
    class Widget extends Component {
      static template = xml`<div>widget</div>`;
    }
    class ParentWidget extends Component {
      static template = xml`
        <div>
          <t t-if="state.child1" t-ref="child1" t-component="Widget"/>
          <t t-if="state.child2" t-ref="child2" t-component="Widget"/>
        </div>`;
      static components = { Widget };
      state = useState({ child1: true, child2: false });
      child1 = useRef("child1");
      child2 = useRef("child2");
      count = 0;
      mounted() {
        expect(this.child1.comp).toBeDefined();
        expect(this.child2.comp).toBeNull();
      }
      willPatch() {
        if (this.count === 0) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeNull();
        }
        if (this.count === 1) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeDefined();
        }
      }
      patched() {
        if (this.count === 0) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeDefined();
        }
        if (this.count === 1) {
          expect(this.child1.comp).toBeNull();
          expect(this.child2.comp).toBeDefined();
        }
        this.count++;
      }
    }

    const parent = new ParentWidget();
    await parent.mount(fixture);
    parent.state.child2 = true;
    await nextTick();
    parent.state.child1 = false;
    await nextTick();
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

    class MyComponent extends Component {
      static template = xml`<div><t t-if="state.flag">hey</t></div>`;
      state = useState({ flag: true });

      constructor() {
        super();
        useMyHook();
      }
    }

    const component = new MyComponent();
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
    class MyComponent extends Component {
      static template = xml`<div><t t-if="state.flag">hey</t></div>`;
      state = useState({ flag: true });

      constructor() {
        super();
        useMyHook();
      }
      willPatch() {
        steps.push("comp:willPatch");
      }
      patched() {
        steps.push("comp:patched");
      }
    }
    const component = new MyComponent();
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
    class MyComponent extends Component {
      static template = xml`<div>hey<t t-esc="state.value"/></div>`;
      state = useState({ value: 1 });
      constructor() {
        super();
        useMyHook(1);
        useMyHook(2);
      }
    }
    const component = new MyComponent();
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey1</div>");
    component.state.value++;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>hey2</div>");

    expect(steps).toEqual(["hook:willPatch2", "hook:willPatch1", "hook:patched1", "hook:patched2"]);
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
      class SomeComponent extends Component {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <input t-ref="input2"/>
            </div>`;

        constructor() {
          super();
          useAutofocus("input2");
        }
      }

      const component = new SomeComponent();
      await component.mount(fixture);
      expect(fixture.innerHTML).toBe("<div><input><input></div>");
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });

    test("input in a t-if", async () => {
      class SomeComponent extends Component {
        static template = xml`
            <div>
                <input t-ref="input1"/>
                <t t-if="state.flag"><input t-ref="input2"/></t>
            </div>`;

        state = useState({ flag: false });
        constructor() {
          super();
          useAutofocus("input2");
        }
      }

      const component = new SomeComponent();
      await component.mount(fixture);
      expect(fixture.innerHTML).toBe("<div><input></div>");
      expect(document.activeElement).toBe(document.body);

      component.state.flag = true;
      await nextTick();
      const input2 = fixture.querySelectorAll("input")[1];
      expect(input2).toBe(document.activeElement);
    });
  });

  test("can use sub env", async () => {
    class TestComponent extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      constructor() {
        super();
        useSubEnv({ val: 3 });
      }
    }
    const component = new TestComponent();
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>3</div>");
    expect(env).not.toHaveProperty("val");
    expect(component.env).toHaveProperty("val");
  });

  test("parent and child env", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="env.val"/></div>`;
      constructor(parent, props) {
        super(parent, props);
        useSubEnv({ val: 5 });
      }
    }

    class Parent extends Component {
      static template = xml`<div><t t-esc="env.val"/><Child/></div>`;
      static components = { Child };
      constructor() {
        super();
        useSubEnv({ val: 3 });
      }
    }
    const component = new Parent();
    await component.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>3<div>5</div></div>");
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
      constructor(parent, props) {
        super(parent, props);
        useMyHook();
        use2ndHook();
      }
    }
    class App extends Component {
      static template = xml`<div><MyComponent value="state.value"/></div>`;
      static components = { MyComponent };
      state = useState({ value: 1 });
    }

    const app = new App();
    await app.mount(fixture);
    expect(app).not.toHaveProperty("willStart");
    expect(app).not.toHaveProperty("willUpdateProps");
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

    // NOTE: 'on2ndStart' appears first in the list even though
    // the 'use2ndHook' is declared after 'useMyHook'. This is
    // because Promise.all is used to call the callbacks specified
    // in the hooks, which runs them simultaneously.
    // Additionally, 'slow' should be listed before 'onWillStart'
    // because call to `slow` is awaited.
    expect(steps).toEqual(["on2ndStart", "slow", "onWillStart"]);

    app.state.value = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>2</span></div>");
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
      constructor(parent, props) {
        super(parent, props);
        useExternalListener(window as any, "click", this.increment);
      }
      increment() {
        n++;
      }
    }
    class App extends Component {
      static template = xml`<div><MyComponent t-if="state.flag"/></div>`;
      static components = { MyComponent };
      state = useState({ flag: false });
    }

    const app = new App();
    await app.mount(fixture);

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
