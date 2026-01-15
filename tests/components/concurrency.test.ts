import {
  App,
  Component,
  ComponentConstructor,
  mount,
  onMounted,
  onWillDestroy,
  onWillStart,
  onWillUnmount,
  onWillUpdateProps,
  props,
  state as proxy,
  xml,
} from "../../src";
import { Fiber } from "../../src/runtime/rendering/fibers";
import { Scheduler } from "../../src/runtime/rendering/scheduler";
import { status } from "../../src/runtime/status";
import {
  makeDeferred,
  makeTestFixture,
  nextMicroTick,
  nextTick,
  snapshotEverything,
  steps,
  useLogLifecycle,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

// following code is there to prevent memory leaks in the scheduled tasks
let lastScheduler: Scheduler;
const addFiber = Scheduler.prototype.addFiber;
Scheduler.prototype.addFiber = function (fiber: Fiber) {
  lastScheduler = this;
  return addFiber.call(this, fiber);
};

afterEach(() => {
  if (lastScheduler && lastScheduler.tasks.size > 0) {
    // we still clear the scheduler to prevent additional noise
    lastScheduler.tasks.clear();
    throw new Error("we got a memory leak...");
  }
});

describe("async rendering", () => {
  test("destroying a widget before start is over", async () => {
    let def = makeDeferred();
    let w: any = null;
    class W extends Component {
      static template = xml`<div/>`;
      status = status();
      setup() {
        useLogLifecycle();
        expect(this.status()).toBe("new");
        w = this;
        onWillStart(() => def);
      }
    }
    const app = new App();
    app.createRoot(W).mount(fixture);
    expect(w.status()).toBe("new");
    app.destroy();
    expect(w.status()).toBe("destroyed");
    def.resolve();
    await nextTick();
    expect(w.status()).toBe("destroyed");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "W:setup",
        "W:willStart",
        "W:willDestroy",
      ]
    `);
  });
});

test("destroying/recreating a subwidget with different props (if start is not over)", async () => {
  let def = makeDeferred();
  let n = 0;
  class Child extends Component {
    static template = xml`<span>child:<t t-out="this.props.val"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      n++;
      onWillStart(() => def);
    }
  }

  class W extends Component {
    static template = xml`
        <div>
            <t t-if="this.state.val > 1"><Child val="this.state.val"/></t>
        </div>`;
    static components = { Child };
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const w = await mount(W, fixture);

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "W:setup",
      "W:willStart",
      "W:mounted",
    ]
  `);

  expect(n).toBe(0);

  w.state.val = 2;
  await nextMicroTick();
  await nextMicroTick();
  expect(n).toBe(1);

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:setup",
      "Child:willStart",
    ]
  `);

  w.state.val = 3;
  await nextMicroTick();
  await nextMicroTick();
  expect(n).toBe(2);

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:setup",
      "Child:willStart",
    ]
  `);

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>child:3</span></div>");
  expect(Object.values(w.__owl__.children).length).toBe(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willDestroy",
      "W:willPatch",
      "Child:mounted",
      "W:patched",
    ]
  `);
});

test("destroying/recreating a subcomponent, other scenario", async () => {
  let flag = false;

  class Child extends Component {
    static template = xml`child`;
    setup() {
      if (!flag) {
        flag = true;
        parent.render(true);
      }
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`parent<Child t-if="this.state.hasChild"/>`;
    static components = { Child };
    state = proxy({ hasChild: false });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Parent:mounted",
    ]
  `);
  expect(fixture.innerHTML).toBe("parent");

  parent.state.hasChild = true;

  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:setup",
      "Child:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:willDestroy",
      "Parent:willPatch",
      "Child:mounted",
      "Parent:patched",
    ]
  `);

  expect(fixture.innerHTML).toBe("parentchild");
});

test("creating two async components, scenario 1", async () => {
  let defA = makeDeferred();
  let defB = makeDeferred();
  let nbRenderings: number = 0;

  class ChildA extends Component {
    static template = xml`<span><t t-out="this.getValue()"/></span>`;

    setup() {
      useLogLifecycle();
      onWillStart(() => defA);
    }

    getValue() {
      nbRenderings++;
      return "a";
    }
  }

  class ChildB extends Component {
    static template = xml`<span>b</span>`;
    setup() {
      useLogLifecycle();
      onWillStart(() => defB);
    }
  }

  class Parent extends Component {
    static template = xml`
        <t t-if="this.state.flagA"><ChildA /></t>
        <t t-if="this.state.flagB"><ChildB /></t>`;

    static components = { ChildA, ChildB };
    state = proxy({ flagA: false, flagB: false });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Parent:mounted",
    ]
  `);
  expect(fixture.innerHTML).toBe("");

  parent.state.flagA = true;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:setup",
      "ChildA:willStart",
    ]
  `);
  expect(fixture.innerHTML).toBe("");

  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:setup",
      "ChildA:willStart",
      "ChildB:setup",
      "ChildB:willStart",
      "ChildA:willDestroy",
    ]
  `);

  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  expect(nbRenderings).toBe(0);
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<span>a</span><span>b</span>");
  expect(nbRenderings).toBe(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "ChildB:mounted",
      "ChildA:mounted",
      "Parent:patched",
    ]
  `);
});

test("creating two async components, scenario 2", async () => {
  let defA = makeDeferred();
  let defB = makeDeferred();

  class ChildA extends Component {
    static template = xml`<span>a<t t-out="this.props.val"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defA);
    }
  }

  class ChildB extends Component {
    static template = xml`<span>b<t t-out="this.props.val"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillStart(() => defB);
    }
  }

  class Parent extends Component {
    static template = xml`
          <div>
            <ChildA val="this.state.valA"/>
            <t t-if="this.state.flagB"><ChildB val="this.state.valB"/></t>
          </div>`;
    static components = { ChildA, ChildB };
    state = proxy({ valA: 1, valB: 2, flagB: false });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
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
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");

  parent.state.valA = 2;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
    ]
  `);
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");

  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
      "ChildB:setup",
      "ChildB:willStart",
    ]
  `);

  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a2</span><span>b2</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "ChildA:willPatch",
      "ChildB:mounted",
      "ChildA:patched",
      "Parent:patched",
    ]
  `);
});

test("creating two async components, scenario 3 (patching in the same frame)", async () => {
  let defA = makeDeferred();
  let defB = makeDeferred();

  class ChildA extends Component {
    static template = xml`<span>a<t t-out="this.props.val"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defA);
    }
  }
  class ChildB extends Component {
    static template = xml`<span>b<t t-out="this.props.val"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillStart(() => defB);
    }
  }

  class Parent extends Component {
    static template = xml`
          <div>
            <ChildA val="this.state.valA"/>
            <t t-if="this.state.flagB"><ChildB val="this.state.valB"/></t>
          </div>`;
    static components = { ChildA, ChildB };
    state = proxy({ valA: 1, valB: 2, flagB: false });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
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
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");

  parent.state.valA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
    ]
  `);

  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
      "ChildB:setup",
      "ChildB:willStart",
    ]
  `);

  defB.resolve();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a2</span><span>b2</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "ChildA:willPatch",
      "ChildB:mounted",
      "ChildA:patched",
      "Parent:patched",
    ]
  `);
});

test("update a sub-component twice in the same frame", async () => {
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  class ChildA extends Component {
    static template = xml`<span><t t-out="this.props.val"/></span>`;
    props = props();
    setup() {
      onWillUpdateProps(() => defs[index++]);
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<div><ChildA val="this.state.valA"/></div>`;
    static components = { ChildA };
    state = proxy({ valA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
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

  parent.state.valA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
    ]
  `);

  parent.state.valA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
    ]
  `);

  defs[0].resolve();
  await Promise.resolve();
  defs[1].resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "ChildA:willPatch",
      "ChildA:patched",
      "Parent:patched",
    ]
  `);
});

test("update a sub-component twice in the same frame, 2", async () => {
  class ChildA extends Component {
    static template = xml`<span><t t-out="this.val()"/></span>`;
    props = props();

    setup() {
      useLogLifecycle();
    }

    val() {
      return this.props.val;
    }
  }

  class Parent extends Component {
    static template = xml`<div><ChildA val="this.state.valA"/></div>`;
    static components = { ChildA };
    state = proxy({ valA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
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
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

  parent.state.valA = 2;
  await nextMicroTick();
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
    ]
  `);
  await nextMicroTick();
  // For an unknown reason, this test fails on windows without the next microtick. It works
  // in linux and osx, but fails on at least this machine.
  // I do not see anything harmful in waiting an extra tick. But it is annoying to not
  // know what is different.
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  parent.state.valA = 3;
  await nextMicroTick();
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ChildA:willUpdateProps",
    ]
  `);

  await nextMicroTick();
  // same as above
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "ChildA:willPatch",
      "ChildA:patched",
      "Parent:patched",
    ]
  `);
});

test("properly behave when destroyed/unmounted while rendering ", async () => {
  const def = makeDeferred();

  class SubChild extends Component {
    static template = xml`<div/>`;

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => {
        return def;
      });
    }
  }

  class Child extends Component {
    static template = xml`<div><SubChild val="this.props.val"/></div>`;
    static components = { SubChild };
    props = props();
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`
        <div><t t-if="this.state.flag"><Child val="this.state.val"/></t></div>`;
    static components = { Child };
    state = proxy({ flag: true, val: "Framboise Lindemans" });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><div><div></div></div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Child:setup",
      "Child:willStart",
      "SubChild:setup",
      "SubChild:willStart",
      "SubChild:mounted",
      "Child:mounted",
      "Parent:mounted",
    ]
  `);

  // this change triggers a rendering of the parent. This rendering is delayed,
  // because child is now waiting for def to be resolved
  parent.state.val = "Framboise Girardin";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><div><div></div></div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
      "SubChild:willUpdateProps",
    ]
  `);

  // with this, we remove child, and subchild, even though it is not finished
  // rendering from previous changes
  parent.state.flag = false;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Child:willUnmount",
      "SubChild:willUnmount",
      "SubChild:willDestroy",
      "Child:willDestroy",
      "Parent:patched",
    ]
  `);

  // we now resolve def, so the child rendering is now complete.
  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
});

test("rendering component again in next microtick", async () => {
  class Child extends Component {
    static template = xml`<div>Child</div>`;
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`
          <div>
            <button t-on-click="this.onClick">Click</button>
            <t t-if="this.state.config.flag"><Child/></t>
          </div>`;
    static components = { Child };
    state = state;

    setup() {
      useLogLifecycle();
    }
    async onClick() {
      this.state.config.flag = true;
      this.render();
      await Promise.resolve();
      this.render();
    }
  }

  const state = { config: { flag: false } };
  await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><button>Click</button></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Parent:mounted",
    ]
  `);

  fixture.querySelector("button")!.click();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><button>Click</button><div>Child</div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:setup",
      "Child:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:willDestroy",
      "Parent:willPatch",
      "Child:mounted",
      "Parent:patched",
    ]
  `);
});

test("concurrent renderings scenario 1", async () => {
  const def = makeDeferred();
  let stateB: any = null;

  class ComponentC extends Component {
    static template = xml`<span><t t-out="this.props.fromA"/><t t-out="this.someValue()"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => def);
    }
    someValue() {
      return this.props.fromB;
    }
  }
  ComponentC.prototype.someValue = jest.fn(ComponentC.prototype.someValue);

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="this.props.fromA" fromB="this.state.fromB" /></p>`;
    static components = { ComponentC };
    props = props();
    state = proxy({ fromB: "b" });

    setup() {
      stateB = this.state;
      useLogLifecycle();
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    static components = { ComponentB };
    state = proxy({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentC:setup",
      "ComponentC:willStart",
      "ComponentC:mounted",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentC:willUpdateProps",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
      "ComponentC:willUpdateProps",
    ]
  `);
  expect(ComponentC.prototype.someValue).toBeCalledTimes(1);

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2c</span></p></div>");
  expect(ComponentC.prototype.someValue).toBeCalledTimes(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentC:willPatch",
      "ComponentC:patched",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 2", async () => {
  // this test asserts that a rendering initiated before another one, and that
  // ends after it, is re-mapped to that second rendering
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateB: any = null;
  class ComponentC extends Component {
    static template = xml`<span><t t-out="this.props.fromA"/><t t-out="this.props.fromB"/></span>`;
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defs[index++]);
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="this.props.fromA" fromB="this.state.fromB" /></p>`;
    static components = { ComponentC };
    props = props();
    state = proxy({ fromB: "b" });

    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><t t-out="this.state.fromA"/><ComponentB fromA="this.state.fromA"/></div>`;
    static components = { ComponentB };
    state = proxy({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentC:setup",
      "ComponentC:willStart",
      "ComponentC:mounted",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
      "ComponentC:willUpdateProps",
    ]
  `);

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentC:willUpdateProps",
    ]
  `);

  defs[1].resolve(); // resolve rendering initiated in B
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2<p><span>2c</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentC:willPatch",
      "ComponentC:patched",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);

  defs[0].resolve(); // resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2<p><span>2c</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
});

test("concurrent renderings scenario 2bis", async () => {
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateB: any = null;
  class ComponentC extends Component {
    static template = xml`<span><t t-out="this.props.fromA"/><t t-out="this.props.fromB"/></span>`;
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defs[index++]);
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="this.props.fromA" fromB="this.state.fromB" /></p>`;
    static components = { ComponentC };
    props = props();
    state = proxy({ fromB: "b" });

    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    static components = { ComponentB };
    state = proxy({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentC:setup",
      "ComponentC:willStart",
      "ComponentC:mounted",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
      "ComponentC:willUpdateProps",
    ]
  `);

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentC:willUpdateProps",
    ]
  `);

  defs[0].resolve(); // resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>"); // TODO: is this what we want?? 2b could be ok too
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defs[1].resolve(); // resolve rendering initiated in B
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2c</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentC:willPatch",
      "ComponentC:patched",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 3", async () => {
  const defB = makeDeferred();
  const defsD = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<i><t t-out="this.props.fromA"/><t t-out="this.someValue()"/></i>`;
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defsD[index++]);
    }
    someValue() {
      return this.props.fromC;
    }
  }
  ComponentD.prototype.someValue = jest.fn(ComponentD.prototype.someValue);

  class ComponentC extends Component {
    static template = xml`<span><ComponentD fromA="this.props.fromA" fromC="this.state.fromC" /></span>`;
    static components = { ComponentD };
    props = props();
    state = proxy({ fromC: "c" });
    setup() {
      useLogLifecycle();
      stateC = this.state;
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="this.props.fromA" /></p>`;
    static components = { ComponentC };
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    props = props();
    state = proxy({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentC:setup",
      "ComponentC:willStart",
      "ComponentD:setup",
      "ComponentD:willStart",
      "ComponentD:mounted",
      "ComponentC:mounted",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
    ]
  `);

  stateC.fromC = "d";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defB.resolve(); // resolve rendering initiated in A (still blocked in D)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentC:willUpdateProps",
      "ComponentD:willUpdateProps",
    ]
  `);

  defsD[0].resolve(); // resolve rendering initiated in C (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>2d</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentC:willPatch",
      "ComponentD:willPatch",
      "ComponentD:patched",
      "ComponentC:patched",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
  expect(ComponentD.prototype.someValue).toBeCalledTimes(2);
});

test("concurrent renderings scenario 4", async () => {
  const defB = makeDeferred();
  const defsD = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<i><t t-out="this.props.fromA"/><t t-out="this.someValue()"/></i>`;
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defsD[index++]);
    }
    someValue() {
      return this.props.fromC;
    }
  }
  ComponentD.prototype.someValue = jest.fn(ComponentD.prototype.someValue);

  class ComponentC extends Component {
    static template = xml`<span><ComponentD fromA="this.props.fromA" fromC="this.state.fromC" /></span>`;
    static components = { ComponentD };
    props = props();
    state = proxy({ fromC: "c" });
    setup() {
      useLogLifecycle();
      stateC = this.state;
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="this.props.fromA" /></p>`;
    static components = { ComponentC };
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    state = proxy({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentC:setup",
      "ComponentC:willStart",
      "ComponentD:setup",
      "ComponentD:willStart",
      "ComponentD:mounted",
      "ComponentC:mounted",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
    ]
  `);

  stateC.fromC = "d";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defB.resolve(); // resolve rendering initiated in A (still blocked in D)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentC:willUpdateProps",
      "ComponentD:willUpdateProps",
    ]
  `);

  defsD[1].resolve(); // completely resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(ComponentD.prototype.someValue).toBeCalledTimes(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defsD[0].resolve(); // resolve rendering initiated in C (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>2d</i></span></p></div>");
  expect(ComponentD.prototype.someValue).toBeCalledTimes(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentC:willPatch",
      "ComponentD:willPatch",
      "ComponentD:patched",
      "ComponentC:patched",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 5", async () => {
  const defsB = [makeDeferred(), makeDeferred()];
  let index = 0;

  class ComponentB extends Component {
    static template = xml`<p><t t-out="this.someValue()" /></p>`;
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defsB[index++]);
    }
    someValue() {
      return this.props.fromA;
    }
  }
  ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    state = proxy({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
    ]
  `);

  component.state.fromA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
    ]
  `);

  defsB[0].resolve(); // resolve first re-rendering (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  defsB[1].resolve(); // resolve second re-rendering
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 6", async () => {
  const defsB = [makeDeferred(), makeDeferred()];
  let index = 0;

  class ComponentB extends Component {
    static template = xml`<p><t t-out="this.someValue()" /></p>`;
    props = props();

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defsB[index++]);
    }
    someValue() {
      return this.props.fromA;
    }
  }
  ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    state = proxy({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
    ]
  `);

  component.state.fromA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
    ]
  `);

  defsB[1].resolve(); // resolve second re-rendering
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);

  defsB[0].resolve(); // resolve first re-rendering (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
});

test("concurrent renderings scenario 7", async () => {
  class ComponentB extends Component {
    static template = xml`<p><t t-out="this.props.fromA" /><t t-out="this.someValue()" /></p>`;
    props = props();
    state = proxy({ fromB: "b" });

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => {
        this.state.fromB = "c";
      });
    }
    someValue() {
      return this.state.fromB;
    }
  }
  ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    state = proxy({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>2c</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 8", async () => {
  const def = makeDeferred();
  let stateB: any = null;
  class ComponentB extends Component {
    static template = xml`<p><t t-out="this.props.fromA" /><t t-out="this.state.fromB" /></p>`;
    props = props();
    state = proxy({ fromB: "b" });
    setup() {
      useLogLifecycle();
      stateB = this.state;
      onWillUpdateProps(() => def);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="this.state.fromA"/></div>`;
    state = proxy({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
    ]
  `);

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>2c</p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 9", async () => {
  // Here is the global idea of this scenario:
  //       A
  //      / \
  //     B   C
  //         |
  //         D
  // A state is updated, triggering a whole re-rendering
  // B is async, and blocked
  // C (and D) are rendered
  // C state is updated, producing a re-rendering of C and D
  // this last re-rendering of C should be correctly re-mapped to the whole
  // re-rendering
  const def = makeDeferred();
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<span><t t-out="this.props.fromA"/><t t-out="this.props.fromC"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
    }
  }

  class ComponentC extends Component {
    static template = xml`<p><ComponentD fromA="this.props.fromA" fromC="this.state.fromC" /></p>`;
    static components = { ComponentD };
    props = props();
    state = proxy({ fromC: "b1" });

    setup() {
      stateC = this.state;
      useLogLifecycle();
    }
  }
  class ComponentB extends Component {
    static template = xml`<b><t t-out="this.props.fromA"/></b>`;
    props = props();

    setup() {
      onWillUpdateProps(() => def);
      useLogLifecycle();
    }
  }
  class ComponentA extends Component {
    static template = xml`
          <div>
            <t t-out="this.state.fromA"/>
            <ComponentB fromA="this.state.fromA"/>
            <ComponentC fromA="this.state.fromA"/>
          </div>`;
    static components = { ComponentB, ComponentC };
    state = proxy({ fromA: "a1" });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentC:setup",
      "ComponentC:willStart",
      "ComponentD:setup",
      "ComponentD:willStart",
      "ComponentD:mounted",
      "ComponentC:mounted",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  component.state.fromA = "a2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
      "ComponentC:willUpdateProps",
      "ComponentD:willUpdateProps",
    ]
  `);

  stateC.fromC = "b2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentD:willUpdateProps",
    ]
  `);

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a2<b>a2</b><p><span>a2b2</span></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:willPatch",
      "ComponentC:willPatch",
      "ComponentD:willPatch",
      "ComponentB:willPatch",
      "ComponentB:patched",
      "ComponentD:patched",
      "ComponentC:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 10", async () => {
  // Here is the global idea of this scenario:
  //       A
  //       |
  //       B    <- async willUpdateProps
  //     -----  <- conditional (initialy false)
  //       |
  //       C    <- async willStart
  // Render A and B normally
  // Change the condition on B to trigger a re-rendering with C (async willStart)
  // Change the state on A to trigger a global re-rendering, which is blocked
  // in B (async willUpdateProps)
  // Resolve the willStart of C: the first re-rendering has been cancelled by
  // the global re-rendering, but handlers waiting for the rendering promise to
  // resolve might execute and we don't want them to crash/do anything

  const defB = makeDeferred();
  const defC = makeDeferred();
  let stateB: any = null;
  let rendered = 0;
  class ComponentC extends Component {
    static template = xml`<span><t t-out="this.value"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillStart(() => defC);
    }
    get value() {
      rendered++;
      return this.props.value;
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC t-if="this.state.hasChild" value="this.props.value"/></p>`;
    static components = { ComponentC };
    props = props();
    state = proxy({ hasChild: false });
    setup() {
      useLogLifecycle();
      stateB = this.state;
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB value="this.state.value"/></div>`;
    static components = { ComponentB };
    state = proxy({ value: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const componentA = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentA:setup",
      "ComponentA:willStart",
      "ComponentB:setup",
      "ComponentB:willStart",
      "ComponentB:mounted",
      "ComponentA:mounted",
    ]
  `);

  stateB.hasChild = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentC:setup",
      "ComponentC:willStart",
    ]
  `);

  componentA.state.value = 2;
  defC.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p></p></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentB:willUpdateProps",
      "ComponentC:willDestroy",
    ]
  `);

  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2</span></p></div>");
  expect(rendered).toBe(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "ComponentC:setup",
      "ComponentC:willStart",
      "ComponentA:willPatch",
      "ComponentB:willPatch",
      "ComponentC:mounted",
      "ComponentB:patched",
      "ComponentA:patched",
    ]
  `);
});

test("concurrent renderings scenario 11", async () => {
  // This scenario is the following: we have a component being updated (by props),
  // and then rendered (render method), but before the willUpdateProps resolves.
  // We check that in that case, the return value of the render method is a promise
  // that is resolved when the component is completely rendered (so, properly
  // remapped to the promise of the ambient rendering)
  const def = makeDeferred();
  let child: any = null;
  class Child extends Component {
    static template = xml`<span><t t-out="this.props.val"/>|<t t-out="this.val"/></span>`;
    props = props();
    val = 3;

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => {
        child = this;
        return def;
      });
    }
  }

  class Parent extends Component {
    static template = xml`<div><Child val="this.state.valA"/></div>`;
    static components = { Child };
    state = proxy({ valA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>1|3</span></div>");
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

  parent.state.valA = 2;
  await nextTick();
  setTimeout(() => {
    def.resolve();
  }, 20);
  child.val = 5;
  child.render();
  await def;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>2|5</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]
  `);
});

test("concurrent renderings scenario 12", async () => {
  // In this scenario, we have a parent component that will be re-rendered
  // several times simultaneously:
  //    - once in a tick: it will create a new fiber, render it, but will have
  //    to wait for its child (blocking) to be completed
  //    - twice in the next tick: it will twice reuse the same fiber (as it is
  //    rendered but not completed yet)
  const def = makeDeferred();

  class Child extends Component {
    static template = xml`<span><t t-out="this.props.val"/></span>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => def);
    }
  }

  let rendered = 0;

  class Parent extends Component {
    static template = xml`<div><Child val="this.val"/></div>`;
    static components = { Child };
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }

    get val() {
      rendered++;
      return this.state.val;
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(1);
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

  parent.state.val = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
    ]
  `);

  parent.state.val = 3;
  parent.state.val = 4;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(3);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
    ]
  `);

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>4</span></div>");
  expect(rendered).toBe(3);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]
  `);
});

test("concurrent renderings scenario 13", async () => {
  let lastChild: any = null;

  class Child extends Component {
    static template = xml`<span><t t-out="this.state.val"/></span>`;
    state = proxy({ val: 0 });
    setup() {
      useLogLifecycle();
      onMounted(() => {
        if (lastChild) {
          lastChild.state.val = 0;
        }
        lastChild = this;
        this.state.val = 1;
      });
    }
  }

  class Parent extends Component {
    static template = xml`
          <div>
            <Child/>
            <Child t-if="this.state.bool"/>
          </div>`;
    static components = { Child };
    state = proxy({ bool: false });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>0</span></div>");
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

  await nextTick(); // wait for changes triggered in mounted to be applied
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willPatch",
      "Child:patched",
    ]
  `);

  parent.state.bool = true;
  await nextTick(); // wait for this change to be applied
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:setup",
      "Child:willStart",
      "Parent:willPatch",
      "Child:mounted",
      "Parent:patched",
    ]
  `);

  await nextTick(); // wait for changes triggered in mounted to be applied
  expect(fixture.innerHTML).toBe("<div><span>0</span><span>1</span></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willPatch",
      "Child:patched",
      "Child:willPatch",
      "Child:patched",
    ]
  `);
});

test("concurrent renderings scenario 14", async () => {
  let b: B | undefined = undefined;
  let c: C | undefined = undefined;
  class C extends Component {
    static template = xml`
       <p>
        <span t-out="this.props.fromA"/>
        <span t-out="this.props.fromB"/>
        <span t-out="this.state.fromC"/>
       </p>`;

    props = props();
    state = proxy({ fromC: 3 });
    setup() {
      useLogLifecycle();
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<p><C fromB="this.state.fromB" fromA="this.props.fromA"/></p>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      b = this;
    }
    props = props();
    state = proxy({ fromB: 2 });
  }

  class A extends Component {
    static template = xml`<p><B fromA="this.state.fromA"/></p>`;
    static components = { B };
    state = proxy({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
      "C:willUpdateProps",
    ]
  `);

  // trigger a re-rendering from C, which will remap its new fiber
  c!.state.fromC += 10;
  // trigger a re-rendering from B, which will remap its new fiber as well
  b!.state.fromB += 10;
  await nextTick();
  // at this point, all re-renderings should have been done correctly, and
  // the root fiber (A) counter should have been reset to 0, so the DOM should
  // have been patched with the updated version of each component
  expect(fixture.innerHTML).toBe(
    "<p><p><p><span>11</span><span>12</span><span>13</span></p></p></p>"
  );
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "C:willUpdateProps",
      "A:willPatch",
      "B:willPatch",
      "C:willPatch",
      "C:patched",
      "B:patched",
      "A:patched",
    ]
  `);
});

test("concurrent renderings scenario 15", async () => {
  let b: B | undefined = undefined;
  let c: C | undefined = undefined;
  class C extends Component {
    static template = xml`
       <p>
        <span t-out="this.props.fromA"/>
        <span t-out="this.props.fromB"/>
        <span t-out="this.state.fromC"/>
       </p>`;

    props = props();
    state = proxy({ fromC: 3 });
    setup() {
      useLogLifecycle();
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<p><C fromB="this.state.fromB" fromA="this.props.fromA"/></p>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      b = this;
    }
    props = props();
    state = proxy({ fromB: 2 });
  }
  class A extends Component {
    static template = xml`<p><B fromA="this.state.fromA"/></p>`;
    static components = { B };
    state = proxy({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const app = new App();
  const a = await app.createRoot(A).mount(fixture);
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
      "C:willUpdateProps",
    ]
  `);

  // trigger a re-rendering from C, which will remap its new fiber
  c!.state.fromC += 10;
  // trigger a re-rendering from B, which will remap its new fiber as well
  b!.state.fromB += 10;

  // simulate a flush (nothing should have changed as no fiber should have its
  // counter to 0)
  app.scheduler.flush();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // wait a bit and simulate another flush (we expect nothing to change as well)
  await nextMicroTick();
  app.scheduler.flush();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  await nextTick();
  expect(fixture.innerHTML).toBe(
    "<p><p><p><span>11</span><span>12</span><span>13</span></p></p></p>"
  );
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "C:willUpdateProps",
      "A:willPatch",
      "B:willPatch",
      "C:willPatch",
      "C:patched",
      "B:patched",
      "A:patched",
    ]
  `);
});

test("concurrent renderings scenario 16", async () => {
  let b: B | undefined = undefined;
  let c: C | undefined = undefined;
  class D extends Component {
    static template = xml`D`;

    setup() {
      useLogLifecycle();
      onWillStart(async () => {
        await nextTick();
        await nextTick();
      });
    }
  }
  class C extends Component {
    static template = xml`
        <t t-out="this.props.fromA"/>:<t t-out="this.props.fromB"/>:<t t-out="this.state.fromC"/>:
        <D t-if="this.state.fromC === 13"/>`;
    static components = { D };
    props = props();
    state = { fromC: 3 }; // not proxy
    setup() {
      useLogLifecycle();
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<C fromB="this.state.fromB" fromA="this.props.fromA"/>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      b = this;
    }
    props = props();
    state = { fromB: 2 };
  }
  class A extends Component {
    static template = xml`<B fromA="this.state.fromA"/>`;
    static components = { B };
    state = proxy({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("1:2:3: ");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("1:2:3: ");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
      "C:willUpdateProps",
    ]
  `);

  // trigger a re-rendering from C, which will remap its new fiber
  c!.state.fromC += 10;
  c!.render();
  await nextMicroTick();
  // trigger a re-rendering from B, which will remap its new fiber as well
  b!.state.fromB += 10;
  b!.render();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "D:setup",
      "D:willStart",
      "C:willUpdateProps",
      "D:setup",
      "D:willStart",
      "D:willDestroy",
    ]
  `);

  // at this point, C rendering is still pending, and nothing should have been
  // updated yet.
  expect(fixture.innerHTML).toBe("1:2:3: ");
  await nextTick();
  await nextTick();
  expect(fixture.innerHTML).toBe("11:12:13: D");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willPatch",
      "B:willPatch",
      "C:willPatch",
      "D:mounted",
      "C:patched",
      "B:patched",
      "A:patched",
    ]
  `);
});

test("calling render in destroy", async () => {
  let a: any = null;
  let c: any = null;

  class C extends Component {
    static template = xml`
      <div>
        <t t-out="this.props.fromA"/>
      </div>`;
    props = props();
  }

  let flag = false;
  class B extends Component {
    static template = xml`<C fromA="this.props.fromA"/>`;
    static components = { C };
    props = props();

    setup() {
      useLogLifecycle();
      c = this;
      onMounted(() => {
        if (flag) {
          this.render();
        } else {
          flag = true;
        }
      });

      onWillUnmount(() => {
        c.render();
      });
    }
  }

  class A extends Component {
    static template = xml`<B t-key="key" fromA="this.state"/>`;
    static components = { B };
    state = "a";
    key = 1;

    setup() {
      a = this;
    }
  }

  await mount(A, fixture);
  expect(fixture.innerHTML).toBe("<div>a</div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:setup",
      "B:willStart",
      "B:mounted",
    ]
  `);

  a.state = "A";
  a.key = 2;
  a.render();
  await nextTick();
  // this nextTick is critical, otherwise jest may silently swallow errors
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
      "B:willPatch",
      "B:patched",
    ]
  `);
  expect(fixture.innerHTML).toBe("<div>A</div>");
});

test("change state and call manually render: no unnecessary rendering", async () => {
  let numberOfRender = 0;

  class Test extends Component {
    static template = xml`<div><t t-out="this.value"/></div>`;
    state = proxy({ val: 1 });

    setup() {
      useLogLifecycle();
    }
    get value() {
      numberOfRender++;
      return this.state.val;
    }
  }

  const test = await mount(Test, fixture);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Test:setup",
      "Test:willStart",
      "Test:mounted",
    ]
  `);
  expect(fixture.innerHTML).toBe("<div>1</div>");
  expect(numberOfRender).toBe(1);

  test.state.val = 2;
  test.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2</div>");
  expect(numberOfRender).toBe(2);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Test:willPatch",
      "Test:patched",
    ]
  `);
});

test("changing state before first render does not trigger a render", async () => {
  let renders = 0;

  class TestW extends Component {
    static template = xml`<div t-out="this.value"/>`;
    state = proxy({ drinks: 1 });
    setup() {
      useLogLifecycle();
      this.state.drinks++;
      onWillStart(() => {
        this.state.drinks++;
      });
    }
    get value() {
      renders++;
      return this.state.drinks;
    }
  }
  await mount(TestW, fixture);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "TestW:setup",
      "TestW:willStart",
      "TestW:mounted",
    ]
  `);

  await nextTick();
  expect(renders).toBe(1);
  expect(fixture.innerHTML).toBe("<div>3</div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
});

test("changing state before first render does not trigger a render (with parent)", async () => {
  let renders = 0;

  class TestW extends Component {
    static template = xml`<div t-out="this.value"/>`;
    state = proxy({ drinks: 1 });
    setup() {
      useLogLifecycle();
      this.state.drinks++;
      onWillStart(() => {
        this.state.drinks++;
      });
    }
    get value() {
      renders++;
      return this.state.drinks;
    }
  }

  class Parent extends Component {
    static components = { TestW };
    static template = xml`<div><TestW t-if="this.state.flag"/></div>`;
    setup() {
      useLogLifecycle();
    }
    state = proxy({ flag: false });
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Parent:mounted",
    ]
  `);

  parent.state.flag = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><div>3</div></div>");
  expect(renders).toBe(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "TestW:setup",
      "TestW:willStart",
      "Parent:willPatch",
      "TestW:mounted",
      "Parent:patched",
    ]
  `);
});

test("two renderings initiated between willPatch and patched", async () => {
  let parent: any = null;

  class Panel extends Component {
    static template = xml`<abc><t t-out="this.props.val"/><t t-out="this.mounted" /></abc>`;
    props = props();
    mounted: any;
    setup() {
      useLogLifecycle();
      onMounted(() => {
        this.mounted = "Mounted";
        parent.render(true);
      });
      onWillUnmount(() => parent.render(true));
    }
  }

  // Main root component
  class Parent extends Component {
    static template = xml`<div><Panel t-key="'panel_' + this.state.panel" val="this.state.panel" t-if="this.state.flag"/></div>`;
    static components = { Panel };
    state = proxy({ panel: "Panel1", flag: true });
    setup() {
      useLogLifecycle();
      parent = this;
    }
  }

  await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><abc>Panel1</abc></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Panel:setup",
      "Panel:willStart",
      "Panel:mounted",
      "Parent:mounted",
      "Panel:willUpdateProps",
    ]
  `);

  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Panel:willPatch",
      "Panel:patched",
      "Parent:patched",
    ]
  `);
  expect(fixture.innerHTML).toBe("<div><abc>Panel1Mounted</abc></div>");

  parent.state.panel = "Panel2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><abc>Panel2</abc></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Panel:setup",
      "Panel:willStart",
      "Parent:willPatch",
      "Panel:willUnmount",
      "Panel:willDestroy",
      "Panel:mounted",
      "Parent:patched",
      "Panel:willUpdateProps",
    ]
  `);

  await nextTick();
  expect(fixture.innerHTML).toBe("<div><abc>Panel2Mounted</abc></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Panel:willPatch",
      "Panel:patched",
      "Parent:patched",
    ]
  `);

  parent.state.flag = false;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Panel:willUnmount",
      "Panel:willDestroy",
      "Parent:patched",
    ]
  `);

  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Parent:patched",
    ]
  `);
});

test("parent and child rendered at exact same time", async () => {
  let child: any = null;

  class Child extends Component {
    static template = xml`<t t-out="this.props.value"/>`;
    props = props();
    setup() {
      child = this;
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="this.state.value"/>`;
    static components = { Child };
    state = { value: 0 };
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("0");
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

  parent.state.value = 1;
  parent.render();
  child.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("1");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]
  `);
});

test("delay willUpdateProps", async () => {
  let promise: any = null;
  let child: any;

  class Child extends Component {
    static template = xml`<t t-out="this.props.value"/>_<t t-out="this.state.int" />`;
    props = props();
    state: any;
    setup() {
      useLogLifecycle();
      child = this;
      this.state = proxy({ int: 0 });
      onWillUpdateProps(async () => {
        await promise;
        this.state.int++;
      });
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="this.state.value"/>`;
    static components = { Child };
    state = { value: 0 };
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("0_0");
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

  promise = makeDeferred();
  const prom1 = promise;
  parent.state.value = 1;
  child.render(); // trigger a root rendering first
  parent.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
    ]
  `);

  promise = makeDeferred();
  const prom2 = promise;
  parent.state.value = 2;
  parent.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0");

  prom2.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_1");

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]
  `);

  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_2");

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willPatch",
      "Child:patched",
    ]
  `);
});

test("delay willUpdateProps with rendering grandchild", async () => {
  // This test is a bit tricky, a Parent and one of his grandchildren render while another of the parent's
  // grandchildren is awaiting its willUpdateProps.
  // Technically RootFibers will be downgraded in ChildFibers, keeping the same container RootFiber.
  // This case happens when Parent and ReaciveChild react together to a change in a proxy state/
  let promise: any = null;
  let child: any;
  let proxyChild: any;

  // Delayed willUpdateProps
  class DelayedChild extends Component {
    static template = xml`<t t-out="this.props.value"/>_<t t-out="this.state.int" />`;
    props = props();
    state: any;
    setup() {
      useLogLifecycle();
      child = this;
      this.state = proxy({ int: 0 });
      onWillUpdateProps(async () => {
        await promise;
        this.state.int++;
      });
    }
  }

  // A sibling of the delayed component, we will trigger a render on it manually
  class ReactiveChild extends Component {
    static template = xml`<div />`;
    setup() {
      proxyChild = this;
      useLogLifecycle();
    }
  }

  // The parent of everybody, we also manually trigger render on it.
  class Parent extends Component {
    static template = xml`<DelayedChild value="this.props.state.value"/><ReactiveChild />`;
    static components = { DelayedChild, ReactiveChild };
    props = props();
    setup() {
      useLogLifecycle();
    }
  }

  class GrandParent extends Component {
    static template = xml`<Parent state="this.state"/>`;
    static components = { Parent };
    state = { value: 0 };
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(GrandParent, fixture);
  expect(fixture.innerHTML).toBe("0_0<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "GrandParent:setup",
      "GrandParent:willStart",
      "Parent:setup",
      "Parent:willStart",
      "DelayedChild:setup",
      "DelayedChild:willStart",
      "ReactiveChild:setup",
      "ReactiveChild:willStart",
      "ReactiveChild:mounted",
      "DelayedChild:mounted",
      "Parent:mounted",
      "GrandParent:mounted",
    ]
  `);

  promise = makeDeferred();
  const prom1 = promise;
  parent.state.value = 1;
  child.render(); // trigger a root rendering first
  parent.render(true);
  proxyChild.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willUpdateProps",
      "DelayedChild:willUpdateProps",
      "ReactiveChild:willUpdateProps",
    ]
  `);

  promise = makeDeferred();
  const prom2 = promise;
  child.render(); // trigger a root rendering first
  parent.state.value = 2;
  parent.render(true);
  proxyChild.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willUpdateProps",
      "DelayedChild:willUpdateProps",
      "ReactiveChild:willUpdateProps",
    ]
  `);

  prom2.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_1<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "GrandParent:willPatch",
      "Parent:willPatch",
      "ReactiveChild:willPatch",
      "DelayedChild:willPatch",
      "DelayedChild:patched",
      "ReactiveChild:patched",
      "Parent:patched",
      "GrandParent:patched",
    ]
  `);

  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_2<div></div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "DelayedChild:willPatch",
      "DelayedChild:patched",
    ]
  `);
});

test("two sequential renderings before an animation frame", async () => {
  class Child extends Component {
    static template = xml`<t t-out="this.props.value"/>`;
    props = props();
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="this.state.value"/>`;
    static components = { Child };
    state = proxy({ value: 0 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("0");
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

  parent.state.value = 1;
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("0");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
    ]
  `);

  parent.state.value = 2;
  // enough microticks to wait for render + willupdateprops
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("0");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
    ]
  `);

  await nextTick();
  // we check here that the willPatch and patched hooks are called only once
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]
  `);
});

test("t-key on dom node having a component", async () => {
  let def: any;
  class Child extends Component {
    static template = xml`<t t-out="this.props.key" />`;
    props = props();
    setup() {
      onWillStart(() => def);
      useLogLifecycle(this.props.key);
    }
  }

  class Parent extends Component {
    key = 1;
    myComp = Child;
    static template = xml`<div t-key="this.key"><t t-component="this.myComp" key="this.key" /></div>`;
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");

  def = makeDeferred();
  parent.key = 2;
  parent.render();

  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child (1):setup",
      "Child (1):willStart",
      "Child (1):mounted",
      "Child (2):setup",
      "Child (2):willStart",
    ]
  `);
  expect(fixture.innerHTML).toBe("<div>1</div>");
  parent.key = 3;
  parent.render();

  const prevDef = def;
  def = undefined;

  parent.key = 3;
  parent.render();
  prevDef.resolve();
  await nextTick();

  expect(fixture.innerHTML).toBe("<div>3</div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child (3):setup",
      "Child (3):willStart",
      "Child (2):willDestroy",
      "Child (1):willUnmount",
      "Child (1):willDestroy",
      "Child (3):mounted",
    ]
  `);
});

test("t-key on dynamic async component (toggler is never patched)", async () => {
  let def: any;
  class Child extends Component {
    static template = xml`<div t-out="this.props.key" />`;
    props = props();
    setup() {
      onWillStart(() => def);
      useLogLifecycle(this.props.key);
    }
  }

  class Parent extends Component {
    key = 1;
    myComp = Child;
    static template = xml`<t t-component="this.myComp" t-key="this.key" key="this.key" />`;
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");

  def = makeDeferred();
  parent.key = 2;
  parent.render();

  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child (1):setup",
      "Child (1):willStart",
      "Child (1):mounted",
      "Child (2):setup",
      "Child (2):willStart",
    ]
  `);
  expect(fixture.innerHTML).toBe("<div>1</div>");
  parent.key = 3;
  parent.render();

  const prevDef = def;
  def = undefined;

  parent.key = 3;
  parent.render();
  prevDef.resolve();
  await nextTick();

  expect(fixture.innerHTML).toBe("<div>3</div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child (3):setup",
      "Child (3):willStart",
      "Child (2):willDestroy",
      "Child (1):willUnmount",
      "Child (1):willDestroy",
      "Child (3):mounted",
    ]
  `);
});

test("t-foreach with dynamic async component", async () => {
  let def: any;
  class Child extends Component {
    static template = xml`<div t-out="this.props.key" />`;
    props = props();
    setup() {
      onWillStart(() => def);
      useLogLifecycle(this.props.key);
    }
  }

  class Parent extends Component {
    list: any = [[1]];
    myComp = Child;
    static template = xml`<t t-foreach="this.list" t-as="arr" t-key="arr_index">
        <t t-if="arr" t-component="this.myComp" key="arr[0]" />
      </t>`;
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");

  def = makeDeferred();
  parent.list = [, [2]];
  parent.render();

  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child (1):setup",
      "Child (1):willStart",
      "Child (1):mounted",
      "Child (2):setup",
      "Child (2):willStart",
    ]
  `);
  expect(fixture.innerHTML).toBe("<div>1</div>");
  parent.list = [, , [3]];
  parent.render();

  const prevDef = def;
  def = undefined;

  parent.render();
  prevDef.resolve();
  await nextTick();

  expect(fixture.innerHTML).toBe("<div>3</div>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child (3):setup",
      "Child (3):willStart",
      "Child (2):willDestroy",
      "Child (1):willUnmount",
      "Child (1):willDestroy",
      "Child (3):mounted",
    ]
  `);
});

test("Cascading renders after microtaskTick", async () => {
  const state = [{ id: 0 }, { id: 1 }];
  let child: any;
  let parent: any;

  class Element extends Component {
    static template = xml`<t t-out="this.props.id" />`;
    props = props();
  }

  class Child extends Component {
    static components = { Element };
    static template = xml`
      <t t-foreach="this.state" t-as="elem" t-key="elem.id">
        <Element id="elem.id"/>
      </t>`;
    state = state;
    setup() {
      child = this;
    }
  }

  class Parent extends Component {
    static components = { Child };
    static template = xml`<Child /> _ <t t-foreach="this.state" t-as="elem" t-key="elem.id" t-out="elem.id"/>`;
    state = state;
    setup() {
      parent = this;
    }
  }

  await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("01 _ 01");

  state.push({ id: 2 });
  parent.render();
  child.render();

  await Promise.resolve();
  expect(fixture.innerHTML).toBe("01 _ 01");
  state.push({ id: 3 });
  parent.render();
  child.render();

  await nextTick();
  expect(fixture.innerHTML).toBe("0123 _ 0123");
});

test("rendering parent twice, with different props on child and stuff", async () => {
  class Child extends Component {
    static template = xml`<t t-out="this.props.value"/>`;
    props = props();
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="this.state.value"/>`;
    static components = { Child };
    state = proxy({ value: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("1");
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

  parent.state.value = 2;
  // wait for child to be rendered
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
    ]
  `);
  expect(fixture.innerHTML).toBe("1");

  // trigger a render, but keep the props for child the same
  parent.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("2");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Child:willUpdateProps",
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]
  `);
});

test("delayed rendering, but then initial rendering is cancelled by yet another render", async () => {
  const promC = makeDeferred();
  let stateB: any = null;

  class D extends Component {
    static template = xml`<button t-on-click="this.increment"><t t-out="this.state.val"/></button>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class C extends Component {
    static template = xml`<D/><p><t t-out="this.props.value"/></p>`;
    static components = { D };
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => promC);
    }
  }

  class B extends Component {
    static template = xml`<C value="this.state.someValue + this.props.value"/>`;
    static components = { C };
    props = props();
    state = proxy({ someValue: 3 });
    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class A extends Component {
    static template = xml`<B value="this.state.value"/>`;
    static components = { B };
    state = proxy({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("<button>1</button><p>36</p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "D:setup",
      "D:willStart",
      "D:mounted",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // update B and C, but render is blocked by C willupdateProps
  stateB.someValue = 5;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "C:willUpdateProps",
    ]
  `);

  // update D => render should be delayed, because B is currently rendering
  fixture.querySelector("button")!.click();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // update A => render should go to B and cancel it
  parent.state.value = 34;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
      "C:willUpdateProps",
    ]
  `);

  promC.resolve();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "D:willPatch",
      "D:patched",
      "A:willPatch",
      "B:willPatch",
      "C:willPatch",
      "C:patched",
      "B:patched",
      "A:patched",
    ]
  `);
  expect(fixture.innerHTML).toBe("<button>2</button><p>39</p>");
});

test("delayed rendering, reusing fiber and stuff", async () => {
  let prom1 = makeDeferred();
  let prom2 = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="this.increment"><t t-out="this.state.val"/></button>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-out="this.props.value"/><C /><t t-set="noop" t-value="this.notify()"/>`;
    static components = { C };
    props = props();
    notify: any;

    setup() {
      useLogLifecycle();
      let flag = false;
      onWillUpdateProps(() => {
        flag = true;
        return prom1;
      });
      this.notify = async () => {
        if (flag) {
          await nextMicroTick();
          prom2.resolve();
        }
      };
    }
  }

  class A extends Component {
    static template = xml`<B value="this.state.value"/>`;
    static components = { B };
    state = proxy({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("33<button>1</button>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // initiate a render in A, but is blocked in B
  parent.state.value = 34;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
    ]
  `);

  // initiate a render in C => delayed because of render in A
  fixture.querySelector("button")!.click();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // wait for render in A to be completed
  prom1.resolve();
  await prom2;
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // initiate a new render in A => fiber will be reused
  parent.state.value = 355;
  await nextTick();
  expect(fixture.innerHTML).toBe("355<button>2</button>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
      "A:willPatch",
      "B:willPatch",
      "B:patched",
      "A:patched",
      "C:willPatch",
      "C:patched",
    ]
  `);
});

test("delayed rendering, then component is destroyed and  stuff", async () => {
  let prom1 = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="this.increment"><t t-out="this.state.val"/></button>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-out="this.props.value"/><t t-if="this.props.value lt 10"><C /></t>`;
    static components = { C };
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => prom1);
    }
  }

  class A extends Component {
    static template = xml`<B value="this.state.value"/>`;
    static components = { B };
    state = proxy({ value: 3 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("3<button>1</button>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // initiate a render in C (so will be first task)
  fixture.querySelector("button")!.click();
  // initiate a render in A, but is blocked in B. the render will destroy c. also,
  // it blocks the render C
  parent.state.value = 34;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
    ]
  `);

  // wait for render in A to be completed
  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("34");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willPatch",
      "B:willPatch",
      "C:willUnmount",
      "C:willDestroy",
      "B:patched",
      "A:patched",
    ]
  `);

  await nextTick();
});

test("delayed rendering, reusing fiber then component is destroyed and  stuff", async () => {
  let prom1 = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="this.increment"><t t-out="this.state.val"/></button>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-out="this.props.value"/><C />`;
    static components = { C };
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => prom1);
    }
  }

  class A extends Component {
    static template = xml`A<t t-if="this.state.value lt 15"><B value="this.state.value"/></t>`;
    static components = { B };
    state = proxy({ value: 3 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("A3<button>1</button>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // initiate a render in A, but is blocked in B
  parent.state.value = 5;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
    ]
  `);

  // initiate a render in C (will be delayed because of render in A)
  fixture.querySelector("button")!.click();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // initiate a render in A, that will destroy B
  parent.state.value = 23;
  await nextTick();
  expect(fixture.innerHTML).toBe("A");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willPatch",
      "B:willUnmount",
      "C:willUnmount",
      "C:willDestroy",
      "B:willDestroy",
      "A:patched",
    ]
  `);
});

test("another scenario with delayed rendering", async () => {
  let prom1 = makeDeferred();
  let onSecondRenderA = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="this.increment"><t t-out="this.state.val"/></button>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-out="this.props.value"/><C />`;
    static components = { C };
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => prom1);
    }
  }

  class A extends Component {
    static template = xml`A<t t-if="this.state.value lt 15"><B value="this.state.value"/></t><t t-set="noop" t-value="this.notify()"/>`;
    static components = { B };
    state = proxy({ value: 3 });
    notify: any;
    setup() {
      useLogLifecycle();
      let n = 0;
      this.notify = () => {
        n++;
        if (n === 2) {
          onSecondRenderA.resolve();
        }
      };
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("A3<button>1</button>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // initiate a render in A, but is blocked in B
  parent.state.value = 5;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
    ]
  `);

  // initiate a render in C (will be delayed because of render in A)
  fixture.querySelector("button")!.click();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // initiate a render in A, that will destroy B
  parent.state.value = 23;
  await onSecondRenderA;
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // rerender A, but without destroying B
  parent.state.value = 7;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
    ]
  `);

  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("A7<button>2</button>");

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willPatch",
      "B:willPatch",
      "B:patched",
      "A:patched",
      "C:willPatch",
      "C:patched",
    ]
  `);
});

test("delayed fiber does not get rendered if it was cancelled", async () => {
  class D extends Component {
    static template = xml`D`;
    setup() {
      useLogLifecycle("", true);
    }
  }

  class C extends Component {
    static template = xml`C<D/>`;
    static components = { D };
    setup() {
      useLogLifecycle("", true);
      c = this;
    }
  }
  let c: C;

  class B extends Component {
    static template = xml`B<C/>`;
    static components = { C };
    setup() {
      useLogLifecycle("", true);
    }
  }

  class A extends Component {
    static template = xml`A<B/>`;
    static components = { B };
    setup() {
      useLogLifecycle("", true);
    }
  }

  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("ABCD");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "B:setup",
      "C:setup",
      "D:setup",
      "D:mounted",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);
  // Start a render in C
  c!.render(true);
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
  // Start a render in A such that C is already rendered, but D will be delayed
  // (because A is rendering) then cancelled (when the render from A reaches C)
  a.render(true);
  // Make sure the render can go to completion (Cancelled fibers will throw when rendered)
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willPatch",
      "B:willPatch",
      "C:willPatch",
      "D:willPatch",
      "D:patched",
      "C:patched",
      "B:patched",
      "A:patched",
    ]
  `);
});

test("destroyed component causes other soon to be destroyed component to rerender, weird stuff happens", async () => {
  let def = makeDeferred();
  let c: any = null;

  class B extends Component {
    static template = xml`<t t-set="noop" t-value="this.notify()"/><t t-out="this.props.value"/>`;
    props = props();
    setup() {
      useLogLifecycle();
      onWillDestroy(() => {
        c.state.val++;
        c.render();
      });
    }
    notify() {
      def.resolve();
    }
  }
  class C extends Component {
    static template = xml`<t t-out="this.state.val + this.props.value"/>`;
    props = props();
    state = proxy({ val: 0 });
    setup() {
      c = c || this;
      useLogLifecycle();
    }
  }

  class A extends Component {
    static template = xml`
      A
      <t t-if="this.state.flag">
        <B value="this.state.valueB"/>
        <C value="this.state.valueC"/>
      </t>`;
    static components = { B, C };
    state = proxy({ flag: false, valueB: 1, valueC: 2 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe(" A ");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "A:mounted",
    ]
  `);

  // initiate a render in A, but is blocked in B
  parent.state.flag = true;

  await def;
  await nextMicroTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
    ]
  `);

  // initiate render in A => will cancel renders in B/C and restarts
  parent.state.valueB = 2;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "B:willDestroy",
      "C:willDestroy",
      "A:willPatch",
      "C:mounted",
      "B:mounted",
      "A:patched",
    ]
  `);

  expect(fixture.innerHTML).toBe(" A 22");
});

test("delayed rendering, destruction, stuff happens", async () => {
  const promC = makeDeferred();
  let stateB: any = null;

  class D extends Component {
    static template = xml`D<button t-on-click="this.increment"><t t-out="this.state.val"/></button>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class C extends Component {
    static template = xml`C<D/><p><t t-out="this.props.value"/></p>`;
    static components = { D };
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => promC);
    }
  }

  class B extends Component {
    static template = xml`B<t t-if="this.state.hasChild"><C value="this.state.someValue + this.props.value"/></t>`;
    static components = { C };
    props = props();
    state = proxy({ someValue: 3, hasChild: true });
    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class A extends Component {
    static template = xml`A<B value="this.state.value"/>`;
    static components = { B };
    state = proxy({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("ABCD<button>1</button><p>36</p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "D:setup",
      "D:willStart",
      "D:mounted",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // render in A, it updates B and C, but render is blocked in C
  parent.state.value = 50;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
      "C:willUpdateProps",
    ]
  `);

  // update B => removes child C
  stateB.hasChild = false;
  // update D => render should be delayed, because AB is currently rendering
  fixture.querySelector("button")!.click();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willPatch",
      "B:willPatch",
      "C:willUnmount",
      "D:willUnmount",
      "D:willDestroy",
      "C:willDestroy",
      "B:patched",
      "A:patched",
    ]
  `);
  expect(fixture.innerHTML).toBe("AB");
});

test("renderings, destruction, patch, stuff, ... yet another variation", async () => {
  const promB = makeDeferred();

  class D extends Component {
    static template = xml`D<p t-on-click="this.increment"><t t-out="this.state.val"/></p>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  // almost the same as D
  class C extends Component {
    static template = xml`C<span t-on-click="this.increment"><t t-out="this.state.val"/></span>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`B<t t-if="this.props.value === 33"><C/></t>`;
    static components = { C };
    props = props();
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => promB);
    }
  }

  class A extends Component {
    static template = xml`A<B value="this.state.value"/><D/>`;
    static components = { B, D };
    state = proxy({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("ABC<span>1</span>D<p>1</p>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "D:setup",
      "D:willStart",
      "C:setup",
      "C:willStart",
      "C:mounted",
      "D:mounted",
      "B:mounted",
      "A:mounted",
    ]
  `);

  // render in A, it updates B, will remove C, stopped in B
  parent.state.value = 50;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:willUpdateProps",
    ]
  `);

  // update C => render should be delayed, because AB is currently rendering
  fixture.querySelector("span")!.click();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);

  // resolve prom B => render is done, component C is destroyed
  promB.resolve();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willPatch",
      "B:willPatch",
      "C:willUnmount",
      "C:willDestroy",
      "B:patched",
      "A:patched",
    ]
  `);
  expect(fixture.innerHTML).toBe("ABD<p>1</p>");

  // update D => should just render completely independently
  fixture.querySelector("p")!.click();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "D:willPatch",
      "D:patched",
    ]
  `);
  expect(fixture.innerHTML).toBe("ABD<p>2</p>");
});

test("delayed render does not go through when t-component value changed", async () => {
  class C extends Component {
    static template = xml`C`;
    setup() {
      useLogLifecycle("", true);
    }
  }

  class B extends Component {
    static template = xml`B<t t-out="this.state.val"/>`;
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle("", true);
      b = this;
    }
  }
  let b: B;

  class A extends Component {
    static template = xml`A<t t-component="this.state.component"/>`;
    state: { component: ComponentConstructor } = proxy({ component: B });
    setup() {
      useLogLifecycle("", true);
    }
  }

  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("AB1");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "B:setup",
      "B:mounted",
      "A:mounted",
    ]
  `);
  // start a render in B
  b!.state.val = 2;
  // start a render in A, invalidating the scheduled render of B, which could crash if executed.
  a.state.component = C;
  await nextTick();
  expect(fixture.innerHTML).toBe("AC");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "C:setup",
      "A:willPatch",
      "B:willUnmount",
      "B:willDestroy",
      "C:mounted",
      "A:patched",
    ]
  `);
});

test.skip("delayed render is not cancelled by upcoming render", async () => {
  // TODO: unskip
  let b: any;

  class B extends Component {
    static template = xml`
        <t t-out="this.props.state.groups.length"/>
        <t t-out="this.props.state.config.test"/>`;

    props = props();
    setup() {
      useLogLifecycle();
      b = this;
    }
  }

  class A extends Component {
    static components = { B };
    static template = xml`<B state="this.state" isEmpty="this.state.groups.length === 0"/>`;

    state = proxy({ groups: [], config: { test: "initial" } });
    setup() {
      useLogLifecycle();
    }
  }

  await mount(A, fixture);

  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "A:willRender",
      "B:setup",
      "B:willStart",
      "A:rendered",
      "B:willRender",
      "B:rendered",
      "B:mounted",
      "A:mounted",
    ]
  `);

  expect(fixture.innerHTML).toBe("0initial");

  b.props.state.config.test = "red";
  b.props.state.groups.push(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  b.props.state.config.test = "black";
  b.props.state.groups.push(1);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willRender",
      "B:willUpdateProps",
      "A:rendered",
      "B:willRender",
      "B:rendered",
    ]
  `);
  await nextTick();

  expect(fixture.innerHTML).toBe("2black");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willRender",
      "B:willUpdateProps",
      "A:rendered",
      "B:willRender",
      "B:rendered",
      "A:willPatch",
      "B:willPatch",
      "B:patched",
      "A:patched",
    ]
  `);
});

test("components are not destroyed between animation frame", async () => {
  const def = makeDeferred();
  class C extends Component {
    static template = xml`C`;
    setup() {
      useLogLifecycle();
    }
  }
  class B extends Component {
    static template = xml`B<C/>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      onWillStart(() => {
        return def;
      });
    }
  }
  class A extends Component {
    static template = xml`A<B t-if="this.state.flag"/>`;
    static components = { B };

    state = proxy({ flag: false });
    setup() {
      useLogLifecycle();
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("A");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "A:mounted",
    ]
  `);

  // turn the flag on, this will render A and stops at B because of def
  a.state.flag = true;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "B:setup",
      "B:willStart",
    ]
  `);

  // force a render of A
  //  => owl will need to create a new B component
  //  => initial B component will be cancelled
  a.render();
  await nextMicroTick();
  expect([
    // note that B is not destroyed here. It is cancelled instead
    "B:setup",
    "B:willStart",
  ]).toBeLogged();

  // resolve def, so B render is unblocked
  def.resolve();
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "C:setup",
      "C:willStart",
      "B:willDestroy",
      "A:willPatch",
      "C:mounted",
      "B:mounted",
      "A:patched",
    ]
  `);
});

test("component destroyed just after render", async () => {
  let stateB: any;

  class B extends Component {
    static template = xml`B<t t-out="this.state.value"/>`;
    state = proxy({ value: 1 });
    setup() {
      stateB = this.state;
      useLogLifecycle();
    }
  }
  class A extends Component {
    static template = xml`<B/>`;
    static components = { B };
    setup() {
      useLogLifecycle();
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("B1");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:setup",
      "A:willStart",
      "B:setup",
      "B:willStart",
      "B:mounted",
      "A:mounted",
    ]
  `);

  stateB!.value++; // force a render of B
  await nextMicroTick(); // wait for B render to actually start
  a.__owl__.app.destroy();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "A:willUnmount",
      "B:willUnmount",
      "B:willDestroy",
      "A:willDestroy",
    ]
  `);
  await nextTick();
  // check that B was not rendered after being destroyed
  expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
});

//   test.skip("components with shouldUpdate=false", async () => {
//     const state = { p: 1, cc: 10 };

//     class ChildChild extends Component {
//       static template = xml`
//         <div>
//           child child: <t t-out="this.state.cc"/>
//         </div>`;
//       state = state;
//       shouldUpdate() {
//         return false;
//       }
//     }

//     class Child extends Component {
//       static components = { ChildChild };
//       static template = xml`
//         <div>
//           child
//           <ChildChild/>
//         </div>`;

//       shouldUpdate() {
//         return false;
//       }
//     }

//     let parent: any;
//     class Parent extends Component {
//       static components = { Child };
//       static template = xml`
//         <div>
//           parent: <t t-out="this.state.p"/>
//           <Child/>
//         </div>`;

//       state = state;
//       constructor(a, b) {
//         super(a, b);
//         parent = this;
//       }
//       shouldUpdate() {
//         return false;
//       }
//     }

//     class App extends Component {
//       static components = { Parent };
//       static template = xml`
//         <div>
//           <Parent/>
//         </div>`;
//     }

//     var div = document.createElement("div");
//     fixture.appendChild(div);

//     const app = new App();

//     await app.mount(fixture);
//     expect(fixture.innerHTML).toBe(
//       "<div></div><div><div> parent: 1<div> child <div> child child: 10</div></div></div></div>"
//     );
//     app.mount(div);

//     // wait for rendering from second mount to go through parent
//     await Promise.resolve();
//     await Promise.resolve();
//     state.cc++;
//     state.p++;
//     parent.render();
//     await nextTick();
//     expect(fixture.innerHTML).toBe(
//       "<div><div><div> parent: 2<div> child <div> child child: 11</div></div></div></div></div>"
//     );
//   });

//   test.skip("components with shouldUpdate=false, part 2", async () => {
//     const state = { p: 1, cc: 10 };
//     let shouldUpdate = true;

//     class ChildChild extends Component {
//       static template = xml`
//         <div>
//           child child: <t t-out="this.state.cc"/>
//         </div>`;
//       state = state;
//       shouldUpdate() {
//         return shouldUpdate;
//       }
//     }

//     class Child extends Component {
//       static components = { ChildChild };
//       static template = xml`
//         <div>
//           child
//           <ChildChild/>
//         </div>`;

//       shouldUpdate() {
//         return shouldUpdate;
//       }
//     }

//     let parent: any;
//     class Parent extends Component {
//       static components = { Child };
//       static template = xml`
//         <div>
//           parent: <t t-out="this.state.p"/>
//           <Child/>
//         </div>`;

//       state = state;
//       constructor(a, b) {
//         super(a, b);
//         parent = this;
//       }
//       shouldUpdate() {
//         return shouldUpdate;
//       }
//     }

//     class App extends Component {
//       static components = { Parent };
//       static template = xml`
//         <div>
//           <Parent/>
//         </div>`;
//     }

//     const app = new App();

//     await app.mount(fixture);
//     expect(fixture.innerHTML).toBe(
//       "<div><div> parent: 1<div> child <div> child child: 10</div></div></div></div>"
//     );

//     state.cc++;
//     state.p++;
//     app.render();

//     // wait for rendering to go through child
//     await Promise.resolve();
//     await Promise.resolve();
//     await Promise.resolve();

//     shouldUpdate = false;
//     parent.render();
//     await nextTick();
//     expect(fixture.innerHTML).toBe(
//       "<div><div> parent: 2<div> child <div> child child: 11</div></div></div></div>"
//     );
//   });
// });
