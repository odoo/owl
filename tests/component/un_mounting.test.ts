import { Component, Env } from "../../src/component/component";
import { useState } from "../../src/hooks";
import { xml } from "../../src/tags";
import { makeDeferred, makeTestEnv, makeTestFixture, nextTick, nextMicroTick } from "../helpers";

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

describe("mount targets", () => {
  test("can attach a component to an existing node (if same tagname)", async () => {
    class App extends Component {
      static template = xml`<div>app</div>`;
    }
    const div = document.createElement("div");
    fixture.appendChild(div);

    const app = new App();
    await app.mount(div, { position: "self" });
    expect(fixture.innerHTML).toBe("<div>app</div>");
  });

  test("cannot attach a component to an existing node (if not same tagname)", async () => {
    class App extends Component {
      static template = xml`<span>app</span>`;
    }
    const div = document.createElement("div");
    fixture.appendChild(div);

    const app = new App();
    let error;
    try {
      await app.mount(div, { position: "self" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot attach 'App' to target node (not same tag name)");
  });

  test("can mount a component (with position='first-child')", async () => {
    class App extends Component {
      static template = xml`<div>app</div>`;
    }
    const span = document.createElement("span");
    fixture.appendChild(span);

    const app = new App();
    await app.mount(fixture, { position: "first-child" });
    expect(fixture.innerHTML).toBe("<div>app</div><span></span>");
  });

  test("can mount a component (with position='last-child')", async () => {
    class App extends Component {
      static template = xml`<div>app</div>`;
    }
    const span = document.createElement("span");
    fixture.appendChild(span);

    const app = new App();
    await app.mount(fixture, { position: "last-child" });
    expect(fixture.innerHTML).toBe("<span></span><div>app</div>");
  });

  test("default mount option is 'last-child'", async () => {
    class App extends Component {
      static template = xml`<div>app</div>`;
    }
    const span = document.createElement("span");
    fixture.appendChild(span);

    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<span></span><div>app</div>");
  });
});

describe("unmounting and remounting", () => {
  test("widget can be unmounted and remounted", async () => {
    const steps: string[] = [];
    class MyWidget extends Component {
      static template = xml`<div>Hey</div>`;
      async willStart() {
        steps.push("willstart");
      }
      mounted() {
        steps.push("mounted");
      }
      willUnmount() {
        steps.push("willunmount");
      }
      patched() {
        throw new Error("patched should not be called");
      }
    }

    const w = new MyWidget();
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hey</div>");
    expect(steps).toEqual(["willstart", "mounted"]);

    w.unmount();
    expect(fixture.innerHTML).toBe("");
    expect(steps).toEqual(["willstart", "mounted", "willunmount"]);

    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hey</div>");
    expect(steps).toEqual(["willstart", "mounted", "willunmount", "mounted"]);
  });

  test("widget can be mounted twice without ill effect", async () => {
    const steps: string[] = [];
    class MyWidget extends Component {
      static template = xml`<div>Hey</div>`;
      async willStart() {
        steps.push("willstart");
      }
      mounted() {
        steps.push("mounted");
      }
      willUnmount() {
        steps.push("willunmount");
      }
    }

    const w = new MyWidget();
    await w.mount(fixture);
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hey</div>");
    expect(steps).toEqual(["willstart", "mounted"]);
  });

  test("state changes in willUnmount do not trigger rerender", async () => {
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`
          <span><t t-esc="props.val"/><t t-esc="state.n"/></span>
        `;
      state = useState({ n: 2 });
      __render(f) {
        steps.push("render");
        return super.__render(f);
      }
      willPatch() {
        steps.push("willPatch");
      }
      patched() {
        steps.push("patched");
      }

      willUnmount() {
        steps.push("willUnmount");
        this.state.n = 3;
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

    const widget = new Parent();
    await widget.mount(fixture);
    expect(steps).toEqual(["render"]);
    expect(fixture.innerHTML).toBe("<div><span>12</span></div>");
    widget.state.flag = false;
    await nextTick();
    // we make sure here that no call to __render is done
    expect(steps).toEqual(["render", "willUnmount"]);
  });

  test("state changes in willUnmount will be applied on remount", async () => {
    class TestWidget extends Component {
      static template = xml`
          <div><t t-esc="state.val"/></div>
        `;
      state = useState({ val: 1 });
      willUnmount() {
        this.state.val = 3;
      }
    }

    const widget = new TestWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");
    widget.unmount();
    expect(fixture.innerHTML).toBe("");
    await nextTick(); // wait for changes to be detected before remounting
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>3</div>");
    // we want to make sure that there are no remaining tasks left at this point.
    expect(Component.scheduler.tasks.length).toBe(0);
  });

  test("sub component is still active after being unmounted and remounted", async () => {
    class Child extends Component {
      static template = xml`
          <p t-on-click="state.value++">
            <t t-esc="state.value"/>
          </p>`;

      state = useState({ value: 1 });
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><Child/></div>`;
    }

    const w = new Parent();
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>1</p></div>");

    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><p>2</p></div>");
    w.unmount();
    await nextTick();
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>2</p></div>");
    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  });

  test("change state just before mounting component", async () => {
    const steps: number[] = [];
    class TestWidget extends Component {
      static template = xml`
          <div><t t-esc="state.val"/></div>
        `;
      state = useState({ val: 1 });
      __render(f) {
        steps.push(this.state.val);
        return super.__render(f);
      }
    }
    TestWidget.prototype.__render = jest.fn(TestWidget.prototype.__render);

    const widget = new TestWidget();
    widget.state.val = 2;
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>2</div>");
    expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(1);

    // unmount and re-mount, as in this case, willStart won't be called, so it's
    // slightly different
    widget.unmount();
    widget.state.val = 3;
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>3</div>");
    expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(2);
    expect(steps).toEqual([2, 3]);
  });

  test("change state while mounting component", async () => {
    const steps: number[] = [];
    class TestWidget extends Component {
      static template = xml`
          <div><t t-esc="state.val"/></div>
        `;
      state = useState({ val: 1 });
      __render(f) {
        steps.push(this.state.val);
        return super.__render(f);
      }
    }
    TestWidget.prototype.__render = jest.fn(TestWidget.prototype.__render);
    TestWidget.prototype.__patch = jest.fn(TestWidget.prototype.__patch);

    const widget = new TestWidget();
    let prom = widget.mount(fixture);
    widget.state.val = 2;
    await prom;
    expect(fixture.innerHTML).toBe("<div>2</div>");
    expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(1);

    // unmount and re-mount, as in this case, willStart won't be called, so it's
    // slightly different
    widget.unmount();
    prom = widget.mount(fixture);
    widget.state.val = 3;
    await prom;
    expect(fixture.innerHTML).toBe("<div>3</div>");
    expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(3);
    expect(TestWidget.prototype.__patch).toHaveBeenCalledTimes(2);
    expect(steps).toEqual([2, 2, 3]);
  });

  test("change state while component is unmounted", async () => {
    let child;
    class Child extends Component {
      static template = xml`<span t-esc="state.val"/>`;
      state = useState({
        val: "C1"
      });
      constructor(parent, props) {
        super(parent, props);
        child = this;
      }
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><t t-esc="state.val"/><Child/></div>`;
      state = useState({ val: "P1" });
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>P1<span>C1</span></div>");

    parent.unmount();
    expect(fixture.innerHTML).toBe("");

    parent.state.val = "P2";
    child.state.val = "C2";

    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>P2<span>C2</span></div>");
  });

  test("unmount component during a re-rendering", async () => {
    const def = makeDeferred();
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
      willUpdateProps() {
        return def;
      }
    }
    Child.prototype.__render = jest.fn(Child.prototype.__render);

    class Parent extends Component {
      static template = xml`<div><Child val="state.val"/></div>`;
      static components = { Child };
      state = useState({ val: 1 });
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    expect(Child.prototype.__render).toBeCalledTimes(1);

    parent.state.val = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

    parent.unmount();
    expect(fixture.innerHTML).toBe("");

    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("");
    expect(Child.prototype.__render).toBeCalledTimes(1);
  });

  test("widget can be mounted on different target", async () => {
    class MyWidget extends Component {
      static template = xml`<div>Hey</div>`;
      patched() {
        throw new Error("patched should not be called");
      }
    }
    const div = document.createElement("div");
    const span = document.createElement("span");
    fixture.appendChild(div);
    fixture.appendChild(span);
    const w = new MyWidget();
    await w.mount(div);

    expect(fixture.innerHTML).toBe("<div><div>Hey</div></div><span></span>");

    await w.mount(span);
    expect(fixture.innerHTML).toBe("<div></div><span><div>Hey</div></span>");
  });

  test("widget can be mounted on different target, another situation", async () => {
    const def = makeDeferred();
    const steps: string[] = [];

    class MyWidget extends Component {
      static template = xml`<div>Hey</div>`;
      async willStart() {
        return def;
      }
      patched() {
        throw new Error("patched should not be called");
      }
    }
    const div = document.createElement("div");
    const span = document.createElement("span");
    fixture.appendChild(div);
    fixture.appendChild(span);
    const w = new MyWidget();

    w.mount(div).catch(() => steps.push("1 catch"));

    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div><span></span>");

    w.mount(span).then(() => steps.push("2 resolved"));

    // we wait two microticks because this is the number of internal promises
    // that need to be resolved/rejected, and because we want to prove here
    // that the first mount operation is cancelled immediately, and not after
    // one full tick.
    await nextMicroTick();
    await nextMicroTick();
    expect(steps).toEqual(["1 catch"]);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div><span></span>");

    def.resolve();
    await nextTick();
    expect(steps).toEqual(["1 catch", "2 resolved"]);
    expect(fixture.innerHTML).toBe("<div></div><span><div>Hey</div></span>");
  });

  test("widget can be mounted on same target, another situation", async () => {
    const def = makeDeferred();
    const steps: string[] = [];

    class MyWidget extends Component {
      static template = xml`<div>Hey</div>`;
      async willStart() {
        return def;
      }
      patched() {
        throw new Error("patched should not be called");
      }
    }
    const w = new MyWidget();

    w.mount(fixture).then(() => steps.push("1 resolved"));

    await nextTick();
    expect(fixture.innerHTML).toBe("");

    w.mount(fixture).then(() => steps.push("2 resolved"));

    await nextTick();
    expect(steps).toEqual([]);
    expect(fixture.innerHTML).toBe("");

    def.resolve();
    await nextTick();
    expect(steps).toEqual(["1 resolved", "2 resolved"]);
    expect(fixture.innerHTML).toBe("<div>Hey</div>");
  });
});
