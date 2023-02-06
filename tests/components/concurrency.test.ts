import {
  App,
  Component,
  ComponentConstructor,
  mount,
  onMounted,
  onRendered,
  onWillDestroy,
  onWillStart,
  onWillUnmount,
  onWillUpdateProps,
  useState,
  xml,
} from "../../src";
import { Fiber } from "../../src/runtime/fibers";
import { Scheduler } from "../../src/runtime/scheduler";
import { status } from "../../src/runtime/status";
import {
  makeDeferred,
  makeTestFixture,
  nextMicroTick,
  nextTick,
  snapshotEverything,
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
      setup() {
        useLogLifecycle();
        expect(status(this)).toBe("new");
        w = this;
        onWillStart(() => def);
      }
    }
    const app = new App(W);
    app.mount(fixture);
    expect(status(w)).toBe("new");
    app.destroy();
    expect(status(w)).toBe("destroyed");
    def.resolve();
    await nextTick();
    expect(status(w)).toBe("destroyed");
    expect(["W:setup", "W:willStart", "W:willDestroy"]).toBeLogged();
  });
});

test("destroying/recreating a subwidget with different props (if start is not over)", async () => {
  let def = makeDeferred();
  let n = 0;
  class Child extends Component {
    static template = xml`<span>child:<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle();
      n++;
      onWillStart(() => def);
    }
  }

  class W extends Component {
    static template = xml`
        <div>
            <t t-if="state.val > 1"><Child val="state.val"/></t>
        </div>`;
    static components = { Child };
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const w = await mount(W, fixture);

  expect(["W:setup", "W:willStart", "W:willRender", "W:rendered", "W:mounted"]).toBeLogged();

  expect(n).toBe(0);

  w.state.val = 2;
  await nextMicroTick();
  await nextMicroTick();
  expect(n).toBe(1);

  expect(["W:willRender", "Child:setup", "Child:willStart", "W:rendered"]).toBeLogged();

  w.state.val = 3;
  await nextMicroTick();
  await nextMicroTick();
  expect(n).toBe(2);

  expect([
    "Child:willDestroy",
    "W:willRender",
    "Child:setup",
    "Child:willStart",
    "W:rendered",
  ]).toBeLogged();

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>child:3</span></div>");
  expect(Object.values(w.__owl__.children).length).toBe(1);
  expect([
    "Child:willRender",
    "Child:rendered",
    "W:willPatch",
    "Child:mounted",
    "W:patched",
  ]).toBeLogged();
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
    static template = xml`parent<Child t-if="state.hasChild"/>`;
    static components = { Child };
    state = useState({ hasChild: false });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);

  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "Parent:rendered",
    "Parent:mounted",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("parent");

  parent.state.hasChild = true;

  await nextTick();
  expect([
    "Parent:willRender",
    "Child:setup",
    "Child:willStart",
    "Parent:rendered",
    "Child:willDestroy",
    "Parent:willRender",
    "Child:setup",
    "Child:willStart",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:mounted",
    "Parent:patched",
  ]).toBeLogged();

  expect(fixture.innerHTML).toBe("parentchild");
});

test("creating two async components, scenario 1", async () => {
  let defA = makeDeferred();
  let defB = makeDeferred();
  let nbRenderings: number = 0;

  class ChildA extends Component {
    static template = xml`<span><t t-esc="getValue()"/></span>`;

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
        <t t-if="state.flagA"><ChildA /></t>
        <t t-if="state.flagB"><ChildB /></t>`;

    static components = { ChildA, ChildB };
    state = useState({ flagA: false, flagB: false });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "Parent:rendered",
    "Parent:mounted",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("");

  parent.state.flagA = true;
  await nextTick();
  expect(["Parent:willRender", "ChildA:setup", "ChildA:willStart", "Parent:rendered"]).toBeLogged();
  expect(fixture.innerHTML).toBe("");

  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  expect([
    "ChildA:willDestroy",
    "Parent:willRender",
    "ChildA:setup",
    "ChildA:willStart",
    "ChildB:setup",
    "ChildB:willStart",
    "Parent:rendered",
  ]).toBeLogged();

  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  expect(nbRenderings).toBe(0);
  expect(["ChildB:willRender", "ChildB:rendered"]).toBeLogged();

  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<span>a</span><span>b</span>");
  expect(nbRenderings).toBe(1);
  expect([
    "ChildA:willRender",
    "ChildA:rendered",
    "Parent:willPatch",
    "ChildB:mounted",
    "ChildA:mounted",
    "Parent:patched",
  ]).toBeLogged();
});

test("creating two async components, scenario 2", async () => {
  let defA = makeDeferred();
  let defB = makeDeferred();

  class ChildA extends Component {
    static template = xml`<span>a<t t-esc="props.val"/></span>`;

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defA);
    }
  }

  class ChildB extends Component {
    static template = xml`<span>b<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle();
      onWillStart(() => defB);
    }
  }

  class Parent extends Component {
    static template = xml`
          <div>
            <ChildA val="state.valA"/>
            <t t-if="state.flagB"><ChildB val="state.valB"/></t>
          </div>`;
    static components = { ChildA, ChildB };
    state = useState({ valA: 1, valB: 2, flagB: false });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "ChildA:setup",
    "ChildA:willStart",
    "Parent:rendered",
    "ChildA:willRender",
    "ChildA:rendered",
    "ChildA:mounted",
    "Parent:mounted",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");

  parent.state.valA = 2;
  await nextTick();
  expect(["Parent:willRender", "ChildA:willUpdateProps", "Parent:rendered"]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");

  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect([
    "Parent:willRender",
    "ChildA:willUpdateProps",
    "ChildB:setup",
    "ChildB:willStart",
    "Parent:rendered",
  ]).toBeLogged();

  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect(["ChildB:willRender", "ChildB:rendered"]).toBeLogged();

  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a2</span><span>b2</span></div>");
  expect([
    "ChildA:willRender",
    "ChildA:rendered",
    "Parent:willPatch",
    "ChildA:willPatch",
    "ChildB:mounted",
    "ChildA:patched",
    "Parent:patched",
  ]).toBeLogged();
});

test("creating two async components, scenario 3 (patching in the same frame)", async () => {
  let defA = makeDeferred();
  let defB = makeDeferred();

  class ChildA extends Component {
    static template = xml`<span>a<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defA);
    }
  }
  class ChildB extends Component {
    static template = xml`<span>b<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle();
      onWillStart(() => defB);
    }
  }

  class Parent extends Component {
    static template = xml`
          <div>
            <ChildA val="state.valA"/>
            <t t-if="state.flagB"><ChildB val="state.valB"/></t>
          </div>`;
    static components = { ChildA, ChildB };
    state = useState({ valA: 1, valB: 2, flagB: false });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "ChildA:setup",
    "ChildA:willStart",
    "Parent:rendered",
    "ChildA:willRender",
    "ChildA:rendered",
    "ChildA:mounted",
    "Parent:mounted",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");

  parent.state.valA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect(["Parent:willRender", "ChildA:willUpdateProps", "Parent:rendered"]).toBeLogged();

  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect([
    "Parent:willRender",
    "ChildA:willUpdateProps",
    "ChildB:setup",
    "ChildB:willStart",
    "Parent:rendered",
  ]).toBeLogged();

  defB.resolve();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  expect([]).toBeLogged();

  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a2</span><span>b2</span></div>");
  expect([
    "ChildB:willRender",
    "ChildB:rendered",
    "ChildA:willRender",
    "ChildA:rendered",
    "Parent:willPatch",
    "ChildA:willPatch",
    "ChildB:mounted",
    "ChildA:patched",
    "Parent:patched",
  ]).toBeLogged();
});

test("update a sub-component twice in the same frame", async () => {
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  class ChildA extends Component {
    static template = xml`<span><t t-esc="props.val"/></span>`;
    setup() {
      onWillUpdateProps(() => defs[index++]);
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<div><ChildA val="state.valA"/></div>`;
    static components = { ChildA };
    state = useState({ valA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "ChildA:setup",
    "ChildA:willStart",
    "Parent:rendered",
    "ChildA:willRender",
    "ChildA:rendered",
    "ChildA:mounted",
    "Parent:mounted",
  ]).toBeLogged();

  parent.state.valA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(["Parent:willRender", "ChildA:willUpdateProps", "Parent:rendered"]).toBeLogged();

  parent.state.valA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(["Parent:willRender", "ChildA:willUpdateProps", "Parent:rendered"]).toBeLogged();

  defs[0].resolve();
  await Promise.resolve();
  defs[1].resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  expect([
    "ChildA:willRender",
    "ChildA:rendered",
    "Parent:willPatch",
    "ChildA:willPatch",
    "ChildA:patched",
    "Parent:patched",
  ]).toBeLogged();
});

test("update a sub-component twice in the same frame, 2", async () => {
  class ChildA extends Component {
    static template = xml`<span><t t-esc="val()"/></span>`;

    setup() {
      useLogLifecycle();
    }

    val() {
      return this.props.val;
    }
  }

  class Parent extends Component {
    static template = xml`<div><ChildA val="state.valA"/></div>`;
    static components = { ChildA };
    state = useState({ valA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "ChildA:setup",
    "ChildA:willStart",
    "Parent:rendered",
    "ChildA:willRender",
    "ChildA:rendered",
    "ChildA:mounted",
    "Parent:mounted",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

  parent.state.valA = 2;
  await nextMicroTick();
  await nextMicroTick();
  expect(["Parent:willRender", "ChildA:willUpdateProps", "Parent:rendered"]).toBeLogged();
  await nextMicroTick();
  // For an unknown reason, this test fails on windows without the next microtick. It works
  // in linux and osx, but fails on at least this machine.
  // I do not see anything harmful in waiting an extra tick. But it is annoying to not
  // know what is different.
  await nextMicroTick();
  expect(["ChildA:willRender", "ChildA:rendered"]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  parent.state.valA = 3;
  await nextMicroTick();
  await nextMicroTick();
  expect(["Parent:willRender", "ChildA:willUpdateProps", "Parent:rendered"]).toBeLogged();

  await nextMicroTick();
  // same as above
  await nextMicroTick();
  expect(["ChildA:willRender", "ChildA:rendered"]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  expect(["Parent:willPatch", "ChildA:willPatch", "ChildA:patched", "Parent:patched"]).toBeLogged();
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
    static template = xml`<div><SubChild val="props.val"/></div>`;
    static components = { SubChild };
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`
        <div><t t-if="state.flag"><Child val="state.val"/></t></div>`;
    static components = { Child };
    state = useState({ flag: true, val: "Framboise Lindemans" });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><div><div></div></div></div>");
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "Child:setup",
    "Child:willStart",
    "Parent:rendered",
    "Child:willRender",
    "SubChild:setup",
    "SubChild:willStart",
    "Child:rendered",
    "SubChild:willRender",
    "SubChild:rendered",
    "SubChild:mounted",
    "Child:mounted",
    "Parent:mounted",
  ]).toBeLogged();

  // this change triggers a rendering of the parent. This rendering is delayed,
  // because child is now waiting for def to be resolved
  parent.state.val = "Framboise Girardin";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><div><div></div></div></div>");
  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "SubChild:willUpdateProps",
    "Child:rendered",
  ]).toBeLogged();

  // with this, we remove child, and subchild, even though it is not finished
  // rendering from previous changes
  parent.state.flag = false;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect([
    "Parent:willRender",
    "Parent:rendered",
    "Parent:willPatch",
    "Child:willUnmount",
    "SubChild:willUnmount",
    "SubChild:willDestroy",
    "Child:willDestroy",
    "Parent:patched",
  ]).toBeLogged();

  // we now resolve def, so the child rendering is now complete.
  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect([]).toBeLogged();
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
            <button t-on-click="onClick">Click</button>
            <t t-if="env.config.flag"><Child/></t>
          </div>`;
    static components = { Child };

    setup() {
      useLogLifecycle();
    }
    async onClick() {
      this.env.config.flag = true;
      this.render();
      await Promise.resolve();
      this.render();
    }
  }

  const env = { config: { flag: false } };
  await mount(Parent, fixture, { env });
  expect(fixture.innerHTML).toBe("<div><button>Click</button></div>");
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "Parent:rendered",
    "Parent:mounted",
  ]).toBeLogged();

  fixture.querySelector("button")!.click();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><button>Click</button><div>Child</div></div>");
  expect([
    "Parent:willRender",
    "Child:setup",
    "Child:willStart",
    "Parent:rendered",
    "Child:willDestroy",
    "Parent:willRender",
    "Child:setup",
    "Child:willStart",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:mounted",
    "Parent:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 1", async () => {
  const def = makeDeferred();
  let stateB: any = null;

  class ComponentC extends Component {
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="someValue()"/></span>`;
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
    static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
    static components = { ComponentC };
    state = useState({ fromB: "b" });

    setup() {
      stateB = this.state;
      useLogLifecycle();
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    static components = { ComponentB };
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentC:rendered",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
  ]).toBeLogged();
  expect(ComponentC.prototype.someValue).toBeCalledTimes(1);

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2c</span></p></div>");
  expect(ComponentC.prototype.someValue).toBeCalledTimes(2);
  expect([
    "ComponentC:willRender",
    "ComponentC:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 2", async () => {
  // this test asserts that a rendering initiated before another one, and that
  // ends after it, is re-mapped to that second rendering
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateB: any = null;
  class ComponentC extends Component {
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defs[index++]);
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
    static components = { ComponentC };
    state = useState({ fromB: "b" });

    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><t t-esc="state.fromA"/><ComponentB fromA="state.fromA"/></div>`;
    static components = { ComponentB };
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentC:rendered",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
  ]).toBeLogged();

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
  ]).toBeLogged();

  defs[1].resolve(); // resolve rendering initiated in B
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2<p><span>2c</span></p></div>");
  expect([
    "ComponentC:willRender",
    "ComponentC:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();

  defs[0].resolve(); // resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2<p><span>2c</span></p></div>");
  expect([]).toBeLogged();
});

test("concurrent renderings scenario 2bis", async () => {
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateB: any = null;
  class ComponentC extends Component {
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defs[index++]);
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
    static components = { ComponentC };
    state = useState({ fromB: "b" });

    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    static components = { ComponentB };
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentC:rendered",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
  ]).toBeLogged();

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
  ]).toBeLogged();

  defs[0].resolve(); // resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>"); // TODO: is this what we want?? 2b could be ok too
  expect([]).toBeLogged();

  defs[1].resolve(); // resolve rendering initiated in B
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2c</span></p></div>");
  expect([
    "ComponentC:willRender",
    "ComponentC:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 3", async () => {
  const defB = makeDeferred();
  const defsD = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;

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
    static template = xml`<span><ComponentD fromA="props.fromA" fromC="state.fromC" /></span>`;
    static components = { ComponentD };
    state = useState({ fromC: "c" });
    setup() {
      useLogLifecycle();
      stateC = this.state;
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
    static components = { ComponentC };

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentD:setup",
    "ComponentD:willStart",
    "ComponentC:rendered",
    "ComponentD:willRender",
    "ComponentD:rendered",
    "ComponentD:mounted",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  stateC.fromC = "d";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([]).toBeLogged();

  defB.resolve(); // resolve rendering initiated in A (still blocked in D)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentD:willUpdateProps",
    "ComponentC:rendered",
  ]).toBeLogged();

  defsD[0].resolve(); // resolve rendering initiated in C (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>2d</i></span></p></div>");
  expect([
    "ComponentD:willRender",
    "ComponentD:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentD:willPatch",
    "ComponentD:patched",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
  expect(ComponentD.prototype.someValue).toBeCalledTimes(2);
});

test("concurrent renderings scenario 4", async () => {
  const defB = makeDeferred();
  const defsD = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;

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
    static template = xml`<span><ComponentD fromA="props.fromA" fromC="state.fromC" /></span>`;
    static components = { ComponentD };
    state = useState({ fromC: "c" });
    setup() {
      useLogLifecycle();
      stateC = this.state;
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
    static components = { ComponentC };

    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentD:setup",
    "ComponentD:willStart",
    "ComponentC:rendered",
    "ComponentD:willRender",
    "ComponentD:rendered",
    "ComponentD:mounted",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  stateC.fromC = "d";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([]).toBeLogged();

  defB.resolve(); // resolve rendering initiated in A (still blocked in D)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentC:willUpdateProps",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentD:willUpdateProps",
    "ComponentC:rendered",
  ]).toBeLogged();

  defsD[1].resolve(); // completely resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");
  expect(ComponentD.prototype.someValue).toBeCalledTimes(1);
  expect([]).toBeLogged();

  defsD[0].resolve(); // resolve rendering initiated in C (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>2d</i></span></p></div>");
  expect(ComponentD.prototype.someValue).toBeCalledTimes(2);
  expect([
    "ComponentD:willRender",
    "ComponentD:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentD:willPatch",
    "ComponentD:patched",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 5", async () => {
  const defsB = [makeDeferred(), makeDeferred()];
  let index = 0;

  class ComponentB extends Component {
    static template = xml`<p><t t-esc="someValue()" /></p>`;

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
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  component.state.fromA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  defsB[0].resolve(); // resolve first re-rendering (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(1);
  expect([]).toBeLogged();

  defsB[1].resolve(); // resolve second re-rendering
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect([
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 6", async () => {
  const defsB = [makeDeferred(), makeDeferred()];
  let index = 0;

  class ComponentB extends Component {
    static template = xml`<p><t t-esc="someValue()" /></p>`;

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
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  component.state.fromA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  defsB[1].resolve(); // resolve second re-rendering
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect([
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();

  defsB[0].resolve(); // resolve first re-rendering (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect([]).toBeLogged();
});

test("concurrent renderings scenario 7", async () => {
  class ComponentB extends Component {
    static template = xml`<p><t t-esc="props.fromA" /><t t-esc="someValue()" /></p>`;
    state = useState({ fromB: "b" });

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
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(1);
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>2c</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 8", async () => {
  const def = makeDeferred();
  let stateB: any = null;
  class ComponentB extends Component {
    static template = xml`<p><t t-esc="props.fromA" /><t t-esc="state.fromB" /></p>`;
    state = useState({ fromB: "b" });
    setup() {
      useLogLifecycle();
      stateB = this.state;
      onWillUpdateProps(() => def);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect([]).toBeLogged();

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>2c</p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
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
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromC"/></span>`;
    setup() {
      useLogLifecycle();
    }
  }

  class ComponentC extends Component {
    static template = xml`<p><ComponentD fromA="props.fromA" fromC="state.fromC" /></p>`;
    static components = { ComponentD };
    state = useState({ fromC: "b1" });

    setup() {
      stateC = this.state;
      useLogLifecycle();
    }
  }
  class ComponentB extends Component {
    static template = xml`<b><t t-esc="props.fromA"/></b>`;

    setup() {
      onWillUpdateProps(() => def);
      useLogLifecycle();
    }
  }
  class ComponentA extends Component {
    static template = xml`
          <div>
            <t t-esc="state.fromA"/>
            <ComponentB fromA="state.fromA"/>
            <ComponentC fromA="state.fromA"/>
          </div>`;
    static components = { ComponentB, ComponentC };
    state = useState({ fromA: "a1" });
    setup() {
      useLogLifecycle();
    }
  }

  const component = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentD:setup",
    "ComponentD:willStart",
    "ComponentC:rendered",
    "ComponentD:willRender",
    "ComponentD:rendered",
    "ComponentD:mounted",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  component.state.fromA = "a2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentB:willUpdateProps",
    "ComponentC:willUpdateProps",
    "ComponentA:rendered",
    "ComponentC:willRender",
    "ComponentD:willUpdateProps",
    "ComponentC:rendered",
    "ComponentD:willRender",
    "ComponentD:rendered",
  ]).toBeLogged();

  stateC.fromC = "b2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");
  expect([
    "ComponentC:willRender",
    "ComponentD:willUpdateProps",
    "ComponentC:rendered",
    "ComponentD:willRender",
    "ComponentD:rendered",
  ]).toBeLogged();

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a2<b>a2</b><p><span>a2b2</span></p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentA:willPatch",
    "ComponentC:willPatch",
    "ComponentD:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentD:patched",
    "ComponentC:patched",
    "ComponentA:patched",
  ]).toBeLogged();
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
    static template = xml`<span><t t-esc="value"/></span>`;
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
    static template = xml`<p><ComponentC t-if="state.hasChild" value="props.value"/></p>`;
    state = useState({ hasChild: false });
    static components = { ComponentC };
    setup() {
      useLogLifecycle();
      stateB = this.state;
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB value="state.value"/></div>`;
    static components = { ComponentB };
    state = useState({ value: 1 });

    setup() {
      useLogLifecycle();
    }
  }

  const componentA = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p></p></div>");
  expect([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:willRender",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentA:rendered",
    "ComponentB:willRender",
    "ComponentB:rendered",
    "ComponentB:mounted",
    "ComponentA:mounted",
  ]).toBeLogged();

  stateB.hasChild = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p></p></div>");
  expect([
    "ComponentB:willRender",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:rendered",
  ]).toBeLogged();

  componentA.state.value = 2;
  defC.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p></p></div>");
  expect([
    "ComponentA:willRender",
    "ComponentC:willDestroy",
    "ComponentB:willUpdateProps",
    "ComponentA:rendered",
  ]).toBeLogged();

  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2</span></p></div>");
  expect(rendered).toBe(1);
  expect([
    "ComponentB:willRender",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:rendered",
    "ComponentC:willRender",
    "ComponentC:rendered",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:mounted",
    "ComponentB:patched",
    "ComponentA:patched",
  ]).toBeLogged();
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
    static template = xml`<span><t t-esc="props.val"/>|<t t-esc="val"/></span>`;
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
    static template = xml`<div><Child val="state.valA"/></div>`;
    static components = { Child };
    state = useState({ valA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>1|3</span></div>");
  expect([
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
  ]).toBeLogged();

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
  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:patched",
    "Parent:patched",
  ]).toBeLogged();
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
    static template = xml`<span><t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => def);
    }
  }

  let rendered = 0;

  class Parent extends Component {
    static template = xml`<div><Child val="val"/></div>`;
    static components = { Child };
    state = useState({ val: 1 });
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
  expect([
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
  ]).toBeLogged();

  parent.state.val = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(2);
  expect(["Parent:willRender", "Child:willUpdateProps", "Parent:rendered"]).toBeLogged();

  parent.state.val = 3;
  parent.state.val = 4;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(3);
  expect(["Parent:willRender", "Child:willUpdateProps", "Parent:rendered"]).toBeLogged();

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>4</span></div>");
  expect(rendered).toBe(3);
  expect([
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:patched",
    "Parent:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 13", async () => {
  let lastChild: any = null;

  class Child extends Component {
    static template = xml`<span><t t-esc="state.val"/></span>`;
    state = useState({ val: 0 });
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
            <Child t-if="state.bool"/>
          </div>`;
    static components = { Child };
    state = useState({ bool: false });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>0</span></div>");
  expect([
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
    "Child:willRender",
    "Child:rendered",
  ]).toBeLogged();

  await nextTick(); // wait for changes triggered in mounted to be applied
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(["Child:willPatch", "Child:patched"]).toBeLogged();

  parent.state.bool = true;
  await nextTick(); // wait for this change to be applied
  expect([
    "Parent:willRender",
    "Child:setup",
    "Child:willStart",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:mounted",
    "Parent:patched",
    "Child:willRender",
    "Child:rendered",
    "Child:willRender",
    "Child:rendered",
  ]).toBeLogged();

  await nextTick(); // wait for changes triggered in mounted to be applied
  expect(fixture.innerHTML).toBe("<div><span>0</span><span>1</span></div>");
  expect(["Child:willPatch", "Child:patched", "Child:willPatch", "Child:patched"]).toBeLogged();
});

test("concurrent renderings scenario 14", async () => {
  let b: B | undefined = undefined;
  let c: C | undefined = undefined;
  class C extends Component {
    static template = xml`
       <p>
        <span t-esc="props.fromA"/>
        <span t-esc="props.fromB"/>
        <span t-esc="state.fromC"/>
       </p>`;

    state = useState({ fromC: 3 });
    setup() {
      useLogLifecycle();
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      b = this;
    }
    state = useState({ fromB: 2 });
  }

  class A extends Component {
    static template = xml`<p><B fromA="state.fromA"/></p>`;
    static components = { B };
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect([
    "A:willRender",
    "B:willUpdateProps",
    "A:rendered",
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
  ]).toBeLogged();

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
  expect([
    "C:willRender",
    "C:rendered",
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "C:patched",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
});

test("concurrent renderings scenario 15", async () => {
  let b: B | undefined = undefined;
  let c: C | undefined = undefined;
  class C extends Component {
    static template = xml`
       <p>
        <span t-esc="props.fromA"/>
        <span t-esc="props.fromB"/>
        <span t-esc="state.fromC"/>
       </p>`;

    state = useState({ fromC: 3 });
    setup() {
      useLogLifecycle();
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      b = this;
    }
    state = useState({ fromB: 2 });
  }
  class A extends Component {
    static template = xml`<p><B fromA="state.fromA"/></p>`;
    static components = { B };
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const app = new App(A);
  const a = await app.mount(fixture);
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect([
    "A:willRender",
    "B:willUpdateProps",
    "A:rendered",
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
  ]).toBeLogged();

  // trigger a re-rendering from C, which will remap its new fiber
  c!.state.fromC += 10;
  // trigger a re-rendering from B, which will remap its new fiber as well
  b!.state.fromB += 10;

  // simulate a flush (nothing should have changed as no fiber should have its
  // counter to 0)
  app.scheduler.flush();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect([]).toBeLogged();

  // wait a bit and simulate another flush (we expect nothing to change as well)
  await nextMicroTick();
  app.scheduler.flush();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  expect(["C:willRender", "C:rendered"]).toBeLogged();

  await nextTick();
  expect(fixture.innerHTML).toBe(
    "<p><p><p><span>11</span><span>12</span><span>13</span></p></p></p>"
  );
  expect([
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "C:patched",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
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
        <t t-esc="props.fromA"/>:<t t-esc="props.fromB"/>:<t t-esc="state.fromC"/>:
        <D t-if="state.fromC === 13"/>`;
    static components = { D };
    state = { fromC: 3 }; // not reactive
    setup() {
      useLogLifecycle();
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<C fromB="state.fromB" fromA="props.fromA"/>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      b = this;
    }
    state = { fromB: 2 };
  }
  class A extends Component {
    static template = xml`<B fromA="state.fromA"/>`;
    static components = { B };
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle();
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("1:2:3: ");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

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
  expect([
    "A:willRender",
    "B:willUpdateProps",
    "A:rendered",
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
    "C:willRender",
    "C:rendered",
  ]).toBeLogged();

  // trigger a re-rendering from C, which will remap its new fiber
  c!.state.fromC += 10;
  c!.render();
  await nextMicroTick();
  // trigger a re-rendering from B, which will remap its new fiber as well
  b!.state.fromB += 10;
  b!.render();
  await nextTick();
  expect([
    "C:willRender",
    "D:setup",
    "D:willStart",
    "C:rendered",
    "D:willDestroy",
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
    "C:willRender",
    "D:setup",
    "D:willStart",
    "C:rendered",
  ]).toBeLogged();

  // at this point, C rendering is still pending, and nothing should have been
  // updated yet.
  expect(fixture.innerHTML).toBe("1:2:3: ");
  await nextTick();
  await nextTick();
  expect(fixture.innerHTML).toBe("11:12:13: D");
  expect([
    "D:willRender",
    "D:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "D:mounted",
    "C:patched",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
});

test("calling render in destroy", async () => {
  let a: any = null;
  let c: any = null;

  class C extends Component {
    static template = xml`
      <div>
        <t t-esc="props.fromA"/>
      </div>`;
  }

  let flag = false;
  class B extends Component {
    static template = xml`<C fromA="props.fromA"/>`;
    static components = { C };

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
    static template = xml`<B t-key="key" fromA="state"/>`;
    static components = { B };
    state = "a";
    key = 1;

    setup() {
      a = this;
    }
  }

  const app = new App(A);
  await app.mount(fixture);
  expect(fixture.innerHTML).toBe("<div>a</div>");
  expect(["B:setup", "B:willStart", "B:willRender", "B:rendered", "B:mounted"]).toBeLogged();

  a.state = "A";
  a.key = 2;
  a.render();
  await nextTick();
  // this nextTick is critical, otherwise jest may silently swallow errors
  await nextTick();
  expect([
    "B:setup",
    "B:willStart",
    "B:willRender",
    "B:rendered",
    "B:willUnmount",
    "B:willDestroy",
    "B:mounted",
    "B:willRender",
    "B:rendered",
    "B:willPatch",
    "B:patched",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div>A</div>");
});

test("change state and call manually render: no unnecessary rendering", async () => {
  let numberOfRender = 0;

  class Test extends Component {
    static template = xml`<div><t t-esc="value"/></div>`;
    state = useState({ val: 1 });

    setup() {
      useLogLifecycle();
    }
    get value() {
      numberOfRender++;
      return this.state.val;
    }
  }

  const test = await mount(Test, fixture);
  expect([
    "Test:setup",
    "Test:willStart",
    "Test:willRender",
    "Test:rendered",
    "Test:mounted",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div>1</div>");
  expect(numberOfRender).toBe(1);

  test.state.val = 2;
  test.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2</div>");
  expect(numberOfRender).toBe(2);
  expect(["Test:willRender", "Test:rendered", "Test:willPatch", "Test:patched"]).toBeLogged();
});

test("changing state before first render does not trigger a render", async () => {
  let renders = 0;

  class TestW extends Component {
    static template = xml`<div t-esc="value"/>`;
    state = useState({ drinks: 1 });
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
  expect([
    "TestW:setup",
    "TestW:willStart",
    "TestW:willRender",
    "TestW:rendered",
    "TestW:mounted",
  ]).toBeLogged();

  await nextTick();
  expect(renders).toBe(1);
  expect(fixture.innerHTML).toBe("<div>3</div>");
  expect([]).toBeLogged();
});

test("changing state before first render does not trigger a render (with parent)", async () => {
  let renders = 0;

  class TestW extends Component {
    static template = xml`<div t-esc="value"/>`;
    state = useState({ drinks: 1 });
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
    static template = xml`<div><TestW t-if="state.flag"/></div>`;
    setup() {
      useLogLifecycle();
    }
    state = useState({ flag: false });
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div></div>");
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "Parent:rendered",
    "Parent:mounted",
  ]).toBeLogged();

  parent.state.flag = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><div>3</div></div>");
  expect(renders).toBe(1);
  expect([
    "Parent:willRender",
    "TestW:setup",
    "TestW:willStart",
    "Parent:rendered",
    "TestW:willRender",
    "TestW:rendered",
    "Parent:willPatch",
    "TestW:mounted",
    "Parent:patched",
  ]).toBeLogged();
});

test("two renderings initiated between willPatch and patched", async () => {
  let parent: any = null;

  class Panel extends Component {
    static template = xml`<abc><t t-esc="props.val"/><t t-esc="mounted" /></abc>`;
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
    static template = xml`<div><Panel t-key="'panel_' + state.panel" val="state.panel" t-if="state.flag"/></div>`;
    static components = { Panel };
    state = useState({ panel: "Panel1", flag: true });
    setup() {
      useLogLifecycle();
      parent = this;
    }
  }

  await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><abc>Panel1</abc></div>");
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "Panel:setup",
    "Panel:willStart",
    "Parent:rendered",
    "Panel:willRender",
    "Panel:rendered",
    "Panel:mounted",
    "Parent:mounted",
    "Parent:willRender",
    "Panel:willUpdateProps",
    "Parent:rendered",
  ]).toBeLogged();

  await nextMicroTick();
  expect(["Panel:willRender", "Panel:rendered"]).toBeLogged();

  await nextTick();
  expect(["Parent:willPatch", "Panel:willPatch", "Panel:patched", "Parent:patched"]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div><abc>Panel1Mounted</abc></div>");

  parent.state.panel = "Panel2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><abc>Panel2</abc></div>");
  expect([
    "Parent:willRender",
    "Panel:setup",
    "Panel:willStart",
    "Parent:rendered",
    "Panel:willRender",
    "Panel:rendered",
    "Parent:willPatch",
    "Panel:willUnmount",
    "Panel:willDestroy",
    "Panel:mounted",
    "Parent:patched",
    "Parent:willRender",
    "Panel:willUpdateProps",
    "Parent:rendered",
  ]).toBeLogged();

  await nextTick();
  expect(fixture.innerHTML).toBe("<div><abc>Panel2Mounted</abc></div>");
  expect([
    "Panel:willRender",
    "Panel:rendered",
    "Parent:willPatch",
    "Panel:willPatch",
    "Panel:patched",
    "Parent:patched",
  ]).toBeLogged();

  parent.state.flag = false;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect([
    "Parent:willRender",
    "Parent:rendered",
    "Parent:willPatch",
    "Panel:willUnmount",
    "Panel:willDestroy",
    "Parent:patched",
    "Parent:willRender",
    "Parent:rendered",
  ]).toBeLogged();

  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect(["Parent:willPatch", "Parent:patched"]).toBeLogged();
});

test("parent and child rendered at exact same time", async () => {
  let child: any = null;

  class Child extends Component {
    static template = xml`<t t-esc="props.value"/>`;
    setup() {
      child = this;
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="state.value"/>`;
    static components = { Child };
    state = { value: 0 };
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("0");
  expect([
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
  ]).toBeLogged();

  parent.state.value = 1;
  parent.render();
  child.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("1");
  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:patched",
    "Parent:patched",
  ]).toBeLogged();
});

test("delay willUpdateProps", async () => {
  let promise: any = null;
  let child: any;

  class Child extends Component {
    static template = xml`<t t-esc="props.value"/>_<t t-esc="state.int" />`;
    state: any;
    setup() {
      useLogLifecycle();
      child = this;
      this.state = useState({ int: 0 });
      onWillUpdateProps(async () => {
        await promise;
        this.state.int++;
      });
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="state.value"/>`;
    static components = { Child };
    state = { value: 0 };
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("0_0");
  expect([
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
  ]).toBeLogged();

  promise = makeDeferred();
  const prom1 = promise;
  parent.state.value = 1;
  child.render(); // trigger a root rendering first
  parent.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0");
  expect(["Parent:willRender", "Child:willUpdateProps", "Parent:rendered"]).toBeLogged();

  promise = makeDeferred();
  const prom2 = promise;
  parent.state.value = 2;
  parent.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0");

  prom2.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_1");

  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:patched",
    "Parent:patched",
  ]).toBeLogged();

  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_2");

  expect(["Child:willRender", "Child:rendered", "Child:willPatch", "Child:patched"]).toBeLogged();
});

test("delay willUpdateProps with rendering grandchild", async () => {
  // This test is a bit tricky, a Parent and one of his grandchildren render while another of the parent's
  // grandchildren is awaiting its willUpdateProps.
  // Technically RootFibers will be downgraded in ChildFibers, keeping the same container RootFiber.
  // This case happens when Parent and ReaciveChild react together to a change in a reactive state/
  let promise: any = null;
  let child: any;
  let reactiveChild: any;

  // Delayed willUpdateProps
  class DelayedChild extends Component {
    static template = xml`<t t-esc="props.value"/>_<t t-esc="state.int" />`;
    state: any;
    setup() {
      useLogLifecycle();
      child = this;
      this.state = useState({ int: 0 });
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
      reactiveChild = this;
      useLogLifecycle();
    }
  }

  // The parent of everybody, we also manually trigger render on it.
  class Parent extends Component {
    static template = xml`<DelayedChild value="props.state.value"/><ReactiveChild />`;
    static components = { DelayedChild, ReactiveChild };
    setup() {
      useLogLifecycle();
    }
  }

  class GrandParent extends Component {
    static template = xml`<Parent state="state"/>`;
    static components = { Parent };
    state = { value: 0 };
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(GrandParent, fixture);
  expect(fixture.innerHTML).toBe("0_0<div></div>");
  expect([
    "GrandParent:setup",
    "GrandParent:willStart",
    "GrandParent:willRender",
    "Parent:setup",
    "Parent:willStart",
    "GrandParent:rendered",
    "Parent:willRender",
    "DelayedChild:setup",
    "DelayedChild:willStart",
    "ReactiveChild:setup",
    "ReactiveChild:willStart",
    "Parent:rendered",
    "DelayedChild:willRender",
    "DelayedChild:rendered",
    "ReactiveChild:willRender",
    "ReactiveChild:rendered",
    "ReactiveChild:mounted",
    "DelayedChild:mounted",
    "Parent:mounted",
    "GrandParent:mounted",
  ]).toBeLogged();

  promise = makeDeferred();
  const prom1 = promise;
  parent.state.value = 1;
  child.render(); // trigger a root rendering first
  parent.render(true);
  reactiveChild.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0<div></div>");
  expect([
    "GrandParent:willRender",
    "Parent:willUpdateProps",
    "GrandParent:rendered",
    "Parent:willRender",
    "DelayedChild:willUpdateProps",
    "ReactiveChild:willUpdateProps",
    "Parent:rendered",
    "ReactiveChild:willRender",
    "ReactiveChild:rendered",
  ]).toBeLogged();

  promise = makeDeferred();
  const prom2 = promise;
  child.render(); // trigger a root rendering first
  parent.state.value = 2;
  parent.render(true);
  reactiveChild.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("0_0<div></div>");
  expect([
    "GrandParent:willRender",
    "Parent:willUpdateProps",
    "GrandParent:rendered",
    "Parent:willRender",
    "DelayedChild:willUpdateProps",
    "ReactiveChild:willUpdateProps",
    "Parent:rendered",
    "ReactiveChild:willRender",
    "ReactiveChild:rendered",
  ]).toBeLogged();

  prom2.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_1<div></div>");
  expect([
    "DelayedChild:willRender",
    "DelayedChild:rendered",
    "GrandParent:willPatch",
    "Parent:willPatch",
    "ReactiveChild:willPatch",
    "DelayedChild:willPatch",
    "DelayedChild:patched",
    "ReactiveChild:patched",
    "Parent:patched",
    "GrandParent:patched",
  ]).toBeLogged();

  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("2_2<div></div>");
  expect([
    "DelayedChild:willRender",
    "DelayedChild:rendered",
    "DelayedChild:willPatch",
    "DelayedChild:patched",
  ]).toBeLogged();
});

test("two sequential renderings before an animation frame", async () => {
  class Child extends Component {
    static template = xml`<t t-esc="props.value"/>`;
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="state.value"/>`;
    static components = { Child };
    state = useState({ value: 0 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("0");
  expect([
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
  ]).toBeLogged();

  parent.state.value = 1;
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("0");
  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
  ]).toBeLogged();

  parent.state.value = 2;
  // enough microticks to wait for render + willupdateprops
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("0");
  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
  ]).toBeLogged();

  await nextTick();
  // we check here that the willPatch and patched hooks are called only once
  expect(["Parent:willPatch", "Child:willPatch", "Child:patched", "Parent:patched"]).toBeLogged();
});

test("t-key on dom node having a component", async () => {
  let def: any;
  class Child extends Component {
    static template = xml`<t t-esc="props.key" />`;
    setup() {
      onWillStart(() => def);
      useLogLifecycle(this.props.key);
    }
  }

  class Parent extends Component {
    key = 1;
    myComp = Child;
    static template = xml`<div t-key="key"><t t-component="myComp" key="key" /></div>`;
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");

  def = makeDeferred();
  parent.key = 2;
  parent.render();

  await nextTick();
  expect([
    "Child (1):setup",
    "Child (1):willStart",
    "Child (1):willRender",
    "Child (1):rendered",
    "Child (1):mounted",
    "Child (2):setup",
    "Child (2):willStart",
  ]).toBeLogged();
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
  expect([
    "Child (2):willDestroy",
    "Child (3):setup",
    "Child (3):willStart",
    "Child (3):willRender",
    "Child (3):rendered",
    "Child (1):willUnmount",
    "Child (1):willDestroy",
    "Child (3):mounted",
  ]).toBeLogged();
});

test("t-key on dynamic async component (toggler is never patched)", async () => {
  let def: any;
  class Child extends Component {
    static template = xml`<div t-esc="props.key" />`;
    setup() {
      onWillStart(() => def);
      useLogLifecycle(this.props.key);
    }
  }

  class Parent extends Component {
    key = 1;
    myComp = Child;
    static template = xml`<t t-component="myComp" t-key="key" key="key" />`;
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");

  def = makeDeferred();
  parent.key = 2;
  parent.render();

  await nextTick();
  expect([
    "Child (1):setup",
    "Child (1):willStart",
    "Child (1):willRender",
    "Child (1):rendered",
    "Child (1):mounted",
    "Child (2):setup",
    "Child (2):willStart",
  ]).toBeLogged();
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
  expect([
    "Child (2):willDestroy",
    "Child (3):setup",
    "Child (3):willStart",
    "Child (3):willRender",
    "Child (3):rendered",
    "Child (1):willUnmount",
    "Child (1):willDestroy",
    "Child (3):mounted",
  ]).toBeLogged();
});

test("t-foreach with dynamic async component", async () => {
  let def: any;
  class Child extends Component {
    static template = xml`<div t-esc="props.key" />`;
    setup() {
      onWillStart(() => def);
      useLogLifecycle(this.props.key);
    }
  }

  class Parent extends Component {
    list: any = [[1]];
    myComp = Child;
    static template = xml`<t t-foreach="list" t-as="arr" t-key="arr_index">
        <t t-if="arr" t-component="myComp" key="arr[0]" />
      </t>`;
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");

  def = makeDeferred();
  parent.list = [, [2]];
  parent.render();

  await nextTick();
  expect([
    "Child (1):setup",
    "Child (1):willStart",
    "Child (1):willRender",
    "Child (1):rendered",
    "Child (1):mounted",
    "Child (2):setup",
    "Child (2):willStart",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("<div>1</div>");
  parent.list = [, , [3]];
  parent.render();

  const prevDef = def;
  def = undefined;

  parent.render();
  prevDef.resolve();
  await nextTick();

  expect(fixture.innerHTML).toBe("<div>3</div>");
  expect([
    "Child (2):willDestroy",
    "Child (3):setup",
    "Child (3):willStart",
    "Child (3):willRender",
    "Child (3):rendered",
    "Child (1):willUnmount",
    "Child (1):willDestroy",
    "Child (3):mounted",
  ]).toBeLogged();
});

test("Cascading renders after microtaskTick", async () => {
  const state = [{ id: 0 }, { id: 1 }];
  let child: any;
  let parent: any;

  class Element extends Component {
    static template = xml`<t t-esc="props.id" />`;
  }

  class Child extends Component {
    static components = { Element };
    static template = xml`
      <t t-foreach="state" t-as="elem" t-key="elem.id">
        <Element id="elem.id"/>
      </t>`;
    state = state;
    setup() {
      child = this;
    }
  }

  class Parent extends Component {
    static components = { Child };
    static template = xml`<Child /> _ <t t-foreach="state" t-as="elem" t-key="elem.id" t-esc="elem.id"/>`;
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
    static template = xml`<t t-esc="props.value"/>`;
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`<Child value="state.value"/>`;
    static components = { Child };
    state = useState({ value: 1 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("1");
  expect([
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
  ]).toBeLogged();

  parent.state.value = 2;
  // wait for child to be rendered
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("1");

  // trigger a render, but keep the props for child the same
  parent.render();
  await nextTick();
  expect(fixture.innerHTML).toBe("2");
  expect([
    "Parent:willRender",
    "Child:willUpdateProps",
    "Parent:rendered",
    "Child:willRender",
    "Child:rendered",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:patched",
    "Parent:patched",
  ]).toBeLogged();
});

test("delayed rendering, but then initial rendering is cancelled by yet another render", async () => {
  const promC = makeDeferred();
  let stateB: any = null;

  class D extends Component {
    static template = xml`<button t-on-click="increment"><t t-esc="state.val"/></button>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class C extends Component {
    static template = xml`<D/><p><t t-esc="props.value"/></p>`;
    static components = { D };
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => promC);
    }
  }

  class B extends Component {
    static template = xml`<C value="state.someValue + props.value"/>`;
    static components = { C };
    state = useState({ someValue: 3 });
    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class A extends Component {
    static template = xml`<B value="state.value"/>`;
    static components = { B };
    state = useState({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("<button>1</button><p>36</p>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "D:setup",
    "D:willStart",
    "C:rendered",
    "D:willRender",
    "D:rendered",
    "D:mounted",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // update B and C, but render is blocked by C willupdateProps
  stateB.someValue = 5;
  await nextTick();
  expect(["B:willRender", "C:willUpdateProps", "B:rendered"]).toBeLogged();

  // update D => render should be delayed, because B is currently rendering
  fixture.querySelector("button")!.click();
  await nextTick();
  expect([]).toBeLogged();

  // update A => render should go to B and cancel it
  parent.state.value = 34;
  await nextTick();
  expect([
    "A:willRender",
    "B:willUpdateProps",
    "A:rendered",
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
  ]).toBeLogged();

  promC.resolve();
  await nextTick();
  expect([
    "C:willRender",
    "C:rendered",
    "D:willRender",
    "D:rendered",
    "D:willPatch",
    "D:patched",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "C:patched",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("<button>2</button><p>39</p>");
});

test("delayed rendering, reusing fiber and stuff", async () => {
  let prom1 = makeDeferred();
  let prom2 = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="increment"><t t-esc="state.val"/></button>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-esc="props.value"/><C />`;
    static components = { C };
    setup() {
      useLogLifecycle();
      let flag = false;
      onWillUpdateProps(() => {
        flag = true;
        return prom1;
      });
      onRendered(async () => {
        if (flag) {
          await nextMicroTick();
          prom2.resolve();
        }
      });
    }
  }

  class A extends Component {
    static template = xml`<B value="state.value"/>`;
    static components = { B };
    state = useState({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("33<button>1</button>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // initiate a render in A, but is blocked in B
  parent.state.value = 34;
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  // initiate a render in C => delayed because of render in A
  fixture.querySelector("button")!.click();
  await nextTick();
  expect([]).toBeLogged();

  // wait for render in A to be completed
  prom1.resolve();
  await prom2;
  expect(["B:willRender", "B:rendered", "C:willRender", "C:rendered"]).toBeLogged();

  // initiate a new render in A => fiber will be reused
  parent.state.value = 355;
  await nextTick();
  expect(fixture.innerHTML).toBe("355<button>2</button>");
  expect([
    "A:willRender",
    "B:willUpdateProps",
    "A:rendered",
    "B:willRender",
    "B:rendered",
    "A:willPatch",
    "B:willPatch",
    "B:patched",
    "A:patched",
    "C:willPatch",
    "C:patched",
  ]).toBeLogged();
});

test("delayed rendering, then component is destroyed and  stuff", async () => {
  let prom1 = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="increment"><t t-esc="state.val"/></button>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-esc="props.value"/><t t-if="props.value lt 10"><C /></t>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => prom1);
    }
  }

  class A extends Component {
    static template = xml`<B value="state.value"/>`;
    static components = { B };
    state = useState({ value: 3 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("3<button>1</button>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // initiate a render in C (so will be first task)
  fixture.querySelector("button")!.click();
  // initiate a render in A, but is blocked in B. the render will destroy c. also,
  // it blocks the render C
  parent.state.value = 34;
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  // wait for render in A to be completed
  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("34");
  expect([
    "B:willRender",
    "B:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willUnmount",
    "C:willDestroy",
    "B:patched",
    "A:patched",
  ]).toBeLogged();

  await nextTick();
});

test("delayed rendering, reusing fiber then component is destroyed and  stuff", async () => {
  let prom1 = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="increment"><t t-esc="state.val"/></button>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-esc="props.value"/><C />`;
    static components = { C };
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => prom1);
    }
  }

  class A extends Component {
    static template = xml`A<t t-if="state.value lt 15"><B value="state.value"/></t>`;
    static components = { B };
    state = useState({ value: 3 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("A3<button>1</button>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // initiate a render in A, but is blocked in B
  parent.state.value = 5;
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  // initiate a render in C (will be delayed because of render in A)
  fixture.querySelector("button")!.click();
  await nextTick();
  expect([]).toBeLogged();

  // initiate a render in A, that will destroy B
  parent.state.value = 23;
  await nextTick();
  expect(fixture.innerHTML).toBe("A");
  expect([
    "A:willRender",
    "A:rendered",
    "A:willPatch",
    "B:willUnmount",
    "C:willUnmount",
    "C:willDestroy",
    "B:willDestroy",
    "A:patched",
  ]).toBeLogged();
});

test("another scenario with delayed rendering", async () => {
  let prom1 = makeDeferred();
  let onSecondRenderA = makeDeferred();

  class C extends Component {
    static template = xml`<button t-on-click="increment"><t t-esc="state.val"/></button>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`<t t-esc="props.value"/><C />`;
    static components = { C };
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => prom1);
    }
  }

  class A extends Component {
    static template = xml`A<t t-if="state.value lt 15"><B value="state.value"/></t>`;
    static components = { B };
    state = useState({ value: 3 });
    setup() {
      useLogLifecycle();
      let n = 0;
      onRendered(() => {
        n++;
        if (n === 2) {
          onSecondRenderA.resolve();
        }
      });
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("A3<button>1</button>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // initiate a render in A, but is blocked in B
  parent.state.value = 5;
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  // initiate a render in C (will be delayed because of render in A)
  fixture.querySelector("button")!.click();
  await nextTick();
  expect([]).toBeLogged();

  // initiate a render in A, that will destroy B
  parent.state.value = 23;
  await onSecondRenderA;
  await nextMicroTick();
  expect(["A:willRender", "A:rendered"]).toBeLogged();

  // rerender A, but without destroying B
  parent.state.value = 7;
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  prom1.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("A7<button>2</button>");

  expect([
    "B:willRender",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "A:willPatch",
    "B:willPatch",
    "B:patched",
    "A:patched",
    "C:willPatch",
    "C:patched",
  ]).toBeLogged();
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
  expect([
    "A:setup",
    "A:willRender",
    "B:setup",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "B:rendered",
    "C:willRender",
    "D:setup",
    "C:rendered",
    "D:willRender",
    "D:rendered",
    "D:mounted",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();
  // Start a render in C
  c!.render(true);
  await nextMicroTick();
  expect(["C:willRender", "C:rendered"]).toBeLogged();
  // Start a render in A such that C is already rendered, but D will be delayed
  // (because A is rendering) then cancelled (when the render from A reaches C)
  a.render(true);
  // Make sure the render can go to completion (Cancelled fibers will throw when rendered)
  await nextTick();
  expect([
    "A:willRender",
    "A:rendered",
    "B:willRender",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "D:willRender",
    "D:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "D:willPatch",
    "D:patched",
    "C:patched",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
});

test("destroyed component causes other soon to be destroyed component to rerender, weird stuff happens", async () => {
  let def = makeDeferred();
  let c: any = null;

  class B extends Component {
    static template = xml`<t t-esc="props.value"/>`;
    setup() {
      useLogLifecycle();
      onRendered(() => {
        def.resolve();
      });
      onWillDestroy(() => {
        c.state.val++;
        c.render();
      });
    }
  }
  class C extends Component {
    static template = xml`<t t-esc="state.val + props.value"/>`;
    state = useState({ val: 0 });
    setup() {
      c = this;
      useLogLifecycle();
    }
  }

  class A extends Component {
    static template = xml`
      A
      <t t-if="state.flag">
        <B value="state.valueB"/>
        <C value="state.valueC"/>
      </t>`;
    static components = { B, C };
    state = useState({ flag: false, valueB: 1, valueC: 2 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe(" A ");
  expect(["A:setup", "A:willStart", "A:willRender", "A:rendered", "A:mounted"]).toBeLogged();

  // initiate a render in A, but is blocked in B
  parent.state.flag = true;

  await def;
  await nextMicroTick();
  expect([
    "A:willRender",
    "B:setup",
    "B:willStart",
    "C:setup",
    "C:willStart",
    "A:rendered",
    "B:willRender",
    "B:rendered",
    "C:willRender",
    "C:rendered",
  ]).toBeLogged();

  // initiate render in A => will cancel renders in B/C and restarts
  parent.state.valueB = 2;
  await nextTick();
  expect([
    "B:willDestroy",
    "C:willDestroy",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "C:setup",
    "C:willStart",
    "A:rendered",
    "B:willRender",
    "B:rendered",
    "C:willRender",
    "C:rendered",
    "A:willPatch",
    "C:mounted",
    "B:mounted",
    "A:patched",
  ]).toBeLogged();

  expect(fixture.innerHTML).toBe(" A 22");
});

test("delayed rendering, destruction, stuff happens", async () => {
  const promC = makeDeferred();
  let stateB: any = null;

  class D extends Component {
    static template = xml`D<button t-on-click="increment"><t t-esc="state.val"/></button>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class C extends Component {
    static template = xml`C<D/><p><t t-esc="props.value"/></p>`;
    static components = { D };
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => promC);
    }
  }

  class B extends Component {
    static template = xml`B<t t-if="state.hasChild"><C value="state.someValue + props.value"/></t>`;
    static components = { C };
    state = useState({ someValue: 3, hasChild: true });
    setup() {
      useLogLifecycle();
      stateB = this.state;
    }
  }

  class A extends Component {
    static template = xml`A<B value="state.value"/>`;
    static components = { B };
    state = useState({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("ABCD<button>1</button><p>36</p>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "C:willRender",
    "D:setup",
    "D:willStart",
    "C:rendered",
    "D:willRender",
    "D:rendered",
    "D:mounted",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // render in A, it updates B and C, but render is blocked in C
  parent.state.value = 50;
  await nextTick();
  expect([
    "A:willRender",
    "B:willUpdateProps",
    "A:rendered",
    "B:willRender",
    "C:willUpdateProps",
    "B:rendered",
  ]).toBeLogged();

  // update B => removes child C
  stateB.hasChild = false;
  // update D => render should be delayed, because AB is currently rendering
  fixture.querySelector("button")!.click();
  await nextTick();
  expect([
    "B:willRender",
    "B:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willUnmount",
    "D:willUnmount",
    "D:willDestroy",
    "C:willDestroy",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("AB");
});

test("renderings, destruction, patch, stuff, ... yet another variation", async () => {
  const promB = makeDeferred();

  class D extends Component {
    static template = xml`D<p t-on-click="increment"><t t-esc="state.val"/></p>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  // almost the same as D
  class C extends Component {
    static template = xml`C<span t-on-click="increment"><t t-esc="state.val"/></span>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    increment() {
      this.state.val++;
    }
  }

  class B extends Component {
    static template = xml`B<t t-if="props.value === 33"><C/></t>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => promB);
    }
  }

  class A extends Component {
    static template = xml`A<B value="state.value"/><D/>`;
    static components = { B, D };
    state = useState({ value: 33 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("ABC<span>1</span>D<p>1</p>");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "D:setup",
    "D:willStart",
    "A:rendered",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "B:rendered",
    "D:willRender",
    "D:rendered",
    "C:willRender",
    "C:rendered",
    "C:mounted",
    "D:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // render in A, it updates B, will remove C, stopped in B
  parent.state.value = 50;
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  // update C => render should be delayed, because AB is currently rendering
  fixture.querySelector("span")!.click();
  await nextTick();
  expect([]).toBeLogged();

  // resolve prom B => render is done, component C is destroyed
  promB.resolve();
  await nextTick();
  expect([
    "B:willRender",
    "B:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willUnmount",
    "C:willDestroy",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
  expect(fixture.innerHTML).toBe("ABD<p>1</p>");

  // update D => should just render completely independently
  fixture.querySelector("p")!.click();
  await nextTick();
  expect(["D:willRender", "D:rendered", "D:willPatch", "D:patched"]).toBeLogged();
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
    static template = xml`B<t t-esc="state.val"/>`;
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle("", true);
      b = this;
    }
  }
  let b: B;

  class A extends Component {
    static template = xml`A<t t-component="state.component"/>`;
    state: { component: ComponentConstructor } = useState({ component: B });
    setup() {
      useLogLifecycle("", true);
    }
  }

  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("AB1");
  expect([
    "A:setup",
    "A:willRender",
    "B:setup",
    "A:rendered",
    "B:willRender",
    "B:rendered",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();
  // start a render in B
  b!.state.val = 2;
  // start a render in A, invalidating the scheduled render of B, which could crash if executed.
  a.state.component = C;
  await nextTick();
  expect(fixture.innerHTML).toBe("AC");
  expect([
    "A:willRender",
    "C:setup",
    "A:rendered",
    "C:willRender",
    "C:rendered",
    "A:willPatch",
    "B:willUnmount",
    "B:willDestroy",
    "C:mounted",
    "A:patched",
  ]).toBeLogged();
});

//   test.skip("components with shouldUpdate=false", async () => {
//     const state = { p: 1, cc: 10 };

//     class ChildChild extends Component {
//       static template = xml`
//         <div>
//           child child: <t t-esc="state.cc"/>
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
//           parent: <t t-esc="state.p"/>
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
//           child child: <t t-esc="state.cc"/>
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
//           parent: <t t-esc="state.p"/>
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
