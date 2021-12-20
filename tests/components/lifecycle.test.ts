import { App, Component, mount, onMounted, onWillStart, useState } from "../../src";
import {
  onWillPatch,
  onWillUnmount,
  onPatched,
  onWillUpdateProps,
  onWillRender,
} from "../../src/component/lifecycle_hooks";
import { status } from "../../src/component/status";
import { xml } from "../../src/tags";
import {
  elem,
  makeDeferred,
  makeTestFixture,
  nextTick,
  snapshotEverything,
  useLogLifecycle,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();
beforeEach(() => {
  fixture = makeTestFixture();
});

describe("lifecycle hooks", () => {
  test("basic checks for a component", async () => {
    expect.assertions(6); // 1 for snapshots
    class Test extends Component {
      static template = xml`<span>test</span>`;

      setup() {
        expect(status(this)).toBe("new");
      }
    }

    const app = new App(Test);

    const component = await app.mount(fixture);

    expect(fixture.innerHTML).toBe("<span>test</span>");
    expect(status(component)).toBe("mounted");

    app.destroy();

    expect(fixture.innerHTML).toBe("");
    expect(status(component)).toBe("destroyed");
  });

  test("willStart is called", async () => {
    let willstart = false;
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        onWillStart(() => {
          willstart = true;
        });
      }
    }

    await mount(Test, fixture);
    expect(willstart).toBe(true);
  });

  test("willStart hook is called on sub component", async () => {
    let ok = false;
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        onWillStart(() => {
          ok = true;
        });
      }
    }

    class Parent extends Component {
      static template = xml`<Child />`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(ok).toBe(true);
  });

  test("willStart is called with component as this", async () => {
    expect.assertions(3);
    let comp: any;

    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        comp = this;
        onWillStart(this.willStart);
      }

      willStart() {
        expect(this).toBeInstanceOf(Test);
        expect(this).toBe(comp);
      }
    }

    await mount(Test, fixture);
  });

  test("mounted hook is called if mounted in DOM", async () => {
    let mounted = false;
    class Test extends Component {
      static template = xml`<div/>`;

      setup() {
        onMounted(() => {
          mounted = true;
        });
      }
    }
    await mount(Test, fixture);
    expect(mounted).toBe(true);
  });

  test("mounted hook is called on subcomponents, in proper order", async () => {
    const steps: any[] = [];

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        onMounted(() => {
          expect(document.body.contains(elem(this))).toBe(true);
          steps.push("child:mounted");
        });
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child /></div>`;
      static components = { Child };
      setup() {
        onMounted(() => {
          steps.push("parent:mounted");
        });
      }
    }
    await mount(Parent, fixture);
    expect(steps).toEqual(["child:mounted", "parent:mounted"]);
    Object.freeze(steps);
  });

  test("mounted hook is called on subsubcomponents, in proper order", async () => {
    const steps: any[] = [];

    class ChildChild extends Component {
      static template = xml`<div/>`;
      setup() {
        onMounted(() => {
          steps.push("childchild:mounted");
        });
        onWillUnmount(() => {
          steps.push("childchild:willUnmount");
        });
      }
    }

    class Child extends Component {
      static template = xml`<div><ChildChild /></div>`;
      static components = { ChildChild };
      setup() {
        onMounted(() => {
          steps.push("child:mounted");
        });
        onWillUnmount(() => {
          steps.push("child:willUnmount");
        });
      }
    }

    class Parent extends Component {
      static template = xml`<div><t t-if="state.flag"><Child/></t></div>`;
      static components = { Child };
      state = useState({ flag: false });
      setup() {
        onMounted(() => {
          steps.push("parent:mounted");
        });
        onWillUnmount(() => {
          steps.push("parent:willUnmount");
        });
      }
    }

    const app = new App(Parent);
    const widget = await app.mount(fixture);
    expect(steps).toEqual(["parent:mounted"]);
    widget.state.flag = true;
    await nextTick();
    app.destroy();
    expect(steps).toEqual([
      "parent:mounted",
      "childchild:mounted",
      "child:mounted",
      "parent:willUnmount",
      "child:willUnmount",
      "childchild:willUnmount",
    ]);
    Object.freeze(steps);
  });

  test("willPatch, patched hook are called on subsubcomponents, in proper order", async () => {
    const steps: any[] = [];

    class ChildChild extends Component {
      static template = xml`
        <div><t t-esc="props.n"/></div>
      `;

      setup() {
        onWillPatch(() => {
          steps.push("childchild:willPatch");
        });
        onPatched(() => {
          steps.push("childchild:patched");
        });
      }
    }

    class Child extends Component {
      static template = xml`
        <div><ChildChild n="props.n"/></div>
      `;
      static components = { ChildChild };

      setup() {
        onWillPatch(() => {
          steps.push("child:willPatch");
        });
        onPatched(() => {
          steps.push("child:patched");
        });
      }
    }

    class Parent extends Component {
      static template = xml`
        <div><Child n="state.n"/></div>
      `;
      static components = { Child };

      state = useState({ n: 1 });

      setup() {
        onWillPatch(() => {
          steps.push("parent:willPatch");
        });
        onPatched(() => {
          steps.push("parent:patched");
        });
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);
    expect(steps).toEqual([]);
    parent.state.n = 2;
    await nextTick();
    app.destroy();
    expect(steps).toEqual([
      "parent:willPatch",
      "child:willPatch",
      "childchild:willPatch",
      "childchild:patched",
      "child:patched",
      "parent:patched",
    ]);
    Object.freeze(steps);
  });

  test("willStart, mounted on subwidget rendered after main is mounted in some other position", async () => {
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<div/>`;

      setup() {
        onWillStart(() => {
          steps.push("child:willStart");
        });
        onMounted(() => {
          steps.push("child:mounted");
        });
      }
    }

    class Parent extends Component {
      // the t-else part in the template is important. This is
      // necessary to have a situation that could confuse the vdom
      // patching algorithm
      static template = xml`
        <div>
          <t t-if="state.ok">
            <Child />
          </t>
          <t t-else="">
            <div/>
          </t>
        </div>`;

      static components = { Child };
      state = useState({ ok: false });
    }
    const parent = await mount(Parent, fixture);
    expect(steps).toEqual([]);
    parent.state.ok = true;
    await nextTick();
    expect(steps).toEqual(["child:willStart", "child:mounted"]);
    Object.freeze(steps);
    Object.freeze(steps);
  });

  test("components are unmounted destroyed if no longer in DOM", async () => {
    let steps: string[] = [];

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        steps.push("setup");
        onWillStart(() => {
          steps.push("willstart");
        });
        onMounted(() => {
          steps.push("mounted");
        });
        onWillUnmount(() => {
          steps.push("willunmount");
        });
      }
    }
    class Parent extends Component {
      static template = xml`<t t-if="state.ok"><Child /></t>`;
      static components = { Child };
      state = useState({ ok: true });
    }

    const parent = await mount(Parent, fixture);
    expect(steps).toEqual(["setup", "willstart", "mounted"]);
    parent.state.ok = false;
    await nextTick();
    expect(steps).toEqual(["setup", "willstart", "mounted", "willunmount"]);
    Object.freeze(steps);
  });

  test("components are unmounted and destroyed if no longer in DOM, even after updateprops", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.n"/></span>`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`
          <div t-if="state.flag">
            <Child n="state.n"/>
          </div>
      `;
      static components = { Child };
      setup() {
        useLogLifecycle();
      }
      state = useState({ n: 0, flag: true });
      increment() {
        this.state.n += 1;
      }
      toggleSubWidget() {
        this.state.flag = !this.state.flag;
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
    ]).toBeLogged();

    parent.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
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

    parent.toggleSubWidget();
    await nextTick();
    expect(fixture.innerHTML).toBe("");
    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Parent:willPatch",
      "Child:willUnmount",
      "Child:willDestroy",
      "Parent:patched",
    ]).toBeLogged();
  });

  test("hooks are called in proper order in widget creation/destruction", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App(Parent);
    await app.mount(fixture);
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

    app.destroy();
    expect([
      "Parent:willUnmount",
      "Child:willUnmount",
      "Child:willDestroy",
      "Parent:willDestroy",
    ]).toBeLogged();
  });

  test("willUpdateProps hook is called", async () => {
    let def = makeDeferred();

    class Child extends Component {
      static template = xml`<span><t t-esc="props.n"/></span>`;

      setup() {
        onWillUpdateProps((nextProps) => {
          expect(nextProps.n).toBe(2);
          return def;
        });
      }
    }

    class Parent extends Component {
      static template = xml`<Child n="state.n"/>`;
      static components = { Child };
      state = useState({ n: 1 });
    }
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<span>1</span>");
    parent.state.n = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>1</span>");
    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>2</span>");
  });

  test("patched hook is called after updating State", async () => {
    let n = 0;

    class Test extends Component {
      static template = xml`<div><t t-esc="state.a"/></div>`;
      state = useState({ a: 1 });

      setup() {
        onPatched(() => n++);
      }
    }
    const widget = await mount(Test, fixture);
    expect(n).toBe(0);

    widget.state.a = 1; // empty update, should do nothing
    await nextTick();
    expect(n).toBe(0);

    widget.state.a = 3;
    await nextTick();
    expect(n).toBe(1);
  });

  test("patched hook is called after updateProps", async () => {
    let n = 0;

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        onWillUpdateProps(() => {
          n++;
        });
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child a="state.a"/></div>`;
      state = useState({ a: 1 });
      static components = { Child };
    }

    const widget = await mount(Parent, fixture);
    expect(n).toBe(0);

    widget.state.a = 2;
    await nextTick();
    expect(n).toBe(1);
  });

  test("lifecycle semantics", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle();
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child a="state.a"/></div>`;
      static components = { Child };
      state = useState({ a: 1 });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App(Parent);
    await app.mount(fixture);
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

    app.destroy();
    expect([
      "Parent:willUnmount",
      "Child:willUnmount",
      "Child:willDestroy",
      "Parent:willDestroy",
    ]).toBeLogged();
  });

  test("lifecycle semantics, part 2", async () => {
    class GrandChild extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle();
      }
    }
    class Child extends Component {
      static template = xml`<GrandChild/>`;
      static components = { GrandChild };
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Parent:rendered",
      "Parent:mounted",
    ]).toBeLogged();

    parent.state.hasChild = true;
    await nextTick();
    expect([
      "Parent:willRender",
      "Child:setup",
      "Child:willStart",
      "Parent:rendered",
      "Child:willRender",
      "GrandChild:setup",
      "GrandChild:willStart",
      "Child:rendered",
      "GrandChild:willRender",
      "GrandChild:rendered",
      "Parent:willPatch",
      "GrandChild:mounted",
      "Child:mounted",
      "Parent:patched",
    ]).toBeLogged();

    app.destroy();
    expect([
      "Parent:willUnmount",
      "Child:willUnmount",
      "GrandChild:willUnmount",
      "GrandChild:willDestroy",
      "Child:willDestroy",
      "Parent:willDestroy",
    ]).toBeLogged();
  });

  test("lifecycle semantics, part 3", async () => {
    class GrandChild extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle();
      }
    }
    class Child extends Component {
      static template = xml`<GrandChild/>`;
      static components = { GrandChild };
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Parent:rendered",
      "Parent:mounted",
    ]).toBeLogged();

    parent.state.hasChild = true;
    // immediately destroy everything
    app.destroy();
    await nextTick();
    expect(["Parent:willUnmount", "Parent:willDestroy"]).toBeLogged();
  });

  test("lifecycle semantics, part 4", async () => {
    let def = makeDeferred();

    class GrandChild extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle();
        onWillStart(() => def);
      }
    }
    class Child extends Component {
      static template = xml`<GrandChild/>`;
      static components = { GrandChild };
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);

    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Parent:rendered",
      "Parent:mounted",
    ]).toBeLogged();

    parent.state.hasChild = true;
    await nextTick();
    expect([
      "Parent:willRender",
      "Child:setup",
      "Child:willStart",
      "Parent:rendered",
      "Child:willRender",
      "GrandChild:setup",
      "GrandChild:willStart",
      "Child:rendered",
    ]).toBeLogged();

    app.destroy();
    expect([
      "Parent:willUnmount",
      "GrandChild:willDestroy",
      "Child:willDestroy",
      "Parent:willDestroy",
    ]).toBeLogged();
  });

  test("lifecycle semantics, part 5", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: true });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
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

    parent.state.hasChild = false;
    await nextTick();
    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Parent:willPatch",
      "Child:willUnmount",
      "Child:willDestroy",
      "Parent:patched",
    ]).toBeLogged();
  });

  test("lifecycle semantics, part 6", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<Child value="state.value" />`;
      static components = { Child };
      state = useState({ value: 1 });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
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
    await nextTick();
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

  test("onWillRender", async () => {
    const def = makeDeferred();

    class Child extends Component {
      static template = xml`<button t-on-click="increment"><t t-esc="state.value"/></button>`;
      state = useState({ value: 1 });
      visibleState = this.state.value;
      setup() {
        useLogLifecycle();
        onWillUpdateProps(() => def);
        onWillRender(() => (this.visibleState = this.state.value));
      }
      increment() {
        this.state.value++;
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child />`;
      static components = { Child };
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<button>1</button>");
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

    parent.render(); // to block child render
    await nextTick();
    expect(["Parent:willRender", "Child:willUpdateProps", "Parent:rendered"]).toBeLogged();

    fixture.querySelector("button")!.click();
    await nextTick();
    expect([]).toBeLogged();

    fixture.querySelector("button")!.click();
    await nextTick();
    expect([]).toBeLogged();
    expect(fixture.innerHTML).toBe("<button>1</button>");

    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>3</button>");
    expect([
      "Child:willRender",
      "Child:rendered",
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]).toBeLogged();
  });

  // TODO: rename (remove? seems covered by lifecycle semantics)
  test("sub widget (inside sub node): hooks are correctly called", async () => {
    let created = false;
    let mounted = false;

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        created = true;
        onMounted(() => {
          mounted = true;
        });
      }
    }
    class Parent extends Component {
      static template = xml`<Child t-if="state.flag"/>`;
      static components = { Child };
      state = useState({ flag: false });
    }
    const parent = await mount(Parent, fixture);
    expect(created).toBe(false);
    expect(mounted).toBe(false);

    parent.state.flag = true;
    await nextTick();
    expect(mounted).toBe(true);
    expect(created).toBe(true);
  });

  // TODO: rename (corresponds to https://github.com/odoo/owl/blob/master/doc/reference/concurrency_model.md#semantics)
  test("component semantics", async () => {
    class TestWidget extends Component {
      name: string = "test";
      setup() {
        useLogLifecycle();
      }
    }
    class B extends TestWidget {
      static template = xml`<div>B</div>`;
      name = "B";
    }
    class D extends TestWidget {
      static template = xml`<div>D</div>`;
      name = "D";
    }
    class E extends TestWidget {
      static template = xml`<div>E</div>`;
      name = "E";
    }

    class F extends TestWidget {
      static template = xml`<div>F</div>`;
      name = "F";
    }
    let c: C;
    class C extends TestWidget {
      static template = xml`
        <div>C<D />
          <E t-if="state.flag" />
          <F t-else="!state.flag" />
        </div>`;
      static components = { D, E, F };
      name = "C";
      state = useState({ flag: true });

      setup() {
        c = this;
        super.setup();
      }
    }
    class A extends TestWidget {
      static template = xml`<div>A<B /><C /></div>`;
      static components = { B, C };
      name = "A";
    }

    await mount(A, fixture);
    expect(fixture.innerHTML).toBe(`<div>A<div>B</div><div>C<div>D</div><div>E</div></div></div>`);
    expect([
      "A:setup",
      "A:willStart",
      "A:willRender",
      "B:setup",
      "B:willStart",
      "C:setup",
      "C:willStart",
      "A:rendered",
      "B:willRender",
      "B:rendered",
      "C:willRender",
      "D:setup",
      "D:willStart",
      "E:setup",
      "E:willStart",
      "C:rendered",
      "D:willRender",
      "D:rendered",
      "E:willRender",
      "E:rendered",
      "E:mounted",
      "D:mounted",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]).toBeLogged();

    // update
    c!.state.flag = false;
    await nextTick();
    expect([
      "C:willRender",
      "D:willUpdateProps",
      "F:setup",
      "F:willStart",
      "C:rendered",
      "D:willRender",
      "D:rendered",
      "F:willRender",
      "F:rendered",
      "C:willPatch",
      "D:willPatch",
      "E:willUnmount",
      "E:willDestroy",
      "F:mounted",
      "D:patched",
      "C:patched",
    ]).toBeLogged();
  });

  test("mounted hook is called on every mount, not just the first one", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: true });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
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

    parent.state.hasChild = false;
    await nextTick();
    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Parent:willPatch",
      "Child:willUnmount",
      "Child:willDestroy",
      "Parent:patched",
    ]).toBeLogged();

    parent.state.hasChild = true;
    await nextTick();
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
    ]).toBeLogged();
  });

  test("render in mounted", async () => {
    class Parent extends Component {
      static template = xml`<span t-esc="patched"/>`;
      patched: any;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          this.patched = "Patched";
          this.render();
        });
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span></span>");
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Parent:rendered",
      "Parent:mounted",
      "Parent:willRender",
      "Parent:rendered",
    ]).toBeLogged();

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
    expect(["Parent:willPatch", "Parent:patched"]).toBeLogged();
  });

  test("render in patched", async () => {
    class Parent extends Component {
      static template = xml`<span t-esc="patched"/>`;
      patched: any;
      setup() {
        useLogLifecycle();
        onPatched(() => {
          if (this.patched === "Patched") {
            return;
          }
          this.patched = "Patched";
          this.render();
        });
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span></span>");
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Parent:rendered",
      "Parent:mounted",
    ]).toBeLogged();

    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");
    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Parent:willPatch",
      "Parent:patched",
      "Parent:willRender",
      "Parent:rendered",
    ]).toBeLogged();

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
    expect(["Parent:willPatch", "Parent:patched"]).toBeLogged();
  });

  test("render in willPatch", async () => {
    class Parent extends Component {
      static template = xml`<span t-esc="patched"/>`;
      patched: any;
      setup() {
        useLogLifecycle();
        onWillPatch(() => {
          if (this.patched === "Patched") {
            return;
          }
          this.patched = "Patched";
          this.render();
        });
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span></span>");
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Parent:rendered",
      "Parent:mounted",
    ]).toBeLogged();

    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");

    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Parent:willPatch",
      "Parent:patched",
      "Parent:willRender",
      "Parent:rendered",
    ]).toBeLogged();

    await nextTick();
    expect(["Parent:willPatch", "Parent:patched"]).toBeLogged();
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
  });
});
