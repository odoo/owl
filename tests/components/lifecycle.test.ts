import { App, Component, mount, onMounted, onWillStart, useState, xml } from "../../src";
import {
  onWillPatch,
  onWillUnmount,
  onPatched,
  onWillUpdateProps,
  onWillRender,
  onWillDestroy,
  onRendered,
} from "../../src/runtime/lifecycle_hooks";
import { status } from "../../src/runtime/status";
import {
  elem,
  logStep,
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

  test("timeout in onWillStart emits a warning", async () => {
    const { warn } = console;
    let warnArgs: any[];
    console.warn = jest.fn((...args) => (warnArgs = args));
    const { setTimeout } = window;
    let timeoutCbs: any = {};
    let timeoutId = 0;
    window.setTimeout = ((cb: any) => {
      timeoutCbs[++timeoutId] = cb;
      return timeoutId;
    }) as any;
    class Test extends Component {
      static template = xml`<span/>`;
      setup() {
        onWillStart(() => new Promise(() => {}));
      }
    }
    mount(Test, fixture, { test: true });
    nextTick();
    for (const id in timeoutCbs) {
      timeoutCbs[id]();
      delete timeoutCbs[id];
    }
    await nextMicroTick();
    await nextMicroTick();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(warnArgs![0]!.message).toBe("onWillStart's promise hasn't resolved after 3 seconds");
    console.warn = warn;
    window.setTimeout = setTimeout;
  });

  test("timeout in onWillUpdateProps emits a warning", async () => {
    class Child extends Component {
      static template = xml``;
      setup() {
        onWillUpdateProps(() => new Promise(() => {}));
      }
    }
    class Parent extends Component {
      static template = xml`<Child prop="state.prop"/>`;
      static components = { Child };
      state = useState({ prop: 1 });
    }
    const parent = await mount(Parent, fixture, { test: true });

    const { warn } = console;
    let warnArgs: any[];
    console.warn = jest.fn((...args) => (warnArgs = args));
    const { setTimeout } = window;
    let timeoutCbs: any = {};
    let timeoutId = 0;
    window.setTimeout = ((cb: any) => {
      timeoutCbs[++timeoutId] = cb;
      return timeoutId;
    }) as any;

    parent.state.prop = 2;
    let tick = nextTick();
    for (const id in timeoutCbs) {
      timeoutCbs[id]();
      delete timeoutCbs[id];
    }
    await tick;
    tick = nextTick();
    for (const id in timeoutCbs) {
      timeoutCbs[id]();
      delete timeoutCbs[id];
    }
    await tick;
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(warnArgs![0]!.message).toBe(
      "onWillUpdateProps's promise hasn't resolved after 3 seconds"
    );
    console.warn = warn;
    window.setTimeout = setTimeout;
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

    parent.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Child:willUpdateProps",
        "Parent:rendered",
        "Child:willRender",
        "Child:rendered",
        "Parent:willPatch",
        "Child:willPatch",
        "Child:patched",
        "Parent:patched",
      ]
    `);

    parent.toggleSubWidget();
    await nextTick();
    expect(fixture.innerHTML).toBe("");
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

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willUnmount",
        "Child:willUnmount",
        "Child:willDestroy",
        "Parent:willDestroy",
      ]
    `);
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

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willUnmount",
        "Child:willUnmount",
        "Child:willDestroy",
        "Parent:willDestroy",
      ]
    `);
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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Parent:rendered",
        "Parent:mounted",
      ]
    `);

    parent.state.hasChild = true;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
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
      ]
    `);

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willUnmount",
        "Child:willUnmount",
        "GrandChild:willUnmount",
        "GrandChild:willDestroy",
        "Child:willDestroy",
        "Parent:willDestroy",
      ]
    `);
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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Parent:rendered",
        "Parent:mounted",
      ]
    `);

    parent.state.hasChild = true;
    // immediately destroy everything
    app.destroy();
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willUnmount",
        "Parent:willDestroy",
      ]
    `);
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

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Parent:rendered",
        "Parent:mounted",
      ]
    `);

    parent.state.hasChild = true;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Child:setup",
        "Child:willStart",
        "Parent:rendered",
        "Child:willRender",
        "GrandChild:setup",
        "GrandChild:willStart",
        "Child:rendered",
      ]
    `);

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willUnmount",
        "GrandChild:willDestroy",
        "Child:willDestroy",
        "Parent:willDestroy",
      ]
    `);
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

    parent.state.hasChild = false;
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

    parent.state.value = 2;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Child:willUpdateProps",
        "Parent:rendered",
        "Child:willRender",
        "Child:rendered",
        "Parent:willPatch",
        "Child:willPatch",
        "Child:patched",
        "Parent:patched",
      ]
    `);
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
        <Child someValue="state.value" />`;
      static components = { Child };
      state = useState({ value: 1 });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<button>1</button>");
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

    parent.state.value++; // to block child render
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Child:willUpdateProps",
        "Parent:rendered",
      ]
    `);

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`Array []`);

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`Array []`);
    expect(fixture.innerHTML).toBe("<button>1</button>");

    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>3</button>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Child:willRender",
        "Child:rendered",
        "Parent:willPatch",
        "Child:willPatch",
        "Child:patched",
        "Parent:patched",
      ]
    `);
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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
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
      ]
    `);

    // update
    c!.state.flag = false;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "C:willRender",
        "F:setup",
        "F:willStart",
        "C:rendered",
        "F:willRender",
        "F:rendered",
        "C:willPatch",
        "E:willUnmount",
        "E:willDestroy",
        "F:mounted",
        "C:patched",
      ]
    `);
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

    parent.state.hasChild = false;
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

    parent.state.hasChild = true;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Child:setup",
        "Child:willStart",
        "Parent:rendered",
        "Child:willRender",
        "Child:rendered",
        "Parent:willPatch",
        "Child:mounted",
        "Parent:patched",
      ]
    `);
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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Parent:rendered",
        "Parent:mounted",
        "Parent:willRender",
        "Parent:rendered",
      ]
    `);

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Parent:rendered",
        "Parent:mounted",
      ]
    `);

    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Parent:rendered",
        "Parent:willPatch",
        "Parent:patched",
        "Parent:willRender",
        "Parent:rendered",
      ]
    `);

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Parent:rendered",
        "Parent:mounted",
      ]
    `);

    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Parent:rendered",
        "Parent:willPatch",
        "Parent:patched",
        "Parent:willRender",
        "Parent:rendered",
      ]
    `);

    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
  });

  test("lifecycle callbacks are bound to component", async () => {
    expect.assertions(14);
    let instance: any;

    class Test extends Component {
      static template = xml`<t t-esc="props.rev" />`;
      setup() {
        instance = this;
        onWillStart(this.logger("onWillStart"));
        onMounted(this.logger("onMounted"));
        onWillUpdateProps(this.logger("onWillUpdateProps"));
        onWillPatch(this.logger("onWillPatch"));
        onPatched(this.logger("onPatched"));
        onWillUnmount(this.logger("onWillUnmount"));
        onWillDestroy(this.logger("onWillDestroy"));
        onWillRender(this.logger("onWillRender"));
        onRendered(this.logger("onRendered"));
      }
      logger(hookName: string) {
        return function (this: Test) {
          logStep(hookName);
          expect(this === instance).toBe(true);
        };
      }
    }

    class Parent extends Component {
      static template = xml`<Test rev="rev" />`;
      static components = { Test };
      rev = 0;
    }

    const app = new App(Parent);
    const comp = await app.mount(fixture);
    comp.rev++;
    comp.render();
    await nextTick();
    app.destroy();

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "onWillStart",
        "onWillRender",
        "onRendered",
        "onMounted",
        "onWillUpdateProps",
        "onWillRender",
        "onRendered",
        "onWillPatch",
        "onPatched",
        "onWillUnmount",
        "onWillDestroy",
      ]
    `);
  });

  test("destroy new children before being mountged", async () => {
    class Child extends Component {
      static template = xml`child`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`before<Child t-if="state.flag"/>after`;
      static components = { Child };

      state = useState({ flag: false });
      setup() {
        useLogLifecycle();
        onRendered(async () => {
          // we destroy here the app after the new child component has been
          // created, but before this rendering has been patched to the DOM
          if (this.state.flag) {
            await Promise.resolve();
            app.destroy();
          }
        });
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);
    expect(fixture.innerHTML).toBe("beforeafter");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:setup",
        "Parent:willStart",
        "Parent:willRender",
        "Parent:rendered",
        "Parent:mounted",
      ]
    `);

    parent.state.flag = true;

    await nextTick();
    expect(fixture.innerHTML).toBe("");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Parent:willRender",
        "Child:setup",
        "Child:willStart",
        "Parent:rendered",
        "Parent:willUnmount",
        "Child:willDestroy",
        "Parent:willDestroy",
      ]
    `);
  });
});
