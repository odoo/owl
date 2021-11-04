import { App, Component, mount, onWillStart, onWillUpdateProps, useState } from "../../src";
import { Fiber } from "../../src/component/fibers";
import {
  onMounted,
  onPatched,
  onWillPatch,
  onWillUnmount,
} from "../../src/component/lifecycle_hooks";
import { Scheduler } from "../../src/component/scheduler";
import { status } from "../../src/component/status";
import { xml } from "../../src/tags";
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
    throw new Error("we got a memory leak...");
  }
});

describe("async rendering", () => {
  test("destroying a widget before start is over", async () => {
    let steps: string[] = [];
    let def = makeDeferred();
    let w: any = null;
    class W extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle(steps);
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
    expect(steps).toEqual(["W:setup", "W:willStart", "W:destroyed"]);
  });
});

test("destroying/recreating a subwidget with different props (if start is not over)", async () => {
  let steps: string[] = [];
  let def = makeDeferred();
  let n = 0;
  class Child extends Component {
    static template = xml`<span>child:<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  const w = await mount(W, fixture);

  expect(n).toBe(0);
  w.state.val = 2;

  await nextMicroTick();
  expect(n).toBe(1);
  w.state.val = 3;
  await nextMicroTick();
  expect(n).toBe(2);
  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>child:3</span></div>");
  expect(Object.values(w.__owl__.children).length).toBe(1);
  expect(steps).toEqual([
    "W:setup",
    "W:willStart",
    "W:render",
    "W:mounted",
    "W:render",
    "Child:setup",
    "Child:willStart",
    "W:render",
    "Child:destroyed",
    "Child:setup",
    "Child:willStart",
    "Child:render",
    "W:willPatch",
    "Child:mounted",
    "W:patched",
  ]);
  Object.freeze(steps);
});

test("creating two async components, scenario 1", async () => {
  let steps: string[] = [];

  let defA = makeDeferred();
  let defB = makeDeferred();
  let nbRenderings: number = 0;

  class ChildA extends Component {
    static template = xml`<span><t t-esc="getValue()"/></span>`;

    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("");
  parent.state.flagA = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("");
  expect(nbRenderings).toBe(0);
  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<span>a</span><span>b</span>");
  expect(nbRenderings).toBe(1);
  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "Parent:mounted",
    "Parent:render",
    "ChildA:setup",
    "ChildA:willStart",
    "Parent:render",
    "ChildA:destroyed",
    "ChildA:setup",
    "ChildA:willStart",
    "ChildB:setup",
    "ChildB:willStart",
    "ChildB:render",
    "ChildA:render",
    "Parent:willPatch",
    "ChildB:mounted",
    "ChildA:mounted",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("creating two async components, scenario 2", async () => {
  let steps: string[] = [];
  let defA = makeDeferred();
  let defB = makeDeferred();

  class ChildA extends Component {
    static template = xml`<span>a<t t-esc="props.val"/></span>`;

    setup() {
      useLogLifecycle(steps);
      onWillUpdateProps(() => defA);
    }
  }

  class ChildB extends Component {
    static template = xml`<span>b<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }
  const parent = await mount(Parent, fixture);

  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  parent.state.valA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a2</span><span>b2</span></div>");

  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "ChildA:setup",
    "ChildA:willStart",
    "ChildA:render",
    "ChildA:mounted",
    "Parent:mounted",
    "Parent:render",
    "ChildA:willUpdateProps",
    "Parent:render",
    "ChildA:willUpdateProps",
    "ChildB:setup",
    "ChildB:willStart",
    "ChildB:render",
    "ChildA:render",
    "Parent:willPatch",
    "ChildA:willPatch",
    "ChildB:mounted",
    "ChildA:patched",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("creating two async components, scenario 3 (patching in the same frame)", async () => {
  let steps: string[] = [];
  let defA = makeDeferred();
  let defB = makeDeferred();

  class ChildA extends Component {
    static template = xml`<span>a<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle(steps);
      onWillUpdateProps(() => defA);
    }
  }
  class ChildB extends Component {
    static template = xml`<span>b<t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }
  const parent = await mount(Parent, fixture);

  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  parent.state.valA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  parent.state.flagB = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  defB.resolve();
  expect(fixture.innerHTML).toBe("<div><span>a1</span></div>");
  defA.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>a2</span><span>b2</span></div>");

  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "ChildA:setup",
    "ChildA:willStart",
    "ChildA:render",
    "ChildA:mounted",
    "Parent:mounted",
    "Parent:render",
    "ChildA:willUpdateProps",
    "Parent:render",
    "ChildA:willUpdateProps",
    "ChildB:setup",
    "ChildB:willStart",
    "ChildB:render",
    "ChildA:render",
    "Parent:willPatch",
    "ChildA:willPatch",
    "ChildB:mounted",
    "ChildA:patched",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("update a sub-component twice in the same frame", async () => {
  const steps: string[] = [];
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  class ChildA extends Component {
    static template = xml`<span><t t-esc="props.val"/></span>`;
    setup() {
      onWillUpdateProps(() => defs[index++]);
      useLogLifecycle(steps);
    }
  }

  class Parent extends Component {
    static template = xml`<div><ChildA val="state.valA"/></div>`;
    static components = { ChildA };
    state = useState({ valA: 1 });
    setup() {
      useLogLifecycle(steps);
    }
  }
  const parent = await mount(Parent, fixture);

  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  parent.state.valA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  parent.state.valA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  defs[0].resolve();
  await Promise.resolve();
  defs[1].resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "ChildA:setup",
    "ChildA:willStart",
    "ChildA:render",
    "ChildA:mounted",
    "Parent:mounted",
    "Parent:render",
    "ChildA:willUpdateProps",
    "Parent:render",
    "ChildA:willUpdateProps",
    "ChildA:render",
    "Parent:willPatch",
    "ChildA:willPatch",
    "ChildA:patched",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("update a sub-component twice in the same frame, 2", async () => {
  const steps: string[] = [];
  class ChildA extends Component {
    static template = xml`<span><t t-esc="val()"/></span>`;

    setup() {
      useLogLifecycle(steps);
    }

    val() {
      steps.push("render");
      return this.props.val;
    }
  }

  class Parent extends Component {
    static template = xml`<div><ChildA val="state.valA"/></div>`;
    static components = { ChildA };
    state = useState({ valA: 1 });
    setup() {
      useLogLifecycle(steps);
    }
  }
  const parent = await mount(Parent, fixture);

  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  parent.state.valA = 2;
  await nextMicroTick();
  expect(steps.splice(0)).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "ChildA:setup",
    "ChildA:willStart",
    "ChildA:render",
    "render",
    "ChildA:mounted",
    "Parent:mounted",
    "Parent:render",
    "ChildA:willUpdateProps",
  ]);
  await nextMicroTick();
  // For an unknown reason, this test fails on windows without the next microtick. It works
  // in linux and osx, but fails on at least this machine.
  // I do not see anything harmful in waiting an extra tick. But it is annoying to not
  // know what is different.
  await nextMicroTick();
  expect(steps.splice(0)).toEqual(["ChildA:render", "render"]);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  parent.state.valA = 3;
  await nextMicroTick();
  expect(steps.splice(0)).toEqual(["Parent:render", "ChildA:willUpdateProps"]);
  await nextMicroTick();
  // same as above
  await nextMicroTick();
  expect(steps).toEqual(["ChildA:render", "render"]);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  expect(steps).toEqual([
    "ChildA:render",
    "render",
    "Parent:willPatch",
    "ChildA:willPatch",
    "ChildA:patched",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("properly behave when destroyed/unmounted while rendering ", async () => {
  const steps: string[] = [];
  const def = makeDeferred();

  class SubChild extends Component {
    static template = xml`<div/>`;

    setup() {
      useLogLifecycle(steps);
      onWillPatch(() => {
        throw new Error("Should not happen!");
      });
      onPatched(() => {
        throw new Error("Should not happen!");
      });
      onWillUpdateProps(() => {
        return def;
      });
    }
  }

  class Child extends Component {
    static template = xml`<div><SubChild /></div>`;
    static components = { SubChild };
    setup() {
      useLogLifecycle(steps);
    }
  }

  class Parent extends Component {
    static template = xml`
        <div><t t-if="state.flag"><Child val="state.val"/></t></div>`;
    static components = { Child };
    state = useState({ flag: true, val: "Framboise Lindemans" });
    setup() {
      useLogLifecycle(steps);
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><div><div></div></div></div>");

  // this change triggers a rendering of the parent. This rendering is delayed,
  // because child is now waiting for def to be resolved
  parent.state.val = "Framboise Girardin";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><div><div></div></div></div>");

  // with this, we remove child, and subchild, even though it is not finished
  // rendering from previous changes
  parent.state.flag = false;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");

  // we now resolve def, so the child rendering is now complete.
  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");
  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "Child:setup",
    "Child:willStart",
    "Child:render",
    "SubChild:setup",
    "SubChild:willStart",
    "SubChild:render",
    "SubChild:mounted",
    "Child:mounted",
    "Parent:mounted",
    "Parent:render",
    "Child:willUpdateProps",
    "Child:render",
    "SubChild:willUpdateProps",
    "Parent:render",
    "Parent:willPatch",
    "Child:willUnmount",
    "SubChild:willUnmount",
    "SubChild:destroyed",
    "Child:destroyed",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("rendering component again in next microtick", async () => {
  const steps: string[] = [];

  class Child extends Component {
    static template = xml`<div>Child</div>`;
    setup() {
      useLogLifecycle(steps);
    }
  }

  class Parent extends Component {
    static template = xml`
          <div>
            <button t-on-click="onClick">Click</button>
            <t t-if="env.flag"><Child/></t>
          </div>`;
    static components = { Child };

    setup() {
      useLogLifecycle(steps);
    }
    async onClick() {
      this.env.flag = true;
      this.render();
      await Promise.resolve();
      this.render();
    }
  }

  await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><button>Click</button></div>");
  fixture.querySelector("button")!.click();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><button>Click</button><div>Child</div></div>");

  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "Parent:mounted",
    "Parent:render",
    "Child:setup",
    "Child:willStart",
    "Parent:render",
    "Child:destroyed",
    "Child:setup",
    "Child:willStart",
    "Child:render",
    "Parent:willPatch",
    "Child:mounted",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 1", async () => {
  const steps: string[] = [];
  const def = makeDeferred();
  let stateB: any = null;

  class ComponentC extends Component {
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="someValue()"/></span>`;
    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    static components = { ComponentB };
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");

  stateB.fromB = "c";
  await nextTick();

  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");

  expect(ComponentC.prototype.someValue).toBeCalledTimes(1);
  def.resolve();
  await nextTick();

  expect(fixture.innerHTML).toBe("<div><p><span>2c</span></p></div>");
  expect(ComponentC.prototype.someValue).toBeCalledTimes(2);

  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentC:render",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentC:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 2", async () => {
  const steps: string[] = [];
  // this test asserts that a rendering initiated before another one, and that
  // ends after it, is re-mapped to that second rendering
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateB: any = null;
  class ComponentC extends Component {
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;

    setup() {
      useLogLifecycle(steps);
      onWillUpdateProps(() => defs[index++]);
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
    static components = { ComponentC };
    state = useState({ fromB: "b" });

    setup() {
      useLogLifecycle(steps);
      stateB = this.state;
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><t t-esc="state.fromA"/><ComponentB fromA="state.fromA"/></div>`;
    static components = { ComponentB };
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>1<p><span>1b</span></p></div>");

  defs[1].resolve(); // resolve rendering initiated in B
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2<p><span>2c</span></p></div>");

  defs[0].resolve(); // resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>2<p><span>2c</span></p></div>");
  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentC:render",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentC:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 2bis", async () => {
  const steps: string[] = [];
  const defs = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateB: any = null;
  class ComponentC extends Component {
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;

    setup() {
      useLogLifecycle(steps);
      onWillUpdateProps(() => defs[index++]);
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
    static components = { ComponentC };
    state = useState({ fromB: "b" });

    setup() {
      useLogLifecycle(steps);
      stateB = this.state;
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    static components = { ComponentB };
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>");

  defs[0].resolve(); // resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>1b</span></p></div>"); // TODO: is this what we want?? 2b could be ok too

  defs[1].resolve(); // resolve rendering initiated in B
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2c</span></p></div>");
  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentC:render",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentC:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 3", async () => {
  const steps: string[] = [];
  const defB = makeDeferred();
  const defsD = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;

    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
      stateC = this.state;
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
    static components = { ComponentC };

    setup() {
      useLogLifecycle(steps);
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  stateC.fromC = "d";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  defB.resolve(); // resolve rendering initiated in A (still blocked in D)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  defsD[0].resolve(); // resolve rendering initiated in C (should be ignored)
  await nextTick();
  expect(ComponentD.prototype.someValue).toBeCalledTimes(1);
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  defsD[1].resolve(); // completely resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>2d</i></span></p></div>");
  expect(ComponentD.prototype.someValue).toBeCalledTimes(2);

  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentC:render",
    "ComponentD:setup",
    "ComponentD:willStart",
    "ComponentD:render",
    "ComponentD:mounted",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentC:render",
    "ComponentD:willUpdateProps",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentC:render",
    "ComponentD:willUpdateProps",
    "ComponentD:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentD:willPatch",
    "ComponentD:patched",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 4", async () => {
  const steps: string[] = [];
  const defB = makeDeferred();
  const defsD = [makeDeferred(), makeDeferred()];
  let index = 0;
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;

    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
      stateC = this.state;
    }
  }

  class ComponentB extends Component {
    static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
    static components = { ComponentC };

    setup() {
      useLogLifecycle(steps);
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  stateC.fromC = "d";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  defB.resolve(); // resolve rendering initiated in A (still blocked in D)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>1c</i></span></p></div>");

  defsD[1].resolve(); // completely resolve rendering initiated in A
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>2d</i></span></p></div>");
  expect(ComponentD.prototype.someValue).toBeCalledTimes(2);

  defsD[0].resolve(); // resolve rendering initiated in C (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span><i>2d</i></span></p></div>");
  expect(ComponentD.prototype.someValue).toBeCalledTimes(2);

  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentC:render",
    "ComponentD:setup",
    "ComponentD:willStart",
    "ComponentD:render",
    "ComponentD:mounted",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentC:render",
    "ComponentD:willUpdateProps",
    "ComponentB:render",
    "ComponentC:willUpdateProps",
    "ComponentC:render",
    "ComponentD:willUpdateProps",
    "ComponentD:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentD:willPatch",
    "ComponentD:patched",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 5", async () => {
  const steps: string[] = [];
  const defsB = [makeDeferred(), makeDeferred()];
  let index = 0;

  class ComponentB extends Component {
    static template = xml`<p><t t-esc="someValue()" /></p>`;

    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");

  component.state.fromA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");

  defsB[0].resolve(); // resolve first re-rendering (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(1);

  defsB[1].resolve(); // resolve second re-rendering
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 6", async () => {
  const steps: string[] = [];
  const defsB = [makeDeferred(), makeDeferred()];
  let index = 0;

  class ComponentB extends Component {
    static template = xml`<p><t t-esc="someValue()" /></p>`;

    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");

  component.state.fromA = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1</p></div>");

  defsB[1].resolve(); // resolve second re-rendering
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);

  defsB[0].resolve(); // resolve first re-rendering (should be ignored)
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 7", async () => {
  const steps: string[] = [];

  class ComponentB extends Component {
    static template = xml`<p><t t-esc="props.fromA" /><t t-esc="someValue()" /></p>`;
    state = useState({ fromB: "b" });

    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(1);

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>2c</p></div>");
  expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 8", async () => {
  const steps: string[] = [];

  const def = makeDeferred();
  let stateB: any = null;
  class ComponentB extends Component {
    static template = xml`<p><t t-esc="props.fromA" /><t t-esc="state.fromB" /></p>`;
    state = useState({ fromB: "b" });
    setup() {
      useLogLifecycle(steps);
      stateB = this.state;
      onWillUpdateProps(() => def);
    }
  }

  class ComponentA extends Component {
    static components = { ComponentB };
    static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");

  component.state.fromA = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");

  stateB.fromB = "c";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p>2c</p></div>");

  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
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
  const steps: string[] = [];
  const def = makeDeferred();
  let stateC: any = null;

  class ComponentD extends Component {
    static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromC"/></span>`;
    setup() {
      useLogLifecycle(steps);
    }
  }

  class ComponentC extends Component {
    static template = xml`<p><ComponentD fromA="props.fromA" fromC="state.fromC" /></p>`;
    static components = { ComponentD };
    state = useState({ fromC: "b1" });

    setup() {
      stateC = this.state;
      useLogLifecycle(steps);
    }
  }
  class ComponentB extends Component {
    static template = xml`<b><t t-esc="props.fromA"/></b>`;

    setup() {
      onWillUpdateProps(() => def);
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  const component = await mount(ComponentA, fixture);

  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");

  component.state.fromA = "a2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");

  stateC.fromC = "b2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a1<b>a1</b><p><span>a1b1</span></p></div>");

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div>a2<b>a2</b><p><span>a2b2</span></p></div>");

  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentB:render",
    "ComponentC:render",
    "ComponentD:setup",
    "ComponentD:willStart",
    "ComponentD:render",
    "ComponentD:mounted",
    "ComponentC:mounted",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentC:willUpdateProps",
    "ComponentC:render",
    "ComponentD:willUpdateProps",
    "ComponentD:render",
    "ComponentC:render",
    "ComponentD:willUpdateProps",
    "ComponentD:render",
    "ComponentB:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:willPatch",
    "ComponentD:willPatch",
    "ComponentD:patched",
    "ComponentC:patched",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
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

  const steps: string[] = [];
  const defB = makeDeferred();
  const defC = makeDeferred();
  let stateB: any = null;
  let rendered = 0;
  class ComponentC extends Component {
    static template = xml`<span><t t-esc="value"/></span>`;
    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
      stateB = this.state;
      onWillUpdateProps(() => defB);
    }
  }

  class ComponentA extends Component {
    static template = xml`<div><ComponentB value="state.value"/></div>`;
    static components = { ComponentB };
    state = useState({ value: 1 });

    setup() {
      useLogLifecycle(steps);
    }
  }

  const componentA = await mount(ComponentA, fixture);
  expect(fixture.innerHTML).toBe("<div><p></p></div>");
  stateB.hasChild = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p></p></div>");

  componentA.state.value = 2;
  defC.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p></p></div>");

  defB.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><p><span>2</span></p></div>");
  expect(rendered).toBe(1);
  expect(steps).toEqual([
    "ComponentA:setup",
    "ComponentA:willStart",
    "ComponentA:render",
    "ComponentB:setup",
    "ComponentB:willStart",
    "ComponentB:render",
    "ComponentB:mounted",
    "ComponentA:mounted",
    "ComponentB:render",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentA:render",
    "ComponentB:willUpdateProps",
    "ComponentB:render",
    "ComponentC:destroyed",
    "ComponentC:setup",
    "ComponentC:willStart",
    "ComponentC:render",
    "ComponentA:willPatch",
    "ComponentB:willPatch",
    "ComponentC:mounted",
    "ComponentB:patched",
    "ComponentA:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 11", async () => {
  // This scenario is the following: we have a component being updated (by props),
  // and then rendered (render method), but before the willUpdateProps resolves.
  // We check that in that case, the return value of the render method is a promise
  // that is resolved when the component is completely rendered (so, properly
  // remapped to the promise of the ambient rendering)
  const steps: string[] = [];
  const def = makeDeferred();
  let child: any = null;
  class Child extends Component {
    static template = xml`<span><t t-esc="props.val"/>|<t t-esc="val"/></span>`;
    val = 3;

    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }
  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>1|3</span></div>");
  parent.state.valA = 2;

  await nextTick();
  setTimeout(() => {
    def.resolve();
  }, 20);
  child.val = 5;
  await child.render();
  expect(fixture.innerHTML).toBe("<div><span>2|5</span></div>");

  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "Child:setup",
    "Child:willStart",
    "Child:render",
    "Child:mounted",
    "Parent:mounted",
    "Parent:render",
    "Child:willUpdateProps",
    "Child:render",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:patched",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 12", async () => {
  // In this scenario, we have a parent component that will be re-rendered
  // several times simultaneously:
  //    - once in a tick: it will create a new fiber, render it, but will have
  //    to wait for its child (blocking) to be completed
  //    - twice in the next tick: it will twice reuse the same fiber (as it is
  //    rendered but not completed yet)
  const steps: string[] = [];
  const def = makeDeferred();

  class Child extends Component {
    static template = xml`<span><t t-esc="props.val"/></span>`;
    setup() {
      useLogLifecycle(steps);
      onWillUpdateProps(() => def);
    }
  }

  let rendered = 0;

  class Parent extends Component {
    static template = xml`<div><Child val="val"/></div>`;
    static components = { Child };
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle(steps);
    }

    get val() {
      rendered++;
      return this.state.val;
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(1);

  parent.state.val = 2;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(2);

  parent.state.val = 3;
  parent.state.val = 4;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  expect(rendered).toBe(3);

  def.resolve();
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><span>4</span></div>");
  expect(rendered).toBe(3);
  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "Child:setup",
    "Child:willStart",
    "Child:render",
    "Child:mounted",
    "Parent:mounted",
    "Parent:render",
    "Child:willUpdateProps",
    "Parent:render",
    "Child:willUpdateProps",
    "Child:render",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:patched",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 13", async () => {
  const steps: string[] = [];
  let lastChild: any = null;

  class Child extends Component {
    static template = xml`<span><t t-esc="state.val"/></span>`;
    state = useState({ val: 0 });
    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><span>0</span></div>");

  await nextTick(); // wait for changes triggered in mounted to be applied
  expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

  parent.state.bool = true;
  await nextTick(); // wait for this change to be applied
  await nextTick(); // wait for changes triggered in mounted to be applied
  expect(fixture.innerHTML).toBe("<div><span>0</span><span>1</span></div>");
  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "Child:setup",
    "Child:willStart",
    "Child:render",
    "Child:mounted",
    "Parent:mounted",
    "Child:render",
    "Child:willPatch",
    "Child:patched",
    "Parent:render",
    "Child:willUpdateProps",
    "Child:setup",
    "Child:willStart",
    "Child:render",
    "Child:render",
    "Parent:willPatch",
    "Child:willPatch",
    "Child:mounted",
    "Child:patched",
    "Parent:patched",
    "Child:render",
    "Child:render",
    "Child:willPatch",
    "Child:patched",
    "Child:willPatch",
    "Child:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 14", async () => {
  const steps: string[] = [];
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
      useLogLifecycle(steps);
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
    static components = { C };
    setup() {
      useLogLifecycle(steps);
      b = this;
    }
    state = useState({ fromB: 2 });
  }

  class A extends Component {
    static template = xml`<p><B fromA="state.fromA"/></p>`;
    static components = { B };
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle(steps);
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

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
  expect(steps).toEqual([
    "A:setup",
    "A:willStart",
    "A:render",
    "B:setup",
    "B:willStart",
    "B:render",
    "C:setup",
    "C:willStart",
    "C:render",
    "C:mounted",
    "B:mounted",
    "A:mounted",
    "A:render",
    "B:willUpdateProps",
    "B:render",
    "C:willUpdateProps",
    "C:render",
    "B:render",
    "C:willUpdateProps",
    "C:render",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "C:patched",
    "B:patched",
    "A:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 15", async () => {
  const steps: string[] = [];
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
      useLogLifecycle(steps);
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
    static components = { C };
    setup() {
      useLogLifecycle(steps);
      b = this;
    }
    state = useState({ fromB: 2 });
  }
  class A extends Component {
    static template = xml`<p><B fromA="state.fromA"/></p>`;
    static components = { B };
    state = useState({ fromA: 1 });
    setup() {
      useLogLifecycle(steps);
    }
  }
  const app = new App(A);
  const a = await app.mount(fixture);
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

  // trigger a re-rendering from C, which will remap its new fiber
  c!.state.fromC += 10;
  // trigger a re-rendering from B, which will remap its new fiber as well
  b!.state.fromB += 10;

  // simulate a flush (nothing should have changed as no fiber should have its
  // counter to 0)
  app.scheduler.flush();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

  // wait a bit and simulate another flush (we expect nothing to change as well)
  await nextMicroTick();
  app.scheduler.flush();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

  await nextTick();
  expect(fixture.innerHTML).toBe(
    "<p><p><p><span>11</span><span>12</span><span>13</span></p></p></p>"
  );
  expect(steps).toEqual([
    "A:setup",
    "A:willStart",
    "A:render",
    "B:setup",
    "B:willStart",
    "B:render",
    "C:setup",
    "C:willStart",
    "C:render",
    "C:mounted",
    "B:mounted",
    "A:mounted",
    "A:render",
    "B:willUpdateProps",
    "B:render",
    "C:willUpdateProps",
    "C:render",
    "B:render",
    "C:willUpdateProps",
    "C:render",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "C:patched",
    "B:patched",
    "A:patched",
  ]);
  Object.freeze(steps);
});

test("concurrent renderings scenario 16", async () => {
  const steps: string[] = [];
  let b: B | undefined = undefined;
  let c: C | undefined = undefined;
  class D extends Component {
    static template = xml`<ul>DDD</ul>`;

    setup() {
      useLogLifecycle(steps);
      onWillStart(async () => {
        await nextTick();
        await nextTick();
      });
    }
  }
  class C extends Component {
    static template = xml`
       <p>
        <span t-esc="props.fromA"/>
        <span t-esc="props.fromB"/>
        <span t-esc="state.fromC"/>
        <D t-if="state.fromC === 13"/>
       </p>`;
    static components = { D };
    state = { fromC: 3 }; // not reactive
    setup() {
      useLogLifecycle(steps);
      c = this;
    }
  }
  class B extends Component {
    static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
    static components = { C };
    setup() {
      useLogLifecycle(steps);
      b = this;
    }
    state = useState({ fromB: 2 });
  }
  class A extends Component {
    static template = xml`<p><B fromA="state.fromA"/></p>`;
    static components = { B };
    state = useState({ fromA: 1 });

    setup() {
      useLogLifecycle(steps);
    }
  }
  const a = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

  // trigger a re-rendering of the whole tree
  a.state.fromA += 10;
  // wait enough for the whole tree to be re-rendered, but not patched yet
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  await nextMicroTick();
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");

  // trigger a re-rendering from C, which will remap its new fiber
  c!.state.fromC += 10;
  const prom = c!.render();
  // trigger a re-rendering from B, which will remap its new fiber as well
  b!.state.fromB += 10;

  await nextTick();
  // at this point, C rendering is still pending, and nothing should have been
  // updated yet.
  expect(fixture.innerHTML).toBe("<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>");
  await prom;
  expect(fixture.innerHTML).toBe(
    "<p><p><p><span>11</span><span>12</span><span>13</span><ul>DDD</ul></p></p></p>"
  );
  expect(steps).toEqual([
    "A:setup",
    "A:willStart",
    "A:render",
    "B:setup",
    "B:willStart",
    "B:render",
    "C:setup",
    "C:willStart",
    "C:render",
    "C:mounted",
    "B:mounted",
    "A:mounted",
    "A:render",
    "B:willUpdateProps",
    "B:render",
    "C:willUpdateProps",
    "C:render",
    "B:render",
    "C:willUpdateProps",
    "C:render",
    "D:setup",
    "D:willStart",
    "D:render",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "D:mounted",
    "C:patched",
    "B:patched",
    "A:patched",
  ]);
  Object.freeze(steps);
});

// test.skip("concurrent renderings scenario 17", async () => {
//   class Parent extends Component {
//     static template = xml`<span><t t-esc="state.value"/></span>`;
//     state = useState({ value: 1 });
//   }

//   const parent = await mount(Parent, fixture);
//   expect(fixture.innerHTML).toBe("<span>1</span>");

//   parent.state.value = 2;
//   parent.__owl__.fiber!.cancel();

//   parent.state.value = 3; // update value directly
//   await nextTick();
//   expect(fixture.innerHTML).toBe("<span>3</span>");

//   parent.state.value = 4; // update value after a tick
//   await nextTick();
//   expect(fixture.innerHTML).toBe("<span>4</span>");
// });

// TODO: unskip when t-key is reimplemented properly
test("calling render in destroy", async () => {
  const steps: any[] = [];

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
      c = this;
      onMounted(() => {
        steps.push("B:mounted");
        if (flag) {
          this.render();
        } else {
          flag = true;
        }
      });

      onWillUnmount(() => {
        steps.push("B:willUnmount");
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

  a.state = "A";
  a.key = 2;
  await a.render();
  // this nextTick is critical, otherwise jest may silently swallow errors
  await nextTick();

  expect(steps).toStrictEqual(["B:mounted", "B:willUnmount", "B:mounted"]);
  expect(fixture.innerHTML).toBe("<div>A</div>");
});

test("change state and call manually render: no unnecessary rendering", async () => {
  const steps: string[] = [];
  let numberOfRender = 0;

  class Test extends Component {
    static template = xml`<div><t t-esc="value"/></div>`;
    state = useState({ val: 1 });

    setup() {
      useLogLifecycle(steps);
    }
    get value() {
      numberOfRender++;
      return this.state.val;
    }
  }

  const test = await mount(Test, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");
  expect(numberOfRender).toBe(1);

  test.state.val = 2;
  await test.render();
  expect(fixture.innerHTML).toBe("<div>2</div>");
  expect(numberOfRender).toBe(2);
  expect(steps).toEqual([
    "Test:setup",
    "Test:willStart",
    "Test:render",
    "Test:mounted",
    "Test:render",
    "Test:willPatch",
    "Test:patched",
  ]);
  Object.freeze(steps);
});

test("changing state before first render does not trigger a render", async () => {
  const steps: string[] = [];
  let renders = 0;

  class TestW extends Component {
    static template = xml`<div t-esc="value"/>`;
    state = useState({ drinks: 1 });
    setup() {
      useLogLifecycle(steps);
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

  await nextTick();
  expect(renders).toBe(1);
  expect(fixture.innerHTML).toBe("<div>3</div>");
  expect(steps).toEqual(["TestW:setup", "TestW:willStart", "TestW:render", "TestW:mounted"]);
  Object.freeze(steps);
});

test("changing state before first render does not trigger a render (with parent)", async () => {
  const steps: string[] = [];
  let renders = 0;

  class TestW extends Component {
    static template = xml`<div t-esc="value"/>`;
    state = useState({ drinks: 1 });
    setup() {
      useLogLifecycle(steps);
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
      useLogLifecycle(steps);
    }
    state = useState({ flag: false });
  }

  const parent = await mount(Parent, fixture);

  expect(fixture.innerHTML).toBe("<div></div>");
  expect(steps).toEqual(["Parent:setup", "Parent:willStart", "Parent:render", "Parent:mounted"]);
  steps.splice(0);
  parent.state.flag = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><div>3</div></div>");
  expect(renders).toBe(1);
  expect(steps).toEqual([
    "Parent:render",
    "TestW:setup",
    "TestW:willStart",
    "TestW:render",
    "Parent:willPatch",
    "TestW:mounted",
    "Parent:patched",
  ]);
  Object.freeze(steps);
});

test("render method wait until rendering is done", async () => {
  class TestW extends Component {
    static template = xml`<div><t t-esc="state.drinks"/></div>`;
    state = { drinks: 1 };
  }
  const widget = await mount(TestW, fixture);
  expect(fixture.innerHTML).toBe("<div>1</div>");

  widget.state.drinks = 2;

  const renderPromise = widget.render();
  expect(fixture.innerHTML).toBe("<div>1</div>");
  await renderPromise;
  expect(fixture.innerHTML).toBe("<div>2</div>");
});

test("two renderings initiated between willPatch and patched", async () => {
  let parent: any = null;
  const steps: string[] = [];

  class Panel extends Component {
    static template = xml`<abc><t t-esc="props.val"/></abc>`;
    setup() {
      useLogLifecycle(steps);
      onMounted(() => parent.render());
      onWillUnmount(() => parent.render());
    }
  }

  // Main root component
  class Parent extends Component {
    static template = xml`<div><Panel t-key="'panel_' + state.panel" val="state.panel" t-if="state.flag"/></div>`;
    static components = { Panel };
    state = useState({ panel: "Panel1", flag: true });
    setup() {
      useLogLifecycle(steps);
      parent = this;
    }
  }

  await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("<div><abc>Panel1</abc></div>");

  expect(steps).toEqual([
    "Parent:setup",
    "Parent:willStart",
    "Parent:render",
    "Panel:setup",
    "Panel:willStart",
    "Panel:render",
    "Panel:mounted",
    "Parent:mounted",
  ]);
  steps.length = 0;

  parent.state.panel = "Panel2";
  await nextTick();
  expect(fixture.innerHTML).toBe("<div><abc>Panel2</abc></div>");

  expect(steps).toEqual([
    "Parent:render",
    "Panel:setup",
    "Panel:willStart",
    "Panel:render",
    "Parent:willPatch",
    "Panel:willUnmount",
    "Panel:destroyed",
    "Panel:mounted",
    "Parent:patched",
  ]);
  steps.length = 0;

  parent.state.flag = false;
  await nextTick();
  expect(fixture.innerHTML).toBe("<div></div>");

  expect(steps).toEqual([
    "Parent:render",
    "Parent:willPatch",
    "Panel:willUnmount",
    "Panel:destroyed",
    "Parent:patched",
  ]);
  Object.freeze(steps);
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
