import {
  App,
  Component,
  mount,
  proxy,
  xml,
  onWillPatch,
  onWillUnmount,
  onPatched,
  onWillUpdateProps,
  onWillDestroy,
  onMounted,
  onWillStart,
  props,
} from "../../src";
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
  render,
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
      status = status();

      setup() {
        expect(this.status()).toBe("new");
      }
    }

    const app = new App();

    const component = await app.createRoot(Test).mount(fixture);

    expect(fixture.innerHTML).toBe("<span>test</span>");
    expect(component.status()).toBe("mounted");

    app.destroy();

    expect(fixture.innerHTML).toBe("");
    expect(component.status()).toBe("destroyed");
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

  test.skip("timeout in onWillStart emits a console log", async () => {
    const { log } = console;
    let logArgs: any[];
    console.log = jest.fn((...args) => (logArgs = args));
    const { setTimeout } = window;
    let timeoutCbs: any = {};
    let timeoutId = 0;
    window.setTimeout = ((cb: any) => {
      timeoutCbs[++timeoutId] = cb;
      return timeoutId;
    }) as any;
    try {
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
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(logArgs![0]!.message).toBe("onWillStart's promise hasn't resolved after 3 seconds");
    } finally {
      console.log = log;
      window.setTimeout = setTimeout;
    }
  });

  test("timeout in onWillStart doesn't emit a console log if app is destroyed", async () => {
    const { log } = console;
    console.log = jest.fn();
    const { setTimeout } = window;
    let timeoutCbs: any = {};
    let timeoutId = 0;
    window.setTimeout = ((cb: any) => {
      timeoutCbs[++timeoutId] = cb;
      return timeoutId;
    }) as any;
    try {
      class Test extends Component {
        static template = xml`<span/>`;
        setup() {
          onWillStart(() => new Promise(() => {}));
        }
      }
      const app = new App({ test: true });
      app.createRoot(Test).mount(fixture);
      app.destroy();
      for (const id in timeoutCbs) {
        timeoutCbs[id]();
        delete timeoutCbs[id];
      }
      await nextMicroTick();
      await nextMicroTick();
      expect(console.log).toHaveBeenCalledTimes(0);
    } finally {
      console.log = log;
      window.setTimeout = setTimeout;
    }
  });

  test.skip("timeout in onWillUpdateProps emits a console log", async () => {
    class Child extends Component {
      static template = xml``;
      setup() {
        onWillUpdateProps(() => new Promise(() => {}));
      }
    }
    class Parent extends Component {
      static template = xml`<Child prop="this.state.prop"/>`;
      static components = { Child };
      state = proxy({ prop: 1 });
    }
    const parent = await mount(Parent, fixture, { test: true });

    const { log } = console;
    let logArgs: any[];
    console.log = jest.fn((...args) => (logArgs = args));
    const { setTimeout } = window;
    let timeoutCbs: any = {};
    let timeoutId = 0;
    window.setTimeout = ((cb: any) => {
      timeoutCbs[++timeoutId] = cb;
      return timeoutId;
    }) as any;

    try {
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
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(logArgs![0]!.message).toBe(
        "onWillUpdateProps's promise hasn't resolved after 3 seconds"
      );
    } finally {
      console.log = log;
      window.setTimeout = setTimeout;
    }
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

  test("mounted, willunmount, willdestroy hook, same component, in proper order", async () => {
    let steps: any[] = [];

    class Parent extends Component {
      static template = xml`<div></div>`;
      setup() {
        onMounted(() => {
          steps.push("parent:mounted1");
        });
        onMounted(() => {
          steps.push("parent:mounted2");
        });
        onWillUnmount(() => {
          steps.push("parent:willunmount1");
        });
        onWillUnmount(() => {
          steps.push("parent:willunmount2");
        });
        onWillDestroy(() => {
          steps.push("parent:willDestroy1");
        });
        onWillDestroy(() => {
          steps.push("parent:willDestroy2");
        });
      }
    }

    const app = new App();
    await app.createRoot(Parent).mount(fixture);
    expect(steps).toEqual(["parent:mounted1", "parent:mounted2"]);
    steps.length = 0;
    app.destroy();
    expect(steps).toEqual([
      "parent:willunmount2",
      "parent:willunmount1",
      "parent:willDestroy2",
      "parent:willDestroy1",
    ]);
    Object.freeze(steps);
  });

  test("various hooks are called on subsubcomponents, in proper order", async () => {
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
        onWillDestroy(() => {
          steps.push("childchild:willDestroy");
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
        onWillDestroy(() => {
          steps.push("child:willDestroy");
        });
      }
    }

    class Parent extends Component {
      static template = xml`<div><t t-if="this.state.flag"><Child/></t></div>`;
      static components = { Child };
      state = proxy({ flag: false });
      setup() {
        onMounted(() => {
          steps.push("parent:mounted");
        });
        onWillUnmount(() => {
          steps.push("parent:willUnmount");
        });
        onWillDestroy(() => {
          steps.push("parent:willDestroy");
        });
      }
    }

    const app = new App();
    const widget = await app.createRoot(Parent).mount(fixture);
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
      "childchild:willDestroy",
      "child:willDestroy",
      "parent:willDestroy",
    ]);
    Object.freeze(steps);
  });

  test("willPatch, patched hook are called on subsubcomponents, in proper order", async () => {
    const steps: any[] = [];

    class ChildChild extends Component {
      static template = xml`
        <div><t t-out="this.props.n"/></div>
      `;
      props = props();

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
        <div><ChildChild n="this.props.n"/></div>
      `;
      static components = { ChildChild };
      props = props();

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
        <div><Child n="this.state.n"/></div>
      `;
      static components = { Child };

      state = proxy({ n: 1 });

      setup() {
        onWillPatch(() => {
          steps.push("parent:willPatch");
        });
        onPatched(() => {
          steps.push("parent:patched");
        });
      }
    }

    const app = new App();
    const parent = await app.createRoot(Parent).mount(fixture);
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
          <t t-if="this.state.ok">
            <Child />
          </t>
          <t t-else="">
            <div/>
          </t>
        </div>`;

      static components = { Child };
      state = proxy({ ok: false });
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
      static template = xml`<t t-if="this.state.ok"><Child /></t>`;
      static components = { Child };
      state = proxy({ ok: true });
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
      static template = xml`<span><t t-out="this.props.n"/></span>`;
      props = props();
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`
          <div t-if="this.state.flag">
            <Child n="this.state.n"/>
          </div>
      `;
      static components = { Child };
      setup() {
        useLogLifecycle();
      }
      state = proxy({ n: 0, flag: true });
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
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);

    parent.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:willUpdateProps",
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
      [
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

    const app = new App();
    await app.createRoot(Parent).mount(fixture);
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

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
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
      static template = xml`<span><t t-out="this.props.n"/></span>`;
      props = props();

      setup() {
        onWillUpdateProps((nextProps) => {
          expect(nextProps.n).toBe(2);
          return def;
        });
      }
    }

    class Parent extends Component {
      static template = xml`<Child n="this.state.n"/>`;
      static components = { Child };
      state = proxy({ n: 1 });
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
      static template = xml`<div><t t-out="this.state.a"/></div>`;
      state = proxy({ a: 1 });

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
      static template = xml`<div><Child a="this.state.a"/></div>`;
      state = proxy({ a: 1 });
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
      static template = xml`<div><Child a="this.state.a"/></div>`;
      static components = { Child };
      state = proxy({ a: 1 });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App();
    await app.createRoot(Parent).mount(fixture);
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

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
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
      static template = xml`<Child t-if="this.state.hasChild"/>`;
      static components = { Child };
      state = proxy({ hasChild: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App();
    const parent = await app.createRoot(Parent).mount(fixture);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    parent.state.hasChild = true;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:setup",
        "Child:willStart",
        "GrandChild:setup",
        "GrandChild:willStart",
        "Parent:willPatch",
        "GrandChild:mounted",
        "Child:mounted",
        "Parent:patched",
      ]
    `);

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
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
      static template = xml`<Child t-if="this.state.hasChild"/>`;
      static components = { Child };
      state = proxy({ hasChild: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App();
    const parent = await app.createRoot(Parent).mount(fixture);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    parent.state.hasChild = true;
    // immediately destroy everything
    app.destroy();
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
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
      static template = xml`<Child t-if="this.state.hasChild"/>`;
      static components = { Child };
      state = proxy({ hasChild: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App();
    const parent = await app.createRoot(Parent).mount(fixture);

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    parent.state.hasChild = true;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:setup",
        "Child:willStart",
        "GrandChild:setup",
        "GrandChild:willStart",
      ]
    `);

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
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
      static template = xml`<Child t-if="this.state.hasChild"/>`;
      static components = { Child };
      state = proxy({ hasChild: true });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
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

    parent.state.hasChild = false;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
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
      static template = xml`<Child value="this.state.value" />`;
      static components = { Child };
      state = proxy({ value: 1 });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
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
    await nextTick();
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
      static template = xml`<Child t-if="this.state.flag"/>`;
      static components = { Child };
      state = proxy({ flag: false });
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
          <E t-if="this.state.flag" />
          <F t-else="!this.state.flag" />
        </div>`;
      static components = { D, E, F };
      name = "C";
      state = proxy({ flag: true });

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
      [
        "A:setup",
        "A:willStart",
        "B:setup",
        "B:willStart",
        "C:setup",
        "C:willStart",
        "D:setup",
        "D:willStart",
        "E:setup",
        "E:willStart",
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
      [
        "F:setup",
        "F:willStart",
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
      static template = xml`<Child t-if="this.state.hasChild"/>`;
      static components = { Child };
      state = proxy({ hasChild: true });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
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

    parent.state.hasChild = false;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Child:willUnmount",
        "Child:willDestroy",
        "Parent:patched",
      ]
    `);

    parent.state.hasChild = true;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:setup",
        "Child:willStart",
        "Parent:willPatch",
        "Child:mounted",
        "Parent:patched",
      ]
    `);
  });

  test("render in mounted", async () => {
    class Parent extends Component {
      static template = xml`<span t-out="this.patched"/>`;
      patched: any;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          this.patched = "Patched";
          render(this);
        });
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span></span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
  });

  test("render in patched", async () => {
    class Parent extends Component {
      static template = xml`<span t-out="this.patched"/>`;
      patched: any;
      setup() {
        useLogLifecycle();
        onPatched(() => {
          if (this.patched === "Patched") {
            return;
          }
          this.patched = "Patched";
          render(this);
        });
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span></span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    render(parent);
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
  });

  test("render in willPatch", async () => {
    class Parent extends Component {
      static template = xml`<span t-out="this.patched"/>`;
      patched: any;
      setup() {
        useLogLifecycle();
        onWillPatch(() => {
          if (this.patched === "Patched") {
            return;
          }
          this.patched = "Patched";
          render(this);
        });
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span></span>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    render(parent);
    await nextTick();
    expect(fixture.innerHTML).toBe("<span></span>");

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);

    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
    expect(fixture.innerHTML).toBe("<span>Patched</span>");
  });

  test("lifecycle callbacks are bound to component", async () => {
    expect.assertions(10);
    let instance: any;

    class Test extends Component {
      static template = xml`<t t-out="this.props.rev" />`;
      props = props();
      setup() {
        instance = this;
        onWillStart(this.logger("onWillStart"));
        onMounted(this.logger("onMounted"));
        onWillUpdateProps(this.logger("onWillUpdateProps"));
        onWillPatch(this.logger("onWillPatch"));
        onPatched(this.logger("onPatched"));
        onWillUnmount(this.logger("onWillUnmount"));
        onWillDestroy(this.logger("onWillDestroy"));
      }
      logger(hookName: string) {
        return function (this: Test) {
          logStep(hookName);
          expect(this === instance).toBe(true);
        };
      }
    }

    class Parent extends Component {
      static template = xml`<Test rev="this.rev" />`;
      static components = { Test };
      rev = 0;
    }

    const app = new App();
    const comp = await app.createRoot(Parent).mount(fixture);
    comp.rev++;
    render(comp);
    await nextTick();
    app.destroy();

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "onWillStart",
        "onMounted",
        "onWillUpdateProps",
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
      static template = xml`before<Child t-if="this.state.flag"/>after<t t-set="noop" t-value="this.notify()"/>`;
      static components = { Child };

      state = proxy({ flag: false });
      setup() {
        useLogLifecycle();
      }
      async notify() {
        // we destroy here the app after the new child component has been
        // created, but before this rendering has been patched to the DOM
        if (this.state.flag) {
          await Promise.resolve();
          app.destroy();
        }
      }
    }

    const app = new App();
    const parent = await app.createRoot(Parent).mount(fixture);
    expect(fixture.innerHTML).toBe("beforeafter");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    parent.state.flag = true;

    await nextTick();
    expect(fixture.innerHTML).toBe("");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:setup",
        "Child:willStart",
        "Parent:willUnmount",
        "Child:willDestroy",
        "Parent:willDestroy",
      ]
    `);
  });
});
