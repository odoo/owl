import { App, Component, mount, onMounted, onWillStart, useState } from "../../src";
import {
  onWillPatch,
  onWillUnmount,
  onPatched,
  onWillUpdateProps,
  onRender,
} from "../../src/lifecycle_hooks";
import { status } from "../../src/component/status";
import { xml } from "../../src/tags";
import {
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
          expect(document.body.contains(this.el!)).toBe(true);
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

  test("components are unmounted and destroyed if no longer in DOM", async () => {
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
    let steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="props.n"/></span>`;
      setup() {
        useLogLifecycle(steps);
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
        useLogLifecycle(steps);
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
    parent.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    parent.toggleSubWidget();
    await nextTick();
    expect(fixture.innerHTML).toBe("");
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
      "Parent:render",
      "Parent:willPatch",
      "Child:willUnmount",
      "Child:destroyed",
      "Parent:patched",
    ]);
    Object.freeze(steps);
  });

  test("hooks are called in proper order in widget creation/destruction", async () => {
    let steps: string[] = [];

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        steps.push("c init");
        onWillStart(() => {
          steps.push("c willstart");
        });
        onMounted(() => {
          steps.push("c mounted");
        });
        onWillUnmount(() => {
          steps.push("c willunmount");
        });
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
      setup() {
        steps.push("p init");
        onWillStart(() => {
          steps.push("p willstart");
        });
        onMounted(() => {
          steps.push("p mounted");
        });
        onWillUnmount(() => {
          steps.push("p willunmount");
        });
      }
    }

    const app = new App(Parent);
    await app.mount(fixture);
    app.destroy();
    expect(steps).toEqual([
      "p init",
      "p willstart",
      "c init",
      "c willstart",
      "c mounted",
      "p mounted",
      "p willunmount",
      "c willunmount",
    ]);
    Object.freeze(steps);
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
      static template = xml`<div/>`;
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
    let steps: string[] = [];

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle(steps);
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child a="state.a"/></div>`;
      static components = { Child };
      state = useState({ a: 1 });
      setup() {
        useLogLifecycle(steps);
      }
    }

    const app = new App(Parent);
    await app.mount(fixture);

    expect(steps).toEqual([
      "Parent:setup",
      "Parent:willStart",
      "Parent:render",
      "Child:setup",
      "Child:willStart",
      "Child:render",
      "Child:mounted",
      "Parent:mounted",
    ]);

    steps.splice(0);
    app.destroy();
    expect(steps).toEqual([
      "Parent:willUnmount",
      "Child:willUnmount",
      "Child:destroyed",
      "Parent:destroyed",
    ]);
    Object.freeze(steps);
  });

  test("lifecycle semantics, part 2", async () => {
    let steps: string[] = [];

    class GrandChild extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle(steps);
      }
    }
    class Child extends Component {
      static template = xml`<GrandChild/>`;
      static components = { GrandChild };
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: false });
      setup() {
        useLogLifecycle(steps);
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);

    expect(steps).toEqual(["Parent:setup", "Parent:willStart", "Parent:render", "Parent:mounted"]);

    steps.splice(0);

    parent.state.hasChild = true;
    await nextTick();
    expect(steps).toEqual([
      "Parent:render",
      "Child:setup",
      "Child:willStart",
      "Child:render",
      "GrandChild:setup",
      "GrandChild:willStart",
      "GrandChild:render",
      "Parent:willPatch",
      "GrandChild:mounted",
      "Child:mounted",
      "Parent:patched",
    ]);

    steps.splice(0);

    app.destroy();
    expect(steps).toEqual([
      "Parent:willUnmount",
      "Child:willUnmount",
      "GrandChild:willUnmount",
      "GrandChild:destroyed",
      "Child:destroyed",
      "Parent:destroyed",
    ]);
    Object.freeze(steps);
  });

  test("lifecycle semantics, part 3", async () => {
    let steps: string[] = [];

    class GrandChild extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle(steps);
      }
    }
    class Child extends Component {
      static template = xml`<GrandChild/>`;
      static components = { GrandChild };
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: false });
      setup() {
        useLogLifecycle(steps);
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);

    expect(steps).toEqual(["Parent:setup", "Parent:willStart", "Parent:render", "Parent:mounted"]);

    steps.splice(0);

    parent.state.hasChild = true;

    // immediately destroy everything
    app.destroy();
    await nextTick();
    expect(steps).toEqual(["Parent:willUnmount", "Parent:destroyed"]);
    Object.freeze(steps);
  });

  test("lifecycle semantics, part 4", async () => {
    let def = makeDeferred();

    let steps: string[] = [];

    class GrandChild extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle(steps);
        onWillStart(() => def);
      }
    }
    class Child extends Component {
      static template = xml`<GrandChild/>`;
      static components = { GrandChild };
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: false });
      setup() {
        useLogLifecycle(steps);
      }
    }

    const app = new App(Parent);
    const parent = await app.mount(fixture);

    expect(steps).toEqual(["Parent:setup", "Parent:willStart", "Parent:render", "Parent:mounted"]);

    steps.splice(0);

    parent.state.hasChild = true;

    await nextTick();
    expect(steps).toEqual([
      "Parent:render",
      "Child:setup",
      "Child:willStart",
      "Child:render",
      "GrandChild:setup",
      "GrandChild:willStart",
    ]);

    steps.splice(0);

    app.destroy();
    expect(steps).toEqual([
      "Parent:willUnmount",
      "GrandChild:destroyed",
      "Child:destroyed",
      "Parent:destroyed",
    ]);
    Object.freeze(steps);
  });

  test("lifecycle semantics, part 5", async () => {
    let steps: string[] = [];

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: true });
      setup() {
        useLogLifecycle(steps);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(steps).toEqual([
      "Parent:setup",
      "Parent:willStart",
      "Parent:render",
      "Child:setup",
      "Child:willStart",
      "Child:render",
      "Child:mounted",
      "Parent:mounted",
    ]);

    steps.splice(0);

    parent.state.hasChild = false;

    await nextTick();
    expect(steps).toEqual([
      "Parent:render",
      "Parent:willPatch",
      "Child:willUnmount",
      "Child:destroyed",
      "Parent:patched",
    ]);
    Object.freeze(steps);
  });

  test("lifecycle semantics, part 6", async () => {
    let steps: string[] = [];

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`<Child value="state.value" />`;
      static components = { Child };
      state = useState({ value: 1 });
      setup() {
        useLogLifecycle(steps);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(steps).toEqual([
      "Parent:setup",
      "Parent:willStart",
      "Parent:render",
      "Child:setup",
      "Child:willStart",
      "Child:render",
      "Child:mounted",
      "Parent:mounted",
    ]);

    steps.splice(0);

    parent.state.value = 2;

    await nextTick();
    expect(steps).toEqual([
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

  test("onRender", async () => {
    let steps: string[] = [];
    const def = makeDeferred();

    class Child extends Component {
      static template = xml`<button t-on-click="increment"><t t-esc="state.value"/></button>`;
      state = useState({ value: 1 });
      visibleState = this.state.value;
      setup() {
        useLogLifecycle(steps);
        onWillUpdateProps(() => def);
        onRender(() => (this.visibleState = this.state.value));
      }
      increment() {
        this.state.value++;
        steps.push(`inc:${this.visibleState}`);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child />`;
      static components = { Child };
      setup() {
        useLogLifecycle(steps);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<button>1</button>");

    parent.render(); // to block child render
    await nextTick();

    fixture.querySelector("button")!.click();

    await nextTick();
    fixture.querySelector("button")!.click();

    await nextTick();

    expect(fixture.innerHTML).toBe("<button>1</button>");

    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>3</button>");
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
      "inc:1",
      "inc:1",
      "Child:render",
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]);
    Object.freeze(steps);
  });

  // TODO: rename (remove? seems covered by lifecycle semantics)
  test("sub widget (inside sub node): hooks are correctly called", async () => {
    let created = false;
    let mounted = false;

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        created = true;
        onMounted(() => { mounted = true; })
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
});
