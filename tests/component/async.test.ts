import { Component, Env, STATUS } from "../../src/component/component";
import { useState } from "../../src/hooks";
import { xml } from "../../src/tags";
import { makeDeferred, makeTestEnv, makeTestFixture, nextMicroTick, nextTick } from "../helpers";

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

function children(w: Component): Component[] {
  const childrenMap = w.__owl__.children;
  return Object.keys(childrenMap).map((id) => childrenMap[id]);
}

describe("async rendering", () => {
  test("destroying a widget before start is over", async () => {
    let def = makeDeferred();
    class W extends Component {
      static template = xml`<div/>`;
      willStart(): Promise<void> {
        return def;
      }
    }
    const w = new W();
    expect(w.__owl__.status).toBe(STATUS.CREATED);
    w.mount(fixture);
    expect(w.__owl__.status).toBe(STATUS.WILLSTARTED);
    w.destroy();
    expect(w.__owl__.status).toBe(STATUS.DESTROYED);
    def.resolve();
    await nextTick();
    expect(w.__owl__.status).toBe(STATUS.DESTROYED);
  });

  test("destroying/recreating a subwidget with different props (if start is not over)", async () => {
    let def = makeDeferred();
    let n = 0;
    class Child extends Component {
      static template = xml`<span>child:<t t-esc="props.val"/></span>`;
      constructor(parent, props) {
        super(parent, props);
        n++;
      }
      willStart(): Promise<void> {
        return def;
      }
    }
    class W extends Component {
      static template = xml`<div><t t-if="state.val > 1"><Child val="state.val"/></t></div>`;
      static components = { Child };
      state = useState({ val: 1 });
    }

    const w = new W();
    await w.mount(fixture);
    expect(n).toBe(0);
    w.state.val = 2;

    await nextMicroTick();
    expect(n).toBe(1);
    w.state.val = 3;
    await nextMicroTick();
    expect(n).toBe(2);
    def.resolve();
    await nextTick();
    expect(children(w).length).toBe(1);
    expect(fixture.innerHTML).toBe("<div><span>child:3</span></div>");
  });

  test("creating two async components, scenario 1", async () => {
    let defA = makeDeferred();
    let defB = makeDeferred();
    let nbRenderings: number = 0;

    class ChildA extends Component {
      static template = xml`<span><t t-esc="getValue()"/></span>`;
      willStart(): Promise<void> {
        return defA;
      }
      getValue() {
        nbRenderings++;
        return "a";
      }
    }

    class ChildB extends Component {
      static template = xml`<span>b</span>`;
      willStart(): Promise<void> {
        return defB;
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <t t-if="state.flagA"><ChildA /></t>
            <t t-if="state.flagB"><ChildB /></t>
          </div>`;
      static components = { ChildA, ChildB };
      state = useState({ flagA: false, flagB: false });
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    parent.state.flagA = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    parent.state.flagB = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    defB.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(nbRenderings).toBe(0);
    defA.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>a</span><span>b</span></div>");
    expect(nbRenderings).toBe(1);
  });

  test("creating two async components, scenario 2", async () => {
    let defA = makeDeferred();
    let defB = makeDeferred();

    class ChildA extends Component {
      static template = xml`<span>a<t t-esc="props.val"/></span>`;
      willUpdateProps(): Promise<void> {
        return defA;
      }
    }
    class ChildB extends Component {
      static template = xml`<span>b<t t-esc="props.val"/></span>`;
      willStart(): Promise<void> {
        return defB;
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
    }
    const parent = new Parent();
    await parent.mount(fixture);
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
  });

  test("creating two async components, scenario 3 (patching in the same frame)", async () => {
    let defA = makeDeferred();
    let defB = makeDeferred();

    class ChildA extends Component {
      static template = xml`<span>a<t t-esc="props.val"/></span>`;
      willUpdateProps(): Promise<void> {
        return defA;
      }
    }
    class ChildB extends Component {
      static template = xml`<span>b<t t-esc="props.val"/></span>`;
      willStart(): Promise<void> {
        return defB;
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
    }
    const parent = new Parent();
    await parent.mount(fixture);
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
  });

  test("update a sub-component twice in the same frame", async () => {
    const steps: string[] = [];
    const defs = [makeDeferred(), makeDeferred()];
    let index = 0;
    class ChildA extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
      willUpdateProps(): Promise<void> {
        return defs[index++];
      }
      patched() {
        steps.push("patched");
      }
    }

    class Parent extends Component {
      static template = xml`<div><ChildA val="state.valA"/></div>`;
      static components = { ChildA };
      state = useState({ valA: 1 });
    }
    const parent = new Parent();
    await parent.mount(fixture);
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
    expect(steps).toEqual(["patched"]);
  });

  test("update a sub-component twice in the same frame, 2", async () => {
    const steps: string[] = [];
    class ChildA extends Component {
      static template = xml`<span><t t-esc="val()"/></span>`;
      patched() {
        steps.push("patched");
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
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    parent.state.valA = 2;
    await nextMicroTick();
    expect(steps).toEqual(["render"]);
    await nextMicroTick();
    // For an unknown reason, this test fails on windows without the next microtick. It works
    // in linux and osx, but fails on at least this machine.
    // I do not see anything harmful in waiting an extra tick. But it is annoying to not
    // know what is different.
    await nextMicroTick();
    expect(steps).toEqual(["render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    parent.state.valA = 3;
    await nextMicroTick();
    expect(steps).toEqual(["render", "render"]);
    await nextMicroTick();
    // same as above
    await nextMicroTick();
    expect(steps).toEqual(["render", "render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
    expect(steps).toEqual(["render", "render", "render", "patched"]);
  });

  test("components in a node in a t-foreach ", async () => {
    class Child extends Component {}

    class App extends Component {
      static components = { Child };

      get items() {
        return [1, 2];
      }
    }
    env.qweb.addTemplates(`
          <templates>
              <div t-name="Child"><t t-esc="props.item"/></div>
              <div t-name="App">
                  <ul>
                      <t t-foreach="items" t-as="item">
                          <li t-key="'li_'+item">
                              <Child item="item"/>
                          </li>
                      </t>
                  </ul>
              </div>
          </templates>`);

    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><ul><li><div>1</div></li><li><div>2</div></li></ul></div>"
    );
  });

  test("properly behave when destroyed/unmounted while rendering ", async () => {
    const def = makeDeferred();

    class SubChild extends Component {
      static template = xml`<div/>`;
      willPatch() {
        throw new Error("Should not happen!");
      }
      patched() {
        throw new Error("Should not happen!");
      }
      willUpdateProps() {
        return def;
      }
    }

    class Child extends Component {
      static template = xml`<div><SubChild /></div>`;
      static components = { SubChild };
    }

    class Parent extends Component {
      static template = xml`<div><t t-if="state.flag"><Child val="state.val"/></t></div>`;
      static components = { Child };
      state = useState({ flag: true, val: "Framboise Lindemans" });
    }
    const parent = new Parent();
    await parent.mount(fixture);
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
    (<any>def).resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test.skip("reuse widget if possible, in some async situation", async () => {
    // this optimization has been temporarily deactivated
    env.qweb.addTemplates(`
          <templates>
              <span t-name="ChildA">a<t t-esc="props.val"/></span>
              <span t-name="ChildB">b<t t-esc="props.val"/></span>
              <span t-name="Parent">
                  <t t-if="state.flag">
                      <ChildA val="state.valA"/>
                      <ChildB val="state.valB"/>
                  </t>
              </span>
          </templates>
      `);

    let destroyCount = 0;
    class ChildA extends Component {
      destroy() {
        destroyCount++;
        super.destroy();
      }
    }
    class ChildB extends Component {
      willStart(): any {
        return new Promise(function () {});
      }
    }
    class Parent extends Component {
      static components = { ChildA, ChildB };
      state = useState({ valA: 1, valB: 2, flag: false });
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(destroyCount).toBe(0);

    parent.state.flag = true;
    await nextTick();
    expect(destroyCount).toBe(0);

    parent.state.valB = 3;
    await nextTick();
    expect(destroyCount).toBe(0);
  });

  test("rendering component again in next microtick", async () => {
    class Child extends Component {
      static template = xml`<div t-name="Child">Child</div>`;
    }

    class App extends Component {
      static template = xml`
          <div>
            <button t-on-click="onClick">Click</button>
            <t t-if="env.flag"><Child/></t>
          </div>`;
      static components = { Child };

      async onClick() {
        (env as any).flag = true;
        this.render();
        await Promise.resolve();
        this.render();
      }
    }

    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><button>Click</button></div>");
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>Click</button><div>Child</div></div>");
  });

  test("concurrent renderings scenario 1", async () => {
    const def = makeDeferred();
    let stateB;

    class ComponentC extends Component {
      static template = xml`<span><t t-esc="props.fromA"/><t t-esc="someValue()"/></span>`;
      someValue() {
        return this.props.fromB;
      }
      willUpdateProps() {
        return def;
      }
    }
    ComponentC.prototype.someValue = jest.fn(ComponentC.prototype.someValue);

    class ComponentB extends Component {
      static components = { ComponentC };
      static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
      state = useState({ fromB: "b" });

      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
    }

    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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

    expect(ComponentC.prototype.someValue).toBeCalledTimes(2);
    expect(fixture.innerHTML).toBe("<div><p><span>2c</span></p></div>");
  });

  test("concurrent renderings scenario 2", async () => {
    // this test asserts that a rendering initiated before another one, and that
    // ends after it, is re-mapped to that second rendering
    const defs = [makeDeferred(), makeDeferred()];
    let index = 0;
    let stateB;
    class ComponentC extends Component {
      static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;
      willUpdateProps() {
        return defs[index++];
      }
    }

    class ComponentB extends Component {
      static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
      static components = { ComponentC };
      state = useState({ fromB: "b" });

      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
    }

    class ComponentA extends Component {
      static template = xml`<div><t t-esc="state.fromA"/><ComponentB fromA="state.fromA"/></div>`;
      static components = { ComponentB };
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
  });

  test("concurrent renderings scenario 2bis", async () => {
    const defs = [makeDeferred(), makeDeferred()];
    let index = 0;
    let stateB;
    class ComponentC extends Component {
      static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;
      willUpdateProps() {
        return defs[index++];
      }
    }

    class ComponentB extends Component {
      static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
      static components = { ComponentC };
      state = useState({ fromB: "b" });

      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
    }

    class ComponentA extends Component {
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      static components = { ComponentB };
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
  });

  test("concurrent renderings scenario 3", async () => {
    const defB = makeDeferred();
    const defsD = [makeDeferred(), makeDeferred()];
    let index = 0;
    let stateC;

    class ComponentD extends Component {
      static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;
      someValue() {
        return this.props.fromC;
      }
      willUpdateProps() {
        return defsD[index++];
      }
    }
    ComponentD.prototype.someValue = jest.fn(ComponentD.prototype.someValue);

    class ComponentC extends Component {
      static template = xml`<span><ComponentD fromA="props.fromA" fromC="state.fromC" /></span>`;
      static components = { ComponentD };
      state = useState({ fromC: "c" });
      constructor(parent, props) {
        super(parent, props);
        stateC = this.state;
      }
    }

    class ComponentB extends Component {
      static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
      static components = { ComponentC };

      willUpdateProps() {
        return defB;
      }
    }

    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
  });

  test("concurrent renderings scenario 4", async () => {
    const defB = makeDeferred();
    const defsD = [makeDeferred(), makeDeferred()];
    let index = 0;
    let stateC;

    class ComponentD extends Component {
      static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;
      someValue() {
        return this.props.fromC;
      }
      willUpdateProps() {
        return defsD[index++];
      }
    }
    ComponentD.prototype.someValue = jest.fn(ComponentD.prototype.someValue);

    class ComponentC extends Component {
      static template = xml`<span><ComponentD fromA="props.fromA" fromC="state.fromC" /></span>`;
      static components = { ComponentD };
      state = useState({ fromC: "c" });
      constructor(parent, props) {
        super(parent, props);
        stateC = this.state;
      }
    }

    class ComponentB extends Component {
      static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
      static components = { ComponentC };

      willUpdateProps() {
        return defB;
      }
    }

    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
  });

  test("concurrent renderings scenario 5", async () => {
    const defsB = [makeDeferred(), makeDeferred()];
    let index = 0;

    class ComponentB extends Component {
      static template = xml`<p><t t-esc="someValue()" /></p>`;
      someValue() {
        return this.props.fromA;
      }
      willUpdateProps() {
        return defsB[index++];
      }
    }
    ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
  });

  test("concurrent renderings scenario 6", async () => {
    const defsB = [makeDeferred(), makeDeferred()];
    let index = 0;

    class ComponentB extends Component {
      static template = xml`<p><t t-esc="someValue()" /></p>`;
      someValue() {
        return this.props.fromA;
      }
      willUpdateProps() {
        return defsB[index++];
      }
    }
    ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
  });

  test("concurrent renderings scenario 7", async () => {
    class ComponentB extends Component {
      static template = xml`<p><t t-esc="props.fromA" /><t t-esc="someValue()" /></p>`;
      state = useState({ fromB: "b" });
      someValue() {
        return this.state.fromB;
      }
      async willUpdateProps() {
        this.state.fromB = "c";
      }
    }
    ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><p>1b</p></div>");
    expect(ComponentB.prototype.someValue).toBeCalledTimes(1);

    component.state.fromA = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><p>2c</p></div>");
    expect(ComponentB.prototype.someValue).toBeCalledTimes(2);
  });

  test("concurrent renderings scenario 8", async () => {
    const def = makeDeferred();
    let stateB;
    class ComponentB extends Component {
      static template = xml`<p><t t-esc="props.fromA" /><t t-esc="state.fromB" /></p>`;
      state = useState({ fromB: "b" });
      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
      async willUpdateProps(nextProps) {
        return def;
      }
    }

    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
    let stateC;
    class ComponentD extends Component {
      static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromC"/></span>`;
    }
    class ComponentC extends Component {
      static template = xml`<p><ComponentD fromA="props.fromA" fromC="state.fromC" /></p>`;
      static components = { ComponentD };
      state = useState({ fromC: "b1" });

      constructor(parent, props) {
        super(parent, props);
        stateC = this.state;
      }
    }
    class ComponentB extends Component {
      static template = xml`<b><t t-esc="props.fromA"/></b>`;
      willUpdateProps() {
        return def;
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
    }

    const component = new ComponentA();
    await component.mount(fixture);

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
    let stateB;
    class ComponentC extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
      willStart() {
        return defC;
      }
    }
    ComponentC.prototype.__render = jest.fn(ComponentC.prototype.__render);
    class ComponentB extends Component {
      static template = xml`<p><ComponentC t-if="state.hasChild" value="props.value"/></p>`;
      state = useState({ hasChild: false });
      static components = { ComponentC };
      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
      willUpdateProps() {
        return defB;
      }
    }
    class ComponentA extends Component {
      static template = xml`<div><ComponentB value="state.value"/></div>`;
      static components = { ComponentB };
      state = useState({ value: 1 });
    }

    const componentA = new ComponentA();
    await componentA.mount(fixture);
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
    expect(ComponentC.prototype.__render).toHaveBeenCalledTimes(1);
  });

  test("concurrent renderings scenario 11", async () => {
    // This scenario is the following: we have a component being updated (by props),
    // and then rendered (render method), but before the willUpdateProps resolves.
    // We check that in that case, the return value of the render method is a promise
    // that is resolved when the component is completely rendered (so, properly
    // remapped to the promise of the ambient rendering)
    const def = makeDeferred();
    let child;
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/>|<t t-esc="val"/></span>`;
      val = 3;
      willUpdateProps() {
        child = this;
        return def;
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child val="state.valA"/></div>`;
      static components = { Child };
      state = useState({ valA: 1 });
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>1|3</span></div>");
    parent.state.valA = 2;

    await nextTick();
    setTimeout(() => {
      def.resolve();
    }, 20);
    child.val = 5;
    await child.render();
    expect(fixture.innerHTML).toBe("<div><span>2|5</span></div>");
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
      willUpdateProps() {
        return def;
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child val="state.val"/></div>`;
      static components = { Child };
      state = useState({ val: 1 });
    }
    Parent.prototype.__render = jest.fn(Parent.prototype.__render);

    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    expect(Parent.prototype.__render).toHaveBeenCalledTimes(1);

    parent.state.val = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    expect(Parent.prototype.__render).toHaveBeenCalledTimes(2);

    parent.state.val = 3;
    parent.state.val = 4;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    expect(Parent.prototype.__render).toHaveBeenCalledTimes(3);

    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>4</span></div>");
    expect(Parent.prototype.__render).toHaveBeenCalledTimes(3);
  });

  test("concurrent renderings scenario 13", async () => {
    let lastChild;
    class Child extends Component {
      static template = xml`<span><t t-esc="state.val"/></span>`;
      state = useState({ val: 0 });
      mounted() {
        if (lastChild) {
          lastChild.state.val = 0;
        }
        lastChild = this;
        this.state.val = 1;
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
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>0</span></div>");

    await nextTick(); // wait for changes triggered in mounted to be applied
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

    parent.state.bool = true;
    await nextTick(); // wait for this change to be applied
    await nextTick(); // wait for changes triggered in mounted to be applied
    expect(fixture.innerHTML).toBe("<div><span>0</span><span>1</span></div>");
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
      constructor(parent, props) {
        super(parent, props);
        c = this;
      }
    }
    class B extends Component {
      static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
      static components = { C };
      constructor(parent, props) {
        super(parent, props);
        b = this;
      }
      state = useState({ fromB: 2 });
    }
    class A extends Component {
      static template = xml`<p><B fromA="state.fromA"/></p>`;
      static components = { B };
      state = useState({ fromA: 1 });
    }
    const a = new A();
    await a.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

    // trigger a re-rendering of the whole tree
    a.state.fromA += 10;
    // wait enough for the whole tree to be re-rendered, but not patched yet
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

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
      constructor(parent, props) {
        super(parent, props);
        c = this;
      }
    }
    class B extends Component {
      static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
      static components = { C };
      constructor(parent, props) {
        super(parent, props);
        b = this;
      }
      state = useState({ fromB: 2 });
    }
    class A extends Component {
      static template = xml`<p><B fromA="state.fromA"/></p>`;
      static components = { B };
      state = useState({ fromA: 1 });
    }
    const a = new A();
    await a.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

    // trigger a re-rendering of the whole tree
    a.state.fromA += 10;
    // wait enough for the whole tree to be re-rendered, but not patched yet
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

    // trigger a re-rendering from C, which will remap its new fiber
    c!.state.fromC += 10;
    // trigger a re-rendering from B, which will remap its new fiber as well
    b!.state.fromB += 10;

    // simulate a flush (nothing should have changed as no fiber should have its
    // counter to 0)
    Component.scheduler.flush();
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

    // wait a bit and simulate another flush (we expect nothing to change as well)
    await nextMicroTick();
    Component.scheduler.flush();
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>11</span><span>12</span><span>13</span></p></p></p>"
    );
  });

  test("concurrent renderings scenario 16", async () => {
    expect.assertions(4);
    let b: B | undefined = undefined;
    let c: C | undefined = undefined;
    class D extends Component {
      static template = xml`<ul>DDD</ul>`;
      async willStart() {
        await nextTick();
        await nextTick();
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
      constructor(parent, props) {
        super(parent, props);
        c = this;
      }
    }
    class B extends Component {
      static template = xml`<p><C fromB="state.fromB" fromA="props.fromA"/></p>`;
      static components = { C };
      constructor(parent, props) {
        super(parent, props);
        b = this;
      }
      state = useState({ fromB: 2 });
    }
    class A extends Component {
      static template = xml`<p><B fromA="state.fromA"/></p>`;
      static components = { B };
      state = useState({ fromA: 1 });
    }
    const a = new A();
    await a.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

    // trigger a re-rendering of the whole tree
    a.state.fromA += 10;
    // wait enough for the whole tree to be re-rendered, but not patched yet
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );

    // trigger a re-rendering from C, which will remap its new fiber
    c!.state.fromC += 10;
    const prom = c!.render().then(() => {
      expect(fixture.innerHTML).toBe(
        "<p><p><p><span>11</span><span>12</span><span>13</span><ul>DDD</ul></p></p></p>"
      );
    });
    // trigger a re-rendering from B, which will remap its new fiber as well
    b!.state.fromB += 10;

    await nextTick();
    // at this point, C rendering is still pending, and nothing should have been
    // updated yet.
    expect(fixture.innerHTML).toBe(
      "<p><p><p><span>1</span><span>2</span><span>3</span></p></p></p>"
    );
    await prom;
  });

  test("concurrent renderings scenario 17", async () => {
    class Parent extends Component {
      static template = xml`<span><t t-esc="state.value"/></span>`;
      state = useState({ value: 1 });
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>1</span>");

    parent.state.value = 2;
    parent.__owl__.currentFiber!.cancel();

    parent.state.value = 3; // update value directly
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>3</span>");

    parent.state.value = 4; // update value after a tick
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>4</span>");
  });

  test("change state and call manually render: no unnecessary rendering", async () => {
    class Widget extends Component {
      static template = xml`<div><t t-esc="state.val"/></div>`;
      state = useState({ val: 1 });
    }
    Widget.prototype.__render = jest.fn(Widget.prototype.__render);

    const widget = new Widget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");
    expect(Widget.prototype.__render).toHaveBeenCalledTimes(1);

    widget.state.val = 2;
    await widget.render();
    expect(fixture.innerHTML).toBe("<div>2</div>");
    expect(Widget.prototype.__render).toHaveBeenCalledTimes(2);
  });

  test("components with shouldUpdate=false", async () => {
    const state = { p: 1, cc: 10 };

    class ChildChild extends Component {
      static template = xml`
        <div>
          child child: <t t-esc="state.cc"/>
        </div>`;
      state = state;
      shouldUpdate() {
        return false;
      }
    }

    class Child extends Component {
      static components = { ChildChild };
      static template = xml`
        <div>
          child
          <ChildChild/>
        </div>`;

      shouldUpdate() {
        return false;
      }
    }

    let parent: any;
    class Parent extends Component {
      static components = { Child };
      static template = xml`
        <div>
          parent: <t t-esc="state.p"/>
          <Child/>
        </div>`;

      state = state;
      constructor(a, b) {
        super(a, b);
        parent = this;
      }
      shouldUpdate() {
        return false;
      }
    }

    class App extends Component {
      static components = { Parent };
      static template = xml`
        <div>
          <Parent/>
        </div>`;
    }

    var div = document.createElement("div");
    fixture.appendChild(div);

    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div></div><div><div> parent: 1<div> child <div> child child: 10</div></div></div></div>"
    );
    app.mount(div);

    // wait for rendering from second mount to go through parent
    await Promise.resolve();
    await Promise.resolve();
    state.cc++;
    state.p++;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><div> parent: 2<div> child <div> child child: 11</div></div></div></div></div>"
    );
  });

  test("components with shouldUpdate=false, part 2", async () => {
    const state = { p: 1, cc: 10 };
    let shouldUpdate = true;

    class ChildChild extends Component {
      static template = xml`
        <div>
          child child: <t t-esc="state.cc"/>
        </div>`;
      state = state;
      shouldUpdate() {
        return shouldUpdate;
      }
    }

    class Child extends Component {
      static components = { ChildChild };
      static template = xml`
        <div>
          child
          <ChildChild/>
        </div>`;

      shouldUpdate() {
        return shouldUpdate;
      }
    }

    let parent: any;
    class Parent extends Component {
      static components = { Child };
      static template = xml`
        <div>
          parent: <t t-esc="state.p"/>
          <Child/>
        </div>`;

      state = state;
      constructor(a, b) {
        super(a, b);
        parent = this;
      }
      shouldUpdate() {
        return shouldUpdate;
      }
    }

    class App extends Component {
      static components = { Parent };
      static template = xml`
        <div>
          <Parent/>
        </div>`;
    }

    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div> parent: 1<div> child <div> child child: 10</div></div></div></div>"
    );

    state.cc++;
    state.p++;
    app.render();

    // wait for rendering to go through child
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    shouldUpdate = false;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div> parent: 2<div> child <div> child child: 11</div></div></div></div>"
    );
  });
});
