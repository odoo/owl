import {
  Component,
  mount,
  onPatched,
  onWillRender,
  onWillPatch,
  onWillUnmount,
  useState,
  xml,
  toRaw,
} from "../../src";
import { makeTestFixture, nextTick, snapshotEverything, steps, useLogLifecycle } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("reactivity in lifecycle", () => {
  test("can use a state hook", async () => {
    class Counter extends Component {
      static template = xml`<div><t t-esc="counter.value"/></div>`;
      counter = useState({ value: 42 });
    }
    const counter = await mount(Counter, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");
    counter.counter.value = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });

  test("can use a state hook 2", async () => {
    let n = 0;
    class Comp extends Component {
      static template = xml`<div><t t-esc="state.a"/></div>`;
      state = useState({ a: 5, b: 7 });
      setup() {
        onWillRender(() => n++);
      }
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe("<div>5</div>");
    expect(n).toBe(1);
    comp.state.a = 11;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>11</div>");
    expect(n).toBe(2);
    comp.state.b = 13;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>11</div>");
    expect(n).toBe(2); // no new rendering occured: b was never read via state!
  });

  test("can use a state hook on Map", async () => {
    class Counter extends Component {
      static template = xml`<div><t t-esc="counter.get('value')"/></div>`;
      counter = useState(new Map([["value", 42]]));
    }
    const counter = await mount(Counter, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");
    counter.counter.set("value", 3);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });

  test("state changes in willUnmount do not trigger rerender", async () => {
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`
          <span><t t-esc="props.val"/><t t-esc="state.n"/></span>
        `;
      state = useState({ n: 2 });
      setup() {
        onWillRender(() => {
          steps.push("render");
        });
        onWillPatch(() => {
          steps.push("willPatch");
        });
        onPatched(() => {
          steps.push("patched");
        });
        onWillUnmount(() => {
          steps.push("willUnmount");
          this.state.n = 3;
        });
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Child t-if="state.flag" val="state.val"/>
          </div>
        `;
      static components = { Child };
      state = useState({ val: 1, flag: true });
    }
    const parent = await mount(Parent, fixture);
    expect(steps).toEqual(["render"]);
    expect(fixture.innerHTML).toBe("<div><span>12</span></div>");
    parent.state.flag = false;
    await nextTick();
    // we make sure here that no call to __render is done
    expect(steps).toEqual(["render", "willUnmount"]);
  });

  test("change state just before mounting component", async () => {
    // const steps: number[] = [];
    // class TestWidget extends Component {
    //   static template = xml`
    //       <div><t t-esc="state.val"/></div>
    //     `;
    //   state = useState({ val: 1 });
    //   __render(f) {
    //     steps.push(this.state.val);
    //     return super.__render(f);
    //   }
    // }
    // TestWidget.prototype.__render = jest.fn(TestWidget.prototype.__render);
    // const widget = new TestWidget();
    // widget.state.val = 2;
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>2</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(1);
    // // unmount and re-mount, as in this case, willStart won't be called, so it's
    // // slightly different
    // widget.unmount();
    // widget.state.val = 3;
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>3</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(2);
    // expect(steps).toEqual([2, 3]);
  });

  test("change state while mounting component", async () => {
    const steps: any[] = [];
    let STATE;
    class Comp extends Component {
      static template = xml`
          <div><t t-esc="state.val"/></div>
        `;
      state = useState({ val: 1 });
      setup() {
        STATE = this.state;
        onWillRender(() => {
          steps.push(this.state.val);
        });
      }
    }
    const prom = mount(Comp, fixture);
    (STATE as any).val = 2;
    await prom;
    expect(steps).toEqual([2]);
    expect(fixture.innerHTML).toBe("<div>2</div>");
  });

  test("Child component doesn't render when state they depend on changes but their parent is about to unmount them", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.state.content.a"/>`;
      setup() {
        useLogLifecycle();
      }
    }
    class Parent extends Component {
      static template = xml`<Child t-if="state.renderChild" state="state"/>`;
      static components = { Child };
      state: any = useState({ renderChild: true, content: { a: 2 } });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("2");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Child:setup",
        "Child:willStart",
        "Parent:rendered",
        "Child:willRender",
        "Child:rendered",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);

    parent.state.content = null;
    parent.state.renderChild = false;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Parent:rendered",
        "Parent:willPatch",
        "Child:willUnmount",
        "Child:willDestroy",
        "Parent:patched",
      ]
    `);
  });

  test("Component is automatically subscribed to reactive object received as prop", async () => {
    let childRenderCount = 0;
    let parentRenderCount = 0;
    class Child extends Component {
      static template = xml`<t t-esc="props.obj.a"/><t t-esc="props.reactiveObj.b"/>`;
      setup() {
        onWillRender(() => childRenderCount++);
      }
    }
    class Parent extends Component {
      static template = xml`<Child obj="obj" reactiveObj="reactiveObj"/>`;
      static components = { Child };
      obj = { a: 1 };
      reactiveObj = useState({ b: 2 });
      setup() {
        onWillRender(() => parentRenderCount++);
      }
    }
    const comp = await mount(Parent, fixture);
    expect([parentRenderCount, childRenderCount]).toEqual([1, 1]);
    expect(fixture.innerHTML).toBe("12");
    comp.obj.a = 3; // non reactive object, shouldn't cause render
    await nextTick();
    expect([parentRenderCount, childRenderCount]).toEqual([1, 1]);
    expect(fixture.innerHTML).toBe("12");
    comp.reactiveObj.b = 4;
    await nextTick();
    // Only child should be rendered: the parent never read the b key in reactiveObj
    expect([parentRenderCount, childRenderCount]).toEqual([1, 2]);
    expect(fixture.innerHTML).toBe("34");
  });
});

describe("subscriptions", () => {
  test("subscriptions returns the keys and targets observed by the component", async () => {
    class Comp extends Component {
      static template = xml`<t t-esc="state.a"/>`;
      state = useState({ a: 1, b: 2 });
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe("1");
    expect(comp.__owl__.subscriptions).toEqual([{ keys: ["a"], target: toRaw(comp.state) }]);
  });

  test("subscriptions returns the keys observed by the component", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.state.b"/>`;
      setup() {
        child = this;
      }
    }
    let child: Child;
    class Parent extends Component {
      static template = xml`<t t-esc="state.a"/><Child state="state"/>`;
      static components = { Child };
      state = useState({ a: 1, b: 2 });
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("12");
    expect(parent.__owl__.subscriptions).toEqual([{ keys: ["a"], target: toRaw(parent.state) }]);
    expect(child!.__owl__.subscriptions).toEqual([{ keys: ["b"], target: toRaw(parent.state) }]);
  });
});
