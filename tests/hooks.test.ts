import { makeTestEnv, makeTestFixture, nextTick } from "./helpers";
import { Component, Env } from "../src/component/component";
import { useState, onMounted, onWillUnmount } from "../src/hooks";
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
});
