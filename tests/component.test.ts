import { Component, Env } from "../src/component";
import {
  makeDeferred,
  makeTestFixture,
  makeTestEnv,
  nextMicroTick,
  nextTick,
  normalize
} from "./helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - env: a WEnv, necessary to create new widgets

let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  env.qweb.addTemplate(
    "Counter",
    `<div><t t-esc="state.counter"/><button t-on-click="inc">Inc</button></div>`
  );
  env.qweb.addTemplate("WidgetA", `<div>Hello<t t-widget="b"/></div>`);
  env.qweb.addTemplate("WidgetB", `<div>world</div>`);
});

afterEach(() => {
  fixture.remove();
});

class Widget extends Component<any, any, any> {}

function children(w: Widget): Widget[] {
  const childrenMap = w.__owl__.children;
  return Object.keys(childrenMap).map(id => childrenMap[id]);
}

// Test widgets
class Counter extends Widget {
  state = {
    counter: 0
  };

  inc() {
    this.state.counter++;
  }
}

class WidgetA extends Widget {
  widgets = { b: WidgetB };
}

class WidgetB extends Widget {}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("basic widget properties", () => {
  test("props and state are properly defined", async () => {
    const widget = new Widget(env);
    expect(widget.props).toEqual({});
    expect(widget.state).toEqual(undefined);
  });

  test("has no el after creation", async () => {
    const widget = new Widget(env);
    expect(widget.el).toBe(null);
  });

  test("can be mounted", async () => {
    const widget = new Widget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test("can be clicked on and updated", async () => {
    const counter = new Counter(env);
    await counter.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<button>Inc</button></div>");
  });

  test("cannot be clicked on and updated if not in DOM", async () => {
    const counter = new Counter(env);
    const target = document.createElement("div");
    await counter.mount(target);
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    expect(counter.state.counter).toBe(1);
  });

  test("widget style and classname", async () => {
    env.qweb.addTemplate(
      "StyledWidget",
      `<div style="font-weight:bold;" class="some-class">world</div>`
    );
    class StyledWidget extends Widget {}
    const widget = new StyledWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(
      `<div style="font-weight:bold;" class="some-class">world</div>`
    );
  });

  test("changing state before first render does not trigger a render", async () => {
    let renderCalls = 0;
    class TestW extends Widget {
      state = { drinks: 1 };
      async willStart() {
        this.state.drinks++;
      }
      async _render() {
        renderCalls++;
        return super._render();
      }
    }
    const widget = new TestW(env);
    await widget.mount(fixture);
    expect(renderCalls).toBe(1);
  });

  test("keeps a reference to env", async () => {
    const widget = new Widget(env);
    expect(widget.env).toBe(env);
  });

  test("do not remove previously rendered dom if not necessary", async () => {
    const widget = new Widget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div></div>`);
    widget.el!.appendChild(document.createElement("span"));
    expect(fixture.innerHTML).toBe(`<div><span></span></div>`);
    widget.render();
    expect(fixture.innerHTML).toBe(`<div><span></span></div>`);
  });
});

describe("lifecycle hooks", () => {
  test("willStart hook is called", async () => {
    let willstart = false;
    class HookWidget extends Widget {
      async willStart() {
        willstart = true;
      }
    }
    const widget = new HookWidget(env);
    await widget.mount(fixture);
    expect(willstart).toBe(true);
  });

  test("mounted hook is not called if not in DOM", async () => {
    let mounted = false;
    class HookWidget extends Widget {
      async mounted() {
        mounted = true;
      }
    }
    const widget = new HookWidget(env);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(mounted).toBe(false);
  });

  test("mounted hook is called if mounted in DOM", async () => {
    let mounted = false;
    class HookWidget extends Widget {
      async mounted() {
        mounted = true;
      }
    }
    const widget = new HookWidget(env);
    await widget.mount(fixture);
    expect(mounted).toBe(true);
  });

  test("willStart hook is called on subwidget", async () => {
    let ok = false;
    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="child"/></div>`);
    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
    }
    class ChildWidget extends Widget {
      async willStart() {
        ok = true;
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(ok).toBe(true);
  });

  test("mounted hook is called on subwidgets, in proper order", async () => {
    const steps: any[] = [];

    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="child"/></div>`);

    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
      mounted() {
        steps.push("parent:mounted");
      }
    }
    class ChildWidget extends Widget {
      mounted() {
        expect(document.body.contains(this.el)).toBe(true);
        steps.push("child:mounted");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["child:mounted", "parent:mounted"]);
  });

  test("mounted hook is called on subsubwidgets, in proper order", async () => {
    const steps: any[] = [];

    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-if="state.flag"><t t-widget="child"/></t></div>`
    );
    env.qweb.addTemplate(
      "ChildWidget",
      `<div><t t-widget="childchild"/></div>`
    );

    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
      state = { flag: false };
      mounted() {
        steps.push("parent:mounted");
      }
      willUnmount() {
        steps.push("parent:willUnmount");
      }
    }
    class ChildWidget extends Widget {
      widgets = { childchild: ChildChildWidget };
      mounted() {
        steps.push("child:mounted");
      }
      willUnmount() {
        steps.push("child:willUnmount");
      }
    }
    class ChildChildWidget extends Widget {
      mounted() {
        steps.push("childchild:mounted");
      }
      willUnmount() {
        steps.push("childchild:willUnmount");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["parent:mounted"]);
    widget.state.flag = true;
    await nextTick();
    widget.destroy();
    expect(steps).toEqual([
      "parent:mounted",
      "childchild:mounted",
      "child:mounted",
      "parent:willUnmount",
      "child:willUnmount",
      "childchild:willUnmount"
    ]);
  });

  test("willPatch, patched hook are called on subsubwidgets, in proper order", async () => {
    const steps: any[] = [];

    env.qweb.addTemplate(
      "ParentWidget",
      `<div>><t t-widget="child" t-props="{n:state.n}"/></div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
      state = { n: 1 };
      willPatch() {
        steps.push("parent:willPatch");
      }
      patched() {
        steps.push("parent:patched");
      }
    }
    env.qweb.addTemplate(
      "ChildWidget",
      `<div><t t-widget="childchild" t-props="{n:props.n}"/></div>`
    );
    class ChildWidget extends Widget {
      widgets = { childchild: ChildChildWidget };
      willPatch() {
        steps.push("child:willPatch");
      }
      patched() {
        steps.push("child:patched");
      }
    }
    env.qweb.addTemplate("ChildChildWidget", `<div><t t-esc="props.n"/></div>`);

    class ChildChildWidget extends Widget {
      willPatch() {
        steps.push("childchild:willPatch");
      }
      patched() {
        steps.push("childchild:patched");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual([]);
    widget.state.n = 2;
    await nextTick();
    widget.destroy();
    expect(steps).toEqual([
      "parent:willPatch",
      "child:willPatch",
      "childchild:willPatch",
      "childchild:patched",
      "child:patched",
      "parent:patched"
    ]);
  });

  test("willStart, mounted on subwidget rendered after main is mounted in some other position", async () => {
    const steps: string[] = [];

    // the t-else part in the template is important. This is
    // necessary to have a situation that could confuse the vdom
    // patching algorithm
    env.qweb.addTemplate(
      "ParentWidget",
      `
          <div>
            <t t-if="state.ok">
              <t t-widget="child"/>
            </t>
            <t t-else="1">
              <div/>
            </t>
          </div>`
    );
    class ParentWidget extends Widget {
      state = { ok: false };
      widgets = { child: ChildWidget };
    }
    class ChildWidget extends Widget {
      async willStart() {
        steps.push("child:willStart");
      }
      mounted() {
        steps.push("child:mounted");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual([]);
    widget.state.ok = true;
    await nextTick();
    expect(steps).toEqual(["child:willStart", "child:mounted"]);
  });

  test("mounted hook is correctly called on subwidgets created in mounted hook", async done => {
    // the issue here is that the parent widget creates in the
    // mounted hook a new widget, which means that it modifies
    // in place its list of children. But this list of children is currently
    // being visited, so the mount action of the parent could cause a mount
    // action of the new child widget, even though it is not ready yet.
    expect.assertions(1);
    const target = document.createElement("div");
    document.body.appendChild(target);
    class ParentWidget extends Widget {
      mounted() {
        const child = new ChildWidget(this);
        child.mount(this.el!);
      }
    }
    class ChildWidget extends Widget {
      mounted() {
        expect(this.el).toBeTruthy();
        done();
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(target);
  });

  test("widgets are unmounted and destroyed if no longer in DOM", async () => {
    let steps: string[] = [];
    env.qweb.addTemplate(
      "ParentWidget",
      `<div>
        <t t-if="state.ok"><t t-widget="child"/></t>
      </div>`
    );
    class ParentWidget extends Widget {
      state = { ok: true };
      widgets = { child: ChildWidget };
    }

    class ChildWidget extends Widget {
      constructor(parent) {
        super(parent);
        steps.push("init");
      }
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
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["init", "willstart", "mounted"]);
    widget.state.ok = false;
    await nextTick();
    expect(steps).toEqual(["init", "willstart", "mounted", "willunmount"]);
  });

  test("widgets are unmounted and destroyed if no longer in DOM, even after updateprops", async () => {
    let childUnmounted = false;
    env.qweb.addTemplate("ChildWidget", `<span><t t-esc="props.n"/></span>`);
    class ChildWidget extends Widget {
      willUnmount() {
        childUnmounted = true;
      }
      increment() {
        this.state += 1;
      }
    }

    env.qweb.addTemplate(
      "ParentWidget",
      `
          <div>
            <div t-if="state.flag">
              <t t-widget="ChildWidget" t-props="{n: state.n}"/>
            </div>
          </div>`
    );
    class ParentWidget extends Widget {
      widgets = { ChildWidget };
      state = { n: 0, flag: true };
      increment() {
        this.state.n += 1;
      }
      toggleSubWidget() {
        this.state.flag = !this.state.flag;
      }
    }

    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>0</span></div></div>");
    widget.increment();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div><span>1</span></div></div>");
    widget.toggleSubWidget();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(childUnmounted).toBe(true);
  });

  test("hooks are called in proper order in widget creation/destruction", async () => {
    let steps: string[] = [];
    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="child"/></div>`);
    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
      constructor(parent) {
        super(parent);
        steps.push("p init");
      }
      async willStart() {
        steps.push("p willstart");
      }
      mounted() {
        steps.push("p mounted");
      }
      willUnmount() {
        steps.push("p willunmount");
      }
    }

    class ChildWidget extends Widget {
      constructor(parent) {
        super(parent);
        steps.push("c init");
      }
      async willStart() {
        steps.push("c willstart");
      }
      mounted() {
        steps.push("c mounted");
      }
      willUnmount() {
        steps.push("c willunmount");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    widget.destroy();
    expect(steps).toEqual([
      "p init",
      "p willstart",
      "c init",
      "c willstart",
      "c mounted",
      "p mounted",
      "p willunmount",
      "c willunmount"
    ]);
  });

  test("willUpdateProps hook is called", async () => {
    let def = makeDeferred();
    env.qweb.addTemplate(
      "Parent",
      '<span><t t-widget="Child" t-props="{n: state.n}"/></span>'
    );
    class Parent extends Widget {
      state = { n: 1 };
      widgets = { Child: HookWidget };
    }
    env.qweb.addTemplate("HookWidget", '<span><t t-esc="props.n"/></span>');
    class HookWidget extends Widget {
      willUpdateProps(nextProps) {
        expect(nextProps.n).toBe(2);
        return def;
      }
    }
    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<span><span>1</span></span>");
    widget.state.n = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span><span>1</span></span>");
    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span><span>2</span></span>");
  });

  test("patched hook is called after updating State", async () => {
    let n = 0;

    class TestWidget extends Widget {
      state = { a: 1 };

      patched() {
        n++;
      }
    }
    const widget = new TestWidget(env);
    await widget.mount(fixture);
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

    env.qweb.addTemplate(
      "Parent",
      '<div><t t-widget="Child" t-props="{a:state.a}"/></div>'
    );
    class Parent extends Widget {
      state = { a: 1 };
      widgets = { Child: TestWidget };
    }

    class TestWidget extends Widget {
      patched() {
        n++;
      }
    }
    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(n).toBe(0);

    widget.state.a = 2;
    await nextTick();
    expect(n).toBe(1);
  });

  test("patched hook is called after updateEnv", async () => {
    let n = 0;

    class TestWidget extends Widget {
      state = { a: 1 };

      patched() {
        n++;
      }
    }
    const widget = new TestWidget(env);
    await widget.mount(fixture);
    expect(n).toBe(0);

    await widget.updateEnv({ isMobile: true });
    expect(n).toBe(1);
  });

  test("shouldUpdate hook prevent rerendering", async () => {
    let shouldUpdate = false;
    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="Child" t-props="{val:state.val}"/></div>`
    );
    class Parent extends Widget {
      state = { val: 42 };
      widgets = { Child: TestWidget };
    }
    env.qweb.addTemplate("TestWidget", `<div><t t-esc="props.val"/></div>`);
    class TestWidget extends Widget {
      shouldUpdate() {
        return shouldUpdate;
      }
    }
    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>42</div></div>");
    widget.state.val = 123;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>42</div></div>");
    shouldUpdate = true;
    widget.state.val = 666;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>666</div></div>");
  });

  test("sub widget (inside sub node): hooks are correctly called", async () => {
    let created = false;
    let mounted = false;
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <t t-if="state.flag">
            <div><t t-widget="child"/></div>
          </t>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
      state = { flag: false };
    }

    class ChildWidget extends Widget {
      constructor(parent, props) {
        super(parent, props);
        created = true;
      }
      mounted() {
        mounted = true;
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(created).toBe(false);
    expect(mounted).toBe(false);

    widget.state.flag = true;
    await nextTick();
    expect(mounted).toBe(true);
    expect(created).toBe(true);
  });

  test("willPatch/patched hook", async () => {
    const steps: string[] = [];
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
            <t t-widget="child" t-props="{v: state.n}"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
      state = { n: 1 };
      willPatch() {
        steps.push("parent:willPatch");
        return "leffe";
      }
      patched(snapshot) {
        expect(snapshot).toBe("leffe");
        steps.push("parent:patched");
      }
    }

    class ChildWidget extends Widget {
      willPatch() {
        steps.push("child:willPatch");
      }
      patched() {
        steps.push("child:patched");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual([]);
    widget.state.n = 2;
    await nextTick();

    // Not sure about this order.  If you disagree, feel free to open an issue...
    expect(steps).toEqual([
      "parent:willPatch",
      "child:willPatch",
      "child:patched",
      "parent:patched"
    ]);
  });

  test("willPatch/patched hook with t-keepalive", async () => {
    // we make sure here that willPatch/patched is only called if widget is in
    // dom, mounted
    const steps: string[] = [];
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
            <t t-if="state.flag" t-widget="child" t-props="{v: state.n}" t-keepalive="1"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: ChildWidget };
      state = { n: 1, flag: true };
    }

    class ChildWidget extends Widget {
      willPatch() {
        steps.push("child:willPatch");
      }
      patched() {
        steps.push("child:patched");
      }
      willUnmount() {
        steps.push("child:willUnmount");
      }
      mounted() {
        steps.push("child:mounted");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["child:mounted"]);
    widget.state.flag = false;
    await nextTick();
    expect(steps).toEqual(["child:mounted", "child:willUnmount"]);
    widget.state.flag = true;
    await nextTick();
    expect(steps).toEqual([
      "child:mounted",
      "child:willUnmount",
      "child:mounted"
    ]);
  });
});

describe("destroy method", () => {
  test("destroy remove the widget from the DOM", async () => {
    const widget = new Widget(env);
    await widget.mount(fixture);
    expect(document.contains(widget.el)).toBe(true);
    widget.destroy();
    expect(document.contains(widget.el)).toBe(false);
    expect(widget.__owl__.isMounted).toBe(false);
    expect(widget.__owl__.isDestroyed).toBe(true);
  });

  test("destroying a parent also destroys its children", async () => {
    const parent = new WidgetA(env);
    await parent.mount(fixture);

    const child = children(parent)[0];

    expect(child.__owl__.isDestroyed).toBe(false);
    parent.destroy();
    expect(child.__owl__.isDestroyed).toBe(true);
  });

  test("destroy remove the parent/children link", async () => {
    const parent = new WidgetA(env);
    await parent.mount(fixture);

    const child = children(parent)[0];
    expect(child.__owl__.parent).toBe(parent);
    expect(children(parent).length).toBe(1);
    child.destroy();
    expect(child.__owl__.parent).toBe(null);
    expect(children(parent).length).toBe(0);
  });

  test("destroying a widget before willStart is done", async () => {
    let def = makeDeferred();
    let isRendered = false;
    class DelayedWidget extends Widget {
      willStart() {
        return def;
      }
    }
    expect(fixture.innerHTML).toBe("");
    const widget = new DelayedWidget(env);
    widget.mount(fixture);
    expect(widget.__owl__.isMounted).toBe(false);
    expect(widget.__owl__.isDestroyed).toBe(false);
    widget.destroy();
    expect(widget.__owl__.isMounted).toBe(false);
    expect(widget.__owl__.isDestroyed).toBe(true);
    def.resolve();
    await nextTick();

    expect(widget.__owl__.isMounted).toBe(false);
    expect(widget.__owl__.isDestroyed).toBe(true);
    expect(widget.__owl__.vnode).toBe(undefined);
    expect(fixture.innerHTML).toBe("");
    expect(isRendered).toBe(false);
  });
});

describe("composition", () => {
  test("a widget with a sub widget", async () => {
    const widget = new WidgetA(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hello<div>world</div></div>");
    expect(children(widget)[0].__owl__.parent).toBe(widget);
  });

  test("throw a nice error if it cannot find widget", async () => {
    expect.assertions(1);
    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="SomeMispelledWidget"/></div>`
    );
    class Parent extends Widget {
      widgets = { SomeWidget: Widget };
    }
    const parent = new Parent(env);
    try {
      await parent.mount(fixture);
    } catch (e) {
      expect(e.message).toBe(
        'Cannot find the definition of widget "SomeMispelledWidget"'
      );
    }
  });

  test("t-refs on widget are widgets", async () => {
    env.qweb.addTemplate(
      "WidgetC",
      `<div>Hello<t t-ref="'mywidgetb'" t-widget="b"/></div>`
    );
    class WidgetC extends Widget {
      widgets = { b: WidgetB };
    }
    const widget = new WidgetC(env);
    await widget.mount(fixture);
    expect(widget.refs.mywidgetb instanceof WidgetB).toBe(true);
  });

  test("t-refs are bound at proper timing", async () => {
    expect.assertions(2);
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <t t-foreach="state.list" t-as="elem" t-ref="'child'" t-key="elem" t-widget="Widget"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { Widget };
      state = { list: <any>[] };
      willPatch() {
        expect(this.refs.child).toBeUndefined();
      }
      patched() {
        expect(this.refs.child).not.toBeUndefined();
      }
    }

    const parent = new ParentWidget(env);
    await parent.mount(fixture);
    parent.state.list.push(1);
    await nextTick();
  });

  test("t-refs are bound at proper timing (2)", async () => {
    expect.assertions(10);
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <t t-if="state.child1" t-ref="'child1'" t-widget="Widget"/>
          <t t-if="state.child2" t-ref="'child2'" t-widget="Widget"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { Widget };
      state = { child1: true, child2: false };
      count = 0;
      mounted() {
        expect(this.refs.child1).toBeDefined();
        expect(this.refs.child2).toBeUndefined();
      }
      willPatch() {
        if (this.count === 0) {
          expect(this.refs.child1).toBeDefined();
          expect(this.refs.child2).toBeUndefined();
        }
        if (this.count === 1) {
          expect(this.refs.child1).toBeDefined();
          expect(this.refs.child2).toBeDefined();
        }
      }
      patched() {
        if (this.count === 0) {
          expect(this.refs.child1).toBeDefined();
          expect(this.refs.child2).toBeDefined();
        }
        if (this.count === 1) {
          expect(this.refs.child1).toBeUndefined();
          expect(this.refs.child2).toBeDefined();
        }
        this.count++;
      }
    }

    const parent = new ParentWidget(env);
    await parent.mount(fixture);
    parent.state.child2 = true;
    await nextTick();
    parent.state.child1 = false;
    await nextTick();
  });

  test("modifying a sub widget", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="Counter"/></div>`);
    class ParentWidget extends Widget {
      widgets = { Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div>0<button>Inc</button></div></div>"
    );
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div>1<button>Inc</button></div></div>"
    );
  });

  test("refs in a loop", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div>
        <t t-foreach="state.items" t-as="item">
          <t t-widget="Child" t-ref="item" t-key="item"/>
        </t>
      </div>`
    );
    class ParentWidget extends Widget {
      state = { items: [1, 2, 3] };
      widgets = { Child: Widget };
    }
    const parent = new ParentWidget(env);
    await parent.mount(fixture);
    expect(Object.keys(parent.refs)).toEqual(["1", "2", "3"]);
  });

  test("parent's elm for a children === children's elm, even after rerender", async () => {
    const widget = new WidgetA(env);
    await widget.mount(fixture);

    expect((<any>widget.__owl__.vnode!.children![1]).elm).toBe(
      (<any>children(widget)[0].__owl__.vnode).elm
    );
    await children(widget)[0].render();
    expect((<any>widget.__owl__.vnode!.children![1]).elm).toBe(
      (<any>children(widget)[0].__owl__.vnode).elm
    );
  });

  test("parent env is propagated to child widgets", async () => {
    const widget = new WidgetA(env);
    await widget.mount(fixture);

    expect(children(widget)[0].env).toBe(env);
  });

  test("rerendering a widget with a sub widget", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="Counter"/></div>`);
    class ParentWidget extends Widget {
      widgets = { Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div>1<button>Inc</button></div></div>"
    );
    await widget.render();
    expect(fixture.innerHTML).toBe(
      "<div><div>1<button>Inc</button></div></div>"
    );
  });

  test("sub widgets are destroyed if no longer in dom, then recreated", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-if="state.ok"><t t-widget="counter"/></t></div>`
    );
    class ParentWidget extends Widget {
      state = { ok: true };
      widgets = { counter: Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div>1<button>Inc</button></div></div>"
    );
    widget.state.ok = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    widget.state.ok = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div>0<button>Inc</button></div></div>"
    );
  });

  test("sub widgets with t-keepalive are not destroyed if no longer in dom", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-if="state.ok"><t t-widget="counter" t-keepalive="1"/></t></div>`
    );
    class ParentWidget extends Widget {
      state = { ok: true };
      widgets = { counter: Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div>1<button>Inc</button></div></div>"
    );
    const counter = children(widget)[0];
    expect(counter.__owl__.isMounted).toBe(true);

    widget.state.ok = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(counter.__owl__.isMounted).toBe(false);

    widget.state.ok = true;
    await nextTick();
    expect(counter.__owl__.isMounted).toBe(true);
    expect(fixture.innerHTML).toBe(
      "<div><div>1<button>Inc</button></div></div>"
    );
  });

  test("sub widgets dom state with t-keepalive is preserved", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-if="state.ok"><t t-widget="InputWidget" t-keepalive="1"/></t></div>`
    );
    class ParentWidget extends Widget {
      state = { ok: true };
      widgets = { InputWidget };
    }
    env.qweb.addTemplate("InputWidget", "<input/>");
    class InputWidget extends Widget {}
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    const input = fixture.getElementsByTagName("input")[0];
    input.value = "test";
    widget.state.ok = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    widget.state.ok = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><input></div>");
    const input2 = fixture.getElementsByTagName("input")[0];
    expect(input).toBe(input2);
    expect(input2.value).toBe("test");
  });

  test("sub widgets rendered in a loop", async () => {
    env.qweb.addTemplate("ChildWidget", `<span><t t-esc="props.n"/></span>`);
    class ChildWidget extends Widget {}

    env.qweb.addTemplate(
      "Parent",
      `
        <div>
          <t t-foreach="state.numbers" t-as="number">
            <t t-widget="ChildWidget" t-key="number" t-props="{n: number}"/>
          </t>
        </div>`
    );
    class Parent extends Widget {
      state = {
        numbers: [1, 2, 3]
      };
      widgets = { ChildWidget };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(normalize(fixture.innerHTML)).toBe(
      normalize(`
      <div>
        <span>1</span>
        <span>2</span>
        <span>3</span>
      </div>
    `)
    );
  });

  test("sub widgets with some state rendered in a loop", async () => {
    let n = 1;
    env.qweb.addTemplate("ChildWidget", `<span><t t-esc="state.n"/></span>`);
    class ChildWidget extends Widget {
      constructor(parent) {
        super(parent);
        this.state = { n };
        n++;
      }
    }

    env.qweb.addTemplate(
      "parent",
      `<div>
          <t t-foreach="state.numbers" t-as="number">
            <t t-widget="ChildWidget" t-key="number"/>
          </t>
        </div>`
    );
    class Parent extends Widget {
      template = "parent";
      state = {
        numbers: [1, 2, 3]
      };
      widgets = { ChildWidget };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    parent.state.numbers = [1, 3];
    await nextTick();
    expect(normalize(fixture.innerHTML)).toBe(
      normalize(`
      <div>
        <span>1</span>
        <span>3</span>
      </div>
    `)
    );
    expect(env.qweb.templates.parent.fn.toString()).toMatchSnapshot();
  });

  test("sub widgets between t-ifs", async () => {
    // this confuses the patching algorithm...
    env.qweb.addTemplate("ChildWidget", `<span>child</span>`);
    class ChildWidget extends Widget {}

    env.qweb.addTemplate(
      "Parent",
      `<div>
            <h1 t-if="state.flag">hey</h1>
            <h2 t-else="1">noo</h2>
            <span><t t-widget="ChildWidget"/></span>
            <t t-if="state.flag"><span>test</span></t>
        </div>`
    );

    class Parent extends Widget {
      state = { flag: false };
      widgets = { ChildWidget };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    const child = children(parent)[0];

    parent.state.flag = true;
    await nextTick();
    expect(children(parent)[0]).toBe(child);
    expect(child.__owl__.isDestroyed).toBe(false);
    expect(normalize(fixture.innerHTML)).toBe(
      normalize(`
      <div>
        <h1>hey</h1>
        <span><span>child</span></span>
        <span>test</span>
      </div>
    `)
    );
  });
});

describe("props evaluation (with t-props directive)", () => {
  test("explicit object prop", async () => {
    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="child" t-props="{value: state.val}"/></div>`
    );
    class Parent extends Widget {
      widgets = { child: Child };
      state = { val: 42 };
    }

    env.qweb.addTemplate("Child", `<span><t t-esc="state.someval"/></span>`);
    class Child extends Widget {
      state: { someval: number };
      constructor(parent: Parent, props: { value: number }) {
        super(parent);
        this.state = { someval: props.value };
      }
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("object prop value", async () => {
    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="child" t-props="state"/></div>`
    );
    class Parent extends Widget {
      widgets = { child: Child };
      state = { val: 42 };
    }

    env.qweb.addTemplate("Child", `<span><t t-esc="state.someval"/></span>`);
    class Child extends Widget {
      state: { someval: number };
      constructor(parent: Parent, props: { val: number }) {
        super(parent);
        this.state = { someval: props.val };
      }
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("accept ES6-like syntax for props (with getters)", async () => {
    env.qweb.addTemplate("Child", `<span><t t-esc="props.greetings"/></span>`);
    class Child extends Widget {}

    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="child" t-props="{greetings}"/></div>`
    );
    class Parent extends Widget {
      widgets = { child: Child };
      get greetings() {
        return `hello ${this.props.name}`;
      }
    }
    const widget = new Parent(env, { name: "aaron" });
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>hello aaron</span></div>");
  });

  test("t-set works with t-props", async () => {
    env.qweb.addTemplate(
      "Parent",
      `
        <div>
          <t t-set="val" t-value="42"/>
          <t t-widget="child" t-props="{val:val}"/>
        </div>`
    );
    class Parent extends Widget {
      widgets = { child: Child };
    }
    env.qweb.addTemplate(
      "Child",
      `
        <span>
          <t t-esc="props.val"/>
        </span>`
    );
    class Child extends Widget {}

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(normalize(fixture.innerHTML)).toBe("<div><span>42</span></div>");
  });
});

describe("class and style attributes with t-widget", () => {
  test("class is properly added on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
            <t t-widget="child" class="a b"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Child };
    }
    env.qweb.addTemplate("Child", `<div class="c"/>`);
    class Child extends Widget {}
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="c a b"></div></div>`);
  });

  test("t-att-class is properly added/removed on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div>
            <t t-widget="child" t-att-class="{a:state.a, b:state.b}"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Child };
      state = { a: true, b: false };
    }
    env.qweb.addTemplate("Child", `<div class="c"/>`);
    class Child extends Widget {}
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="c a"></div></div>`);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();

    widget.state.a = false;
    widget.state.b = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div><div class="c b"></div></div>`);
  });

  test("style is properly added on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
            <t t-widget="child" style="font-weight: bold;"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Widget };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(
      `<div><div style="font-weight: bold;"></div></div>`
    );
  });

  test("dynamic t-att-style is properly added and updated on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
            <t t-widget="child" t-att-style="state.style"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Widget };
      state = { style: "font-size: 20px" };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();

    expect(fixture.innerHTML).toBe(
      `<div><div style="font-size: 20px;"></div></div>`
    );

    widget.state.style = "font-size: 30px";
    await nextTick();

    expect(fixture.innerHTML).toBe(
      `<div><div style="font-size: 30px;"></div></div>`
    );
  });
});

describe("other directives with t-widget", () => {
  test("t-on works as expected", async () => {
    let n = 0;
    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-widget="child" t-on-customevent="someMethod"/></div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Child };
      someMethod(arg) {
        expect(arg).toBe(43);
        n++;
      }
    }
    class Child extends Widget {}
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    let child = children(widget)[0];
    expect(n).toBe(0);
    child.trigger("customevent", 43);
    expect(n).toBe(1);
    child.destroy();
    child.trigger("customevent", 43);
    expect(n).toBe(1);
  });

  test("t-if works with t-widget", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-widget="child" t-if="state.flag"/></div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Child };
      state = { flag: true };
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");
    class Child extends Widget {}

    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");

    widget.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    widget.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  test("t-else works with t-widget", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <div t-if="state.flag">somediv</div>
          <t t-else="1" t-widget="child"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Child };
      state = { flag: true };
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");
    class Child extends Widget {}

    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(normalize(fixture.innerHTML)).toBe("<div><div>somediv</div></div>");

    widget.state.flag = false;
    await nextTick();
    expect(normalize(fixture.innerHTML)).toBe("<div><span>hey</span></div>");
  });

  test("t-elif works with t-widget", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <div t-if="state.flag">somediv</div>
          <t t-elif="!state.flag" t-widget="child"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Child };
      state = { flag: true };
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");
    class Child extends Widget {}

    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(normalize(fixture.innerHTML)).toBe("<div><div>somediv</div></div>");

    widget.state.flag = false;
    await nextTick();
    expect(normalize(fixture.innerHTML)).toBe("<div><span>hey</span></div>");
  });

  test("t-else with empty string works with t-widget", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <div t-if="state.flag">somediv</div>
          <t t-else="" t-widget="child"/>
        </div>`
    );
    class ParentWidget extends Widget {
      widgets = { child: Child };
      state = { flag: true };
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");
    class Child extends Widget {}

    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(normalize(fixture.innerHTML)).toBe("<div><div>somediv</div></div>");

    widget.state.flag = false;
    await nextTick();
    expect(normalize(fixture.innerHTML)).toBe("<div><span>hey</span></div>");
  });
});

describe("random stuff/miscellaneous", () => {
  test("widget after a t-foreach", async () => {
    // this test makes sure that the foreach directive does not pollute sub
    // context with the inLoop variable, which is then used in the t-widget
    // directive as a key
    env.qweb.addTemplate(
      "Test",
      `<div><t t-foreach="2">txt</t><t t-widget="widget"/></div>`
    );
    class Test extends Widget {
      widgets = { widget: Widget };
    }
    const widget = new Test(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>txttxt<div></div></div>");
  });

  test("updating widget immediately", async () => {
    // in this situation, we protect against a bug that occurred: because of the
    // interplay between widgets and vnodes, a sub widget vnode was patched
    // twice.
    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="child" t-props="{flag:state.flag}"/></div>`
    );
    class Parent extends Widget {
      widgets = { child: Child };
      state = { flag: false };
    }

    env.qweb.addTemplate(
      "Child",
      `<span>abc<t t-if="props.flag">def</t></span>`
    );
    class Child extends Widget {}

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>abc</span></div>");
    widget.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>abcdef</span></div>");
  });

  test("snapshotting compiled code", async () => {
    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="child" t-key="'somestring'" t-props="{flag:state.flag}"/></div>`
    );
    class Parent extends Widget {
      widgets = { child: Child };
      state = { flag: false };
    }

    env.qweb.addTemplate(
      "Child",
      `<span>abc<t t-if="props.flag">def</t></span>`
    );
    class Child extends Widget {}

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(env.qweb.templates.Parent.fn.toString()).toMatchSnapshot();
  });

  test("t-props should not be undefined (snapshotting)", async () => {
    env.qweb.addTemplate("Parent", `<div><t t-widget="child"/></div>`);
    class Parent extends Widget {
      widgets = { child: Child };
    }

    env.qweb.addTemplate("Child", `<span>abc</span>`);
    class Child extends Widget {}

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(env.qweb.templates.Parent.fn.toString()).toMatchSnapshot();
  });

  test("component semantics", async () => {
    let steps: string[] = [];
    let c: C;

    class TestWidget extends Widget {
      name: string = "test";
      async willStart() {
        steps.push(`${this.name}:willStart`);
      }
      _render(f, p) {
        steps.push(`${this.name}:render`);
        return super._render(f, p);
      }
      _patch(vnode) {
        steps.push(`${this.name}:_patch`);
        super._patch(vnode);
      }
      _mount(vnode, elm) {
        steps.push(`${this.name}:_patch(from _mount)`);
        return super._mount(vnode, elm);
      }
      mounted() {
        steps.push(`${this.name}:mounted`);
      }
      async willUpdateProps() {
        steps.push(`${this.name}:willUpdateProps`);
      }
      willPatch() {
        steps.push(`${this.name}:willPatch`);
      }
      patched() {
        steps.push(`${this.name}:patched`);
      }
      willUnmount() {
        steps.push(`${this.name}:willUnmount`);
      }
      destroy() {
        super.destroy();
        steps.push(`${this.name}:destroy`);
      }
    }
    env.qweb.addTemplate("A", `<div>A<t t-widget="B"/><t t-widget="C"/></div>`);
    class A extends TestWidget {
      widgets = { B, C };
      name = "A";
    }
    env.qweb.addTemplate("B", `<div>B</div>`);
    class B extends TestWidget {
      name = "B";
      constructor(parent, props) {
        super(parent, props);
        steps.push("B:constructor");
      }
    }
    env.qweb.addTemplate(
      "C",
      `
        <div>C<t t-widget="D"/>
            <t t-if="state.flag" t-widget="E"/>
            <t t-else="!state.flag" t-widget="F"/>
        </div>`
    );
    class C extends TestWidget {
      widgets = { D, E, F };
      name = "C";
      state = { flag: true };

      constructor(parent, props) {
        super(parent, props);
        c = this;
        steps.push("C:constructor");
      }
    }

    env.qweb.addTemplate("D", `<div>D</div>`);
    class D extends TestWidget {
      name = "D";
      constructor(parent, props) {
        super(parent, props);
        steps.push("D:constructor");
      }
    }
    env.qweb.addTemplate("E", `<div>E</div>`);
    class E extends TestWidget {
      name = "E";
      constructor(parent, props) {
        super(parent, props);
        steps.push("E:constructor");
      }
    }

    env.qweb.addTemplate("F", `<div>F</div>`);
    class F extends TestWidget {
      name = "F";
      constructor(parent, props) {
        super(parent, props);
        steps.push("F:constructor");
      }
    }

    const a = new A(env);
    await a.mount(fixture);
    expect(fixture.innerHTML).toBe(
      `<div>A<div>B</div><div>C<div>D</div><div>E</div></div></div>`
    );
    expect(steps).toEqual([
      "A:willStart",
      "A:render",
      "B:constructor",
      "B:willStart",
      "C:constructor",
      "C:willStart",
      "B:render",
      "C:render",
      "D:constructor",
      "D:willStart",
      "E:constructor",
      "E:willStart",
      "D:render",
      "E:render",
      "A:_patch",
      "B:_patch(from _mount)",
      "C:_patch(from _mount)",
      "D:_patch(from _mount)",
      "E:_patch(from _mount)",
      "B:mounted",
      "D:mounted",
      "E:mounted",
      "C:mounted",
      "A:mounted"
    ]);

    // update
    steps = [];
    c!.state.flag = false;
    await nextTick();
    expect(steps).toEqual([
      "C:render",
      "D:willUpdateProps",
      "F:constructor",
      "F:willStart",
      "D:render",
      "F:render",
      "C:willPatch",
      "D:willPatch",
      "C:_patch",
      "E:willUnmount",
      "E:destroy",
      "F:_patch(from _mount)",
      "F:mounted",
      "D:_patch",
      "D:patched",
      "C:patched"
    ]);
  });
});

describe("async rendering", () => {
  test("destroying a widget before start is over", async () => {
    let def = makeDeferred();
    class W extends Widget {
      willStart(): Promise<void> {
        return def;
      }
    }
    const w = new W(env);
    w.mount(fixture);
    expect(w.__owl__.isDestroyed).toBe(false);
    expect(w.__owl__.isMounted).toBe(false);
    w.destroy();
    def.resolve();
    await nextTick();
    expect(w.__owl__.isDestroyed).toBe(true);
    expect(w.__owl__.isMounted).toBe(false);
  });

  test("destroying/recreating a subwidget with different props (if start is not over)", async () => {
    let def = makeDeferred();
    let n = 0;
    env.qweb.addTemplate(
      "W",
      `<div><t t-if="state.val > 1"><t t-widget="Child" t-props="{val: state.val}"/></t></div>`
    );
    class W extends Widget {
      widgets = { Child };
      state = { val: 1 };
    }

    env.qweb.addTemplate("Child", `<span>child:<t t-esc="props.val"/></span>`);
    class Child extends Widget {
      constructor(parent, props) {
        super(parent, props);
        n++;
      }
      willStart(): Promise<void> {
        return def;
      }
    }
    const w = new W(env);
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

  test("creating two async widgets, scenario 1", async () => {
    let defA = makeDeferred();
    let defB = makeDeferred();

    env.qweb.addTemplate("ChildA", "<span>a</span>");
    class ChildA extends Widget {
      willStart(): Promise<void> {
        return defA;
      }
    }

    env.qweb.addTemplate("ChildB", "<span>b</span>");
    class ChildB extends Widget {
      willStart(): Promise<void> {
        return defB;
      }
    }
    env.qweb.addTemplate(
      "Parent",
      `
        <div>
          <t t-if="state.flagA"><t t-widget="ChildA"/></t>
          <t t-if="state.flagB"><t t-widget="ChildB"/></t>
        </div>`
    );
    class Parent extends Widget {
      widgets = { ChildA, ChildB };
      state = { flagA: false, flagB: false };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe("<div></div>");
    parent.state.flagA = true;
    await nextTick();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe("<div></div>");
    parent.state.flagB = true;
    await nextTick();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe("<div></div>");
    defB.resolve();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe("<div></div>");
    defA.resolve();
    await nextTick();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe(
      "<div><span>a</span><span>b</span></div>"
    );
  });

  test("creating two async widgets, scenario 2", async () => {
    let defA = makeDeferred();
    let defB = makeDeferred();

    env.qweb.addTemplate("ChildA", `<span>a<t t-esc="props.val"/></span>`);
    class ChildA extends Widget {
      _updateProps(props, forceUpdate, fiber): Promise<void> {
        return defA.then(() => super._updateProps(props, forceUpdate, fiber));
      }
    }
    env.qweb.addTemplate("ChildB", `<span>b<t t-esc="props.val"/></span>`);
    class ChildB extends Widget {
      willStart(): Promise<void> {
        return defB;
      }
    }

    env.qweb.addTemplate(
      "Parent",
      `
        <div>
          <t t-widget="ChildA" t-props="{val:state.valA}"/>
          <t t-if="state.flagB"><t t-widget="ChildB" t-props="{val:state.valB}"/></t>
        </div>`
    );
    class Parent extends Widget {
      widgets = { ChildA, ChildB };
      state = { valA: 1, valB: 2, flagB: false };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe(
      "<div><span>a1</span></div>"
    );
    parent.state.valA = 2;
    await nextTick();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe(
      "<div><span>a1</span></div>"
    );
    parent.state.flagB = true;
    await nextTick();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe(
      "<div><span>a1</span></div>"
    );
    defB.resolve();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe(
      "<div><span>a1</span></div>"
    );
    defA.resolve();
    await nextTick();
    expect(fixture.innerHTML.replace(/\r?\n|\r|\s+/g, "")).toBe(
      "<div><span>a2</span><span>b2</span></div>"
    );
  });

  test("widgets in a node in a t-foreach ", async () => {
    class Child extends Widget {}

    class App extends Widget {
      widgets = { Child };

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
                            <t t-widget="Child" t-props="{ item }"/>
                        </li>
                    </t>
                </ul>
            </div>
        </templates>`);

    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><ul><li><div>1</div></li><li><div>2</div></li></ul></div>"
    );
  });

  test("properly behave when destroyed/unmounted while rendering ", async () => {
    let def = Promise.resolve();

    env.qweb.addTemplate("Child", `<div><t t-widget="SubChild"/></div>`);
    class Child extends Widget {
      widgets = { SubChild };
      mounted() {
        // from now on, each rendering in child widget will be delayed (see
        // _render)
        def = makeDeferred();
      }
      async _render(f, p) {
        const result = await super._render(f, p);
        await def;
        return result;
      }
    }

    class SubChild extends Widget {
      willPatch() {
        throw new Error("Should not happen!");
      }
      patched() {
        throw new Error("Should not happen!");
      }
    }

    env.qweb.addTemplate(
      "Parent",
      `
        <div><t t-if="state.flag"><t t-widget="Child" t-props="{val: state.val}"/></t></div>`
    );
    class Parent extends Widget {
      widgets = { Child };
      state = { flag: true, val: "Framboise Lindemans" };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><div></div></div></div>");

    // this change triggers a rendering of the parent. This rendering is delayed,
    // because child is now waiting for def to be resolved
    parent.state.val = "Framboise Girardin";
    await nextTick();

    // with this, we remove child, and childchild, even though it is not finished
    // rendering from previous changes
    parent.state.flag = false;
    await nextTick();

    // we now resolve def, so the child rendering is now complete.
    (<any>def).resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
  });
});

describe("updating environment", () => {
  test("can update widget env", async () => {
    const widget = new Widget(env);
    expect(widget.env).toBe(env);
    await widget.updateEnv(<any>{ somekey: 4 });
    expect(widget.env).toBe(env);
    expect((<any>widget).env.somekey).toBe(4);
  });

  test("updating widget env does not render widget (if not mounted)", async () => {
    let n = 0;
    class TestWidget extends Widget {
      _render() {
        n++;
        return super._render();
      }
    }

    const widget = new TestWidget(env);
    expect(n).toBe(0);
    await widget.updateEnv(<any>{ somekey: 4 });
    expect(n).toBe(0);
    await widget.mount(fixture);
    expect(n).toBe(1);
    await widget.updateEnv(<any>{ somekey: 5 });
    expect(n).toBe(2);
    widget.unmount();
    expect(n).toBe(2);
    await widget.updateEnv(<any>{ somekey: 5 });
    expect(n).toBe(2);
  });

  test("updating child env does not modify parent env", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="child"/></div>`);
    class ParentWidget extends Widget {
      widgets = { child: Widget };
    }
    const parent = new ParentWidget(env);
    await parent.mount(fixture);
    const child = children(parent)[0];
    expect(child.env).toBe(parent.env);
    await child.updateEnv(<any>{ somekey: 4 });
    expect(child.env).not.toBe(parent.env);
    expect((<any>parent).env.somekey).toBeUndefined();
  });

  test("updating parent env does modify child env", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="child"/></div>`);
    class ParentWidget extends Widget {
      widgets = { child: Widget };
    }
    const parent = new ParentWidget(env);
    await parent.mount(fixture);
    const child = children(parent)[0];
    expect(child.env.somekey).toBeUndefined();
    await parent.updateEnv({ somekey: 4 });
    expect(child.env.somekey).toBe(4);
  });

  test("updating parent env does modify child env, part 2", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-widget="child"/></div>`);
    class ParentWidget extends Widget {
      widgets = { child: Widget };
    }
    const parent = new ParentWidget(env);
    await parent.mount(fixture);
    const child = children(parent)[0];
    expect(child.env.somekey).toBeUndefined();
    await child.updateEnv({ somekey: 4 });
    await parent.updateEnv({ someotherkey: 4 });
    expect(child.env.someotherkey).toBe(4);
  });

  test("updating env force a rerender", async () => {
    env.qweb.addTemplate("TestWidget", `<div><t t-esc="env.someKey"/></div>`);
    class TestWidget extends Widget {}
    (<any>env).someKey = "hey";
    const widget = new TestWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hey</div>");
    await widget.updateEnv(<any>{ someKey: "rerendered" });
    expect(fixture.innerHTML).toBe("<div>rerendered</div>");
  });

  test("updating env force rerendering children", async () => {
    env.qweb.addTemplate("Parent", `<div><t t-widget="Child"/></div>`);
    class Parent extends Widget {
      widgets = { Child };
    }
    env.qweb.addTemplate("Child", `<div><t t-esc="env.someKey"/></div>`);
    class Child extends Widget {}
    (<any>env).someKey = "hey";
    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>hey</div></div>");
    await widget.updateEnv(<any>{ someKey: "rerendered" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>rerendered</div></div>");
  });
});

describe("widget and observable state", () => {
  test("widget is rerendered when its state is changed", async () => {
    env.qweb.addTemplate("TestWidget", `<div><t t-esc="state.drink"/></div>`);
    class TestWidget extends Widget {
      state = { drink: "water" };
    }
    const widget = new TestWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<div>water</div>");
    widget.state.drink = "beer";

    // 2 microtask ticks: one for observer, one for rendering
    await nextMicroTick();
    await nextMicroTick();
    expect(fixture.innerHTML).toBe("<div>beer</div>");
  });

  test("subwidgets cannot change observable state received from parent", async () => {
    expect.assertions(1);
    env.qweb.addTemplate(
      "Parent",
      `<div><t t-widget="Child" t-props="state.obj"/></div>`
    );
    class Parent extends Widget {
      state = { obj: { coffee: 1 } };
      widgets = { Child };
    }
    class Child extends Widget {
      constructor(parent, props) {
        super(parent, props);
        props.coffee = 2;
      }
    }
    const parent = new Parent(env);
    try {
      await parent.mount(fixture);
    } catch (e) {
      expect(e.message).toBe(
        'Observed state cannot be changed here! (key: "coffee", val: "2")'
      );
    }
  });

  test("widget can add observed keys to its state", async () => {
    env.qweb.addTemplate(
      "TestWidget",
      `<div><t t-esc="state.a"/><t t-esc="state.b"/></div>`
    );
    class TestWidget extends Widget {
      state: any = { a: 1 };
    }
    const widget = new TestWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<div>1</div>");

    widget.set(widget.state, "b", 2);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>12</div>");
  });
});

describe("t-mounted directive", () => {
  test("callback is not called when not in DOM", async () => {
    env.qweb.addTemplate("TestWidget", `<div><input t-mounted="f"/></div>`);
    class TestWidget extends Widget {
      f() {}
    }
    const widget = new TestWidget(env);
    widget.f = jest.fn();
    await widget.mount(document.createElement("div"));
    expect(widget.f).toHaveBeenCalledTimes(0);
  });

  test("callback is called when in DOM", async () => {
    env.qweb.addTemplate("TestWidget", `<div><input t-mounted="f"/></div>`);
    class TestWidget extends Widget {
      f() {}
    }
    const widget = new TestWidget(env);
    widget.f = jest.fn();
    await widget.mount(fixture);
    expect(widget.f).toHaveBeenCalledTimes(1);
  });

  test("callback with args is called when in DOM", async () => {
    env.qweb.addTemplate("TestWidget", `<div><input t-mounted="f(2)"/></div>`);
    class TestWidget extends Widget {
      f() {}
    }
    const widget = new TestWidget(env);
    widget.f = jest.fn();
    await widget.mount(fixture);
    expect(widget.f).toHaveBeenCalledTimes(1);
    expect(widget.f).toHaveBeenCalledWith(2);
  });

  test("combined with a t-if", async () => {
    env.qweb.addTemplate(
      "TestWidget",
      `<div><input t-if="state.flag" t-mounted="f"/></div>`
    );
    class TestWidget extends Widget {
      state = { flag: false };
      f() {}
    }
    const widget = new TestWidget(env);
    widget.f = jest.fn();
    await widget.mount(fixture);
    expect(widget.f).toHaveBeenCalledTimes(0);

    widget.state.flag = true;
    await nextTick();
    expect(widget.f).toHaveBeenCalledTimes(1);
  });

  test("combined with a t-ref", async () => {
    env.qweb.addTemplate(
      "TestWidget",
      `<div><input t-ref="'input'" t-mounted="f"/></div>`
    );
    class TestWidget extends Widget {
      f() {}
    }
    const widget = new TestWidget(env);
    widget.f = jest.fn();
    await widget.mount(fixture);
    expect(widget.refs.input).toBeDefined();
    expect(widget.f).toHaveBeenCalledTimes(1);
  });
});

describe("can deduce template from name", () => {
  test("can find template if name of component", async () => {
    class ABC extends Widget {}
    env.qweb.addTemplate("ABC", "<span>Orval</span>");
    const abc = new ABC(env);
    await abc.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>Orval</span>");
  });

  test("can find template of parent component", async () => {
    class ABC extends Widget {}
    class DEF extends ABC {}
    env.qweb.addTemplate("ABC", "<span>Orval</span>");
    const def = new DEF(env);
    await def.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>Orval</span>");
  });

  test("can find template of parent component, defined by template key", async () => {
    class ABC extends Widget {
      template = "Achel";
    }
    class DEF extends ABC {}
    env.qweb.addTemplate("Achel", "<span>Orval</span>");
    const def = new DEF(env);
    await def.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>Orval</span>");
  });

  test("templates are found in proper qweb instance", async () => {
    const env2 = makeTestEnv();
    env.qweb.addTemplate("ABC", "<span>Rochefort 8</span>");
    env2.qweb.addTemplate("ABC", "<span>Rochefort 10</span>");
    class ABC extends Widget {}
    const abc = new ABC(env);
    await abc.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>Rochefort 8</span>");
    abc.destroy();
    const abc2 = new ABC(env2);
    await abc2.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>Rochefort 10</span>");
  });
});
