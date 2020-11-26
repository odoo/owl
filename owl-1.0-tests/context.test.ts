import { makeDeferred, makeTestEnv, makeTestFixture, nextTick } from "./helpers";
import { Component } from "../src/component/component";
import { Context, useContext } from "../src/context";
import { xml } from "../src/tags";
import { useState } from "../src/hooks";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - a test env, necessary to create components, that is set as env

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
  Component.env = makeTestEnv();
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

    class Test extends Component {
      static template = xml`<div><t t-esc="contextObj.value"/></div>`;
      contextObj = useContext(testContext);
    }
    const test = new Test();
    await test.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>123</div>");
  });

  test("useContext hook is reactive, for one component", async () => {
    const testContext = new Context({ value: 123 });

    class Test extends Component {
      static template = xml`<div><t t-esc="contextObj.value"/></div>`;
      contextObj = useContext(testContext);
    }
    const test = new Test();
    await test.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>123</div>");
    test.contextObj.value = 321;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>321</div>");
  });

  test("two components can subscribe to same context", async () => {
    const testContext = new Context({ value: 123 });

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      contextObj = useContext(testContext);
    }
    class Parent extends Component {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.state.value = 321;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>321</span><span>321</span></div>");
  });

  test("two async components are updated in parallel", async () => {
    const testContext = new Context({ value: 123 });
    const def = makeDeferred();
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      contextObj = useContext(testContext);
      async render() {
        steps.push("render");
        await def;
        return super.render();
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.state.value = 321;
    await nextTick();
    expect(steps).toEqual(["render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>321</span><span>321</span></div>");
  });

  test("two async components on two levels are updated (mostly) in parallel", async () => {
    const testContext = new Context({ value: 123 });
    const def = makeDeferred();
    const steps: string[] = [];

    class SlowComp extends Component {
      static template = xml`<p><t t-esc="props.value"/></p>`;
      willUpdateProps() {
        return def;
      }
    }
    class Child extends Component {
      static template = xml`<span><SlowComp value="contextObj.value"/></span>`;
      static components = { SlowComp };
      contextObj = useContext(testContext);

      render() {
        steps.push("render");
        return super.render();
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
    }

    class App extends Component {
      static template = xml`<div><Child /><Parent /></div>`;
      static components = { Child, Parent };
    }

    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><span><p>123</p></span><div><span><p>123</p></span><span><p>123</p></span></div></div>"
    );
    testContext.state.value = 321;
    await nextTick();
    expect(steps).toEqual(["render"]);
    expect(fixture.innerHTML).toBe(
      "<div><span><p>123</p></span><div><span><p>123</p></span><span><p>123</p></span></div></div>"
    );
    def.resolve();
    await nextTick();
    // we need to wait for an extra tick because it could happen (even though it
    // is rare) that the second batch of renderings is not done yet, because
    // the initial promise has been given to the macrotask queue, so a small
    // delay happens.
    await nextTick();
    expect(steps).toEqual(["render", "render", "render"]);
    expect(fixture.innerHTML).toBe(
      "<div><span><p>321</p></span><div><span><p>321</p></span><span><p>321</p></span></div></div>"
    );
  });

  test("one components can subscribe twice to same context", async () => {
    const testContext = new Context({ a: 1, b: 2 });
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj1.a"/><t t-esc="contextObj2.b"/></span>`;
      contextObj1 = useContext(testContext);
      contextObj2 = useContext(testContext);
      __render(fiber) {
        steps.push("child");
        return super.__render(fiber);
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child /></div>`;
      static components = { Child };
    }
    const parent = new Parent();
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

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useContext(testContext);
      __render(fiber) {
        steps.push("child");
        return super.__render(fiber);
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child /><t t-esc="contextObj.b"/></div>`;
      static components = { Child };
      contextObj = useContext(testContext);
      __render(fiber) {
        steps.push("parent");
        return super.__render(fiber);
      }
    }
    const parent = new Parent();
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

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useContext(testContext);
      __render(fiber) {
        steps.push("child");
        return super.__render(fiber);
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
      __render(fiber) {
        steps.push("parent");
        return super.__render(fiber);
      }
    }
    const parent = new Parent();
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

  test("destroyed component before being mounted is inactive", async () => {
    const testContext = new Context({ a: 123 });

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useContext(testContext);
      willStart() {
        return makeDeferred();
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
    }

    const parent = new Parent();
    const prom = parent.mount(fixture);
    await nextTick(); // wait for Child to be instantiated
    expect(testContext.subscriptions.update.length).toBe(1);
    parent.state.flag = false;
    await prom;
    expect(fixture.innerHTML).toBe("<div></div>");
    // kind of whitebox...
    // we make sure we do not have any pending subscriptions to the 'update'
    // event
    expect(testContext.subscriptions.update.length).toBe(0);
  });

  test("concurrent renderings", async () => {
    const testContext = new Context({ x: { n: 1 }, key: "x" });
    const def = makeDeferred();
    let stateC;
    class ComponentC extends Component {
      static template = xml`<span><t t-esc="context[props.key].n"/><t t-esc="state.x"/></span>`;
      context = useContext(testContext);
      state = useState({ x: "a" });

      constructor(parent, props) {
        super(parent, props);
        stateC = this.state;
      }
    }
    class ComponentB extends Component {
      static components = { ComponentC };
      static template = xml`<p><ComponentC key="props.key"/></p>`;

      willUpdateProps() {
        return def;
      }
    }
    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB key="context.key"/></div>`;
      context = useContext(testContext);
    }

    const component = new ComponentA();
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
