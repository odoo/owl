import { makeDeferred, makeTestEnv, makeTestFixture, nextTick } from "./helpers";
import { Component, Env } from "../src/component/component";
import { Context, useContext } from "../src/context";
import { xml } from "../src/tags";
import { useState } from "../src/hooks";

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

describe("Context", () => {
  test("very simple use, with initial value", async () => {
    const testContext = new Context({ value: 123 });

    class Test extends Component<any, any> {
      static template = xml`<div><t t-esc="contextObj.value"/></div>`;
      contextObj = useContext(testContext);
    }
    const test = new Test(env);
    await test.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>123</div>");
  });

  test("useContext hook is reactive, for one component", async () => {
    const testContext = new Context({ value: 123 });

    class Test extends Component<any, any> {
      static template = xml`<div><t t-esc="contextObj.value"/></div>`;
      contextObj = useContext(testContext);
    }
    const test = new Test(env);
    await test.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>123</div>");
    test.contextObj.value = 321;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>321</div>");
  });

  test("two components can subscribe to same context", async () => {
    const testContext = new Context({ value: 123 });

    class Child extends Component<any, any> {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      contextObj = useContext(testContext);
    }
    class Parent extends Component<any, any> {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.state.value = 321;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>321</span><span>321</span></div>");
  });

  test("one components can subscribe twice to same context", async () => {
    const testContext = new Context({ a: 1, b: 2 });
    const steps: string[] = [];

    class Child extends Component<any, any> {
      static template = xml`<span><t t-esc="contextObj1.a"/><t t-esc="contextObj2.b"/></span>`;
      contextObj1 = useContext(testContext);
      contextObj2 = useContext(testContext);
      __render(fiber) {
        steps.push("child");
        return super.__render(fiber);
      }
    }
    class Parent extends Component<any, any> {
      static template = xml`<div><Child /></div>`;
      static components = { Child };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>12</span></div>");
    expect(steps).toEqual(["child"]);
    testContext.state.a = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>32</span></div>");
    expect(steps).toEqual(["child", "child"]);
  });

  test("parent and children subscribed to same context", async () => {
    const testContext = new Context({ a: 123, b: 321 });
    const steps: string[] = [];

    class Child extends Component<any, any> {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useContext(testContext);
      __render(fiber) {
        steps.push("child");
        return super.__render(fiber);
      }
    }
    class Parent extends Component<any, any> {
      static template = xml`<div><Child /><t t-esc="contextObj.b"/></div>`;
      static components = { Child };
      contextObj = useContext(testContext);
      __render(fiber) {
        steps.push("parent");
        return super.__render(fiber);
      }
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span>321</div>");
    expect(steps).toEqual(["parent", "child"]);

    parent.contextObj.a = 124;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>124</span>321</div>");

    // we only  want one render from the child here, not two
    expect(steps).toEqual(["parent", "child", "parent", "child"]);
  });

  test("destroyed component is inactive", async () => {
    const testContext = new Context({ a: 123 });
    const steps: string[] = [];

    class Child extends Component<any, any> {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useContext(testContext);
      __render(fiber) {
        steps.push("child");
        return super.__render(fiber);
      }
    }
    class Parent extends Component<any, any> {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
      __render(fiber) {
        steps.push("parent");
        return super.__render(fiber);
      }
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span></div>");
    expect(steps).toEqual(["parent", "child"]);
    expect(testContext.subscriptions.update.length).toBe(1);

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps).toEqual(["parent", "child", "parent"]);
    // kind of whitebox...
    // we make sure we do not have any pending subscriptions to the 'update'
    // event
    expect(testContext.subscriptions.update.length).toBe(0);
  });

  test("concurrent renderings", async () => {
    const testContext = new Context({ x: { n: 1 }, key: "x" });
    const def = makeDeferred();
    let stateC;
    class ComponentC extends Component<any, any> {
      static template = xml`<span><t t-esc="context[props.key].n"/><t t-esc="state.x"/></span>`;
      context = useContext(testContext);
      state = useState({ x: "a" });

      constructor(parent, props) {
        super(parent, props);
        stateC = this.state;
      }
    }
    class ComponentB extends Component<any, any> {
      static components = { ComponentC };
      static template = xml`<p><ComponentC key="props.key"/></p>`;

      willUpdateProps() {
        return def;
      }
    }
    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB key="context.key"/></div>`;
      context = useContext(testContext);
    }

    const component = new ComponentA(env);
    await component.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><p><span>1a</span></p></div>");
    testContext.state.key = "y";
    testContext.state.y = { n: 2 };
    delete testContext.state.x;
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><p><span>1a</span></p></div>");
    stateC.x = "b";
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><p><span>1a</span></p></div>");
    def.resolve();
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><p><span>2b</span></p></div>");
  });
});
