import { Component, mount, proxy, xml } from "../../src";
import { makeTestFixture, nextTick, render, snapshotEverything, steps, useLogLifecycle } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-component", () => {
  test("t-component works in simple case", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<t t-component="this.Child"/>`;
      Child = Child;
      setup() {
        useLogLifecycle();
      }
    }

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div>child</div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);
  });

  test("switching dynamic component", async () => {
    class ChildA extends Component {
      static template = xml`<div>child a</div>`;
      setup() {
        useLogLifecycle();
      }
    }

    class ChildB extends Component {
      static template = xml`child b`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<t t-component="this.Child"/>`;
      Child = ChildA;
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>child a</div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "ChildA:setup",
        "ChildA:willStart",
        "ChildA:mounted",
        "Parent:mounted",
      ]
    `);

    parent.Child = ChildB;
    render(parent);
    await nextTick();
    expect(fixture.innerHTML).toBe("child b");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "ChildB:setup",
        "ChildB:willStart",
        "Parent:willPatch",
        "ChildA:willUnmount",
        "ChildA:willDestroy",
        "ChildB:mounted",
        "Parent:patched",
      ]
    `);
  });

  test("can switch between dynamic components without the need for a t-key", async () => {
    class A extends Component {
      static template = xml`<span>child a</span>`;
    }
    class B extends Component {
      static template = xml`<span>child b</span>`;
    }
    class App extends Component {
      static template = xml`
        <div>
            <t t-component="this.constructor.components[this.state.child]"/>
        </div>`;
      static components = { A, B };

      state = proxy({ child: "A" });
    }
    const app = await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><span>child a</span></div>");
    app.state.child = "B";
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>child b</span></div>");
  });

  test("can use dynamic components (the class) if given", async () => {
    class A extends Component {
      static template = xml`<span>child a</span>`;
    }
    class B extends Component {
      static template = xml`<span>child b</span>`;
    }
    class Parent extends Component {
      static template = xml`<t t-component="this.myComponent" t-key="this.state.child"/>`;
      state = proxy({
        child: "a",
      });
      get myComponent() {
        return this.state.child === "a" ? A : B;
      }
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>child a</span>");
    parent.state.child = "b";
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>child b</span>");
  });

  test("can use dynamic components (the class) if given (with different root tagname)", async () => {
    class A extends Component {
      static template = xml`<span>child a</span>`;
    }
    class B extends Component {
      static template = xml`<div>child b</div>`;
    }
    class Parent extends Component {
      static template = xml`<t t-component="this.myComponent" t-key="this.state.child"/>`;
      state = proxy({
        child: "a",
      });
      get myComponent() {
        return this.state.child === "a" ? A : B;
      }
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>child a</span>");
    parent.state.child = "b";
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>child b</div>");
  });

  test("modifying a sub widget", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-out="this.state.counter"/><button t-on-click="() => this.state.counter++">Inc</button></div>`;
      state = proxy({
        counter: 0,
      });
    }

    class ParentWidget extends Component {
      static template = xml`<div><t t-component="this.Counter"/></div>`;

      get Counter() {
        return Counter;
      }
    }
    await mount(ParentWidget, fixture);
    expect(fixture.innerHTML).toBe("<div><div>0<button>Inc</button></div></div>");
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>1<button>Inc</button></div></div>");
  });

  test("t-component not on a <t> node", async () => {
    class Child extends Component {
      static template = xml`<span>1</span>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><div t-component="this.uChild"/></div>`;
    }
    let error: Error;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      `Directive 't-component' can only be used on <t> nodes (used on a <div>)`
    );
  });
});
