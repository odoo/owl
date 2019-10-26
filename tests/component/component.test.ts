import { Component, Env } from "../../src/component/component";
import { QWeb } from "../../src/qweb/qweb";
import { xml } from "../../src/tags";
import { useState, useRef } from "../../src/hooks";
import { EventBus } from "../../src/core/event_bus";
import {
  makeDeferred,
  makeTestFixture,
  makeTestEnv,
  nextMicroTick,
  nextTick,
  normalize,
  editInput
} from "../helpers";

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
  env.qweb.addTemplate("Widget", "<div></div>");
  env.qweb.addTemplate(
    "Counter",
    `<div><t t-esc="state.counter"/><button t-on-click="inc">Inc</button></div>`
  );
  env.qweb.addTemplate("WidgetA", `<div>Hello<t t-component="b"/></div>`);
  env.qweb.addTemplate("WidgetB", `<div>world</div>`);
});

afterEach(() => {
  fixture.remove();
});

class Widget extends Component<any, any> {}

function children(w: Widget): Widget[] {
  const childrenMap = w.__owl__.children;
  return Object.keys(childrenMap).map(id => childrenMap[id]);
}

// Test components
class Counter extends Widget {
  state = useState({
    counter: 0
  });

  inc() {
    this.state.counter++;
  }
}

class WidgetB extends Widget {}

class WidgetA extends Widget {
  static components = { b: WidgetB };
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("basic widget properties", () => {
  test("props is properly defined", async () => {
    const widget = new Widget(env);
    expect(widget.props).toEqual({});
  });

  test("has no el after creation", async () => {
    const widget = new Widget(env);
    expect(widget.el).toBe(null);
  });

  test("can be mounted", async () => {
    class SomeWidget extends Component<any, any> {
      static template = xml`<div>content</div>`;
    }
    const widget = new SomeWidget(env);
    widget.mount(fixture);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>content</div>");
  });

  test("crashes if it cannot find a template", async () => {
    expect.assertions(1);
    class SomeWidget extends Component<any, any> {}
    try {
      new SomeWidget(env);
    } catch (e) {
      expect(e.message).toBe('Could not find template for component "SomeWidget"');
    }
  });

  test("can be clicked on and updated", async () => {
    const counter = new Counter(env);
    counter.mount(fixture);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<button>Inc</button></div>");
  });

  test("cannot be clicked on and updated if not in DOM", async () => {
    const counter = new Counter(env);
    const target = document.createElement("div");
    await counter.mount(target);
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    button.click();
    await nextTick();
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    expect(counter.state.counter).toBe(1);
  });

  test("widget style and classname", async () => {
    class StyledWidget extends Widget {
      static template = xml`
        <div style="font-weight:bold;" class="some-class">world</div>
      `;
    }
    const widget = new StyledWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div style="font-weight:bold;" class="some-class">world</div>`);
  });

  test("changing state before first render does not trigger a render", async () => {
    const steps: string[] = [];
    class TestW extends Widget {
      state = useState({ drinks: 1 });
      async willStart() {
        this.state.drinks++;
      }
      async __render(f) {
        steps.push("__render");
        return super.__render(f);
      }
      mounted() {
        steps.push("mounted");
      }
      patched() {
        steps.push("patched");
      }
    }
    const widget = new TestW(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["__render", "mounted"]);
  });

  test("changing state before first render does not trigger a render (with parent)", async () => {
    const steps: string[] = [];
    class TestW extends Component<any, any> {
      static template = xml`<span>W</span>`;
      state = useState({ drinks: 1 });
      async willStart() {
        this.state.drinks++;
      }
      async __render(f) {
        steps.push("__render");
        return super.__render(f);
      }
      mounted() {
        steps.push("mounted");
      }
      patched() {
        steps.push("patched");
      }
    }
    class Parent extends Component<any, any> {
      state = useState({ flag: false });
      static components = { TestW };
      static template = xml`<div><TestW t-if="state.flag"/></div>`;
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps).toEqual([]);

    parent.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>W</span></div>");
    expect(steps).toEqual(["__render", "mounted"]);
  });

  test("render method wait until rendering is done", async () => {
    class TestW extends Component<any, any> {
      static template = xml`<div><t t-esc="state.drinks"/></div>`;
      state = { drinks: 1 };
    }
    const widget = new TestW(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");

    widget.state.drinks = 2;

    const renderPromise = widget.render();
    expect(fixture.innerHTML).toBe("<div>1</div>");
    await renderPromise;
    expect(fixture.innerHTML).toBe("<div>2</div>");
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
    widget.render(); // FIXME?
    expect(fixture.innerHTML).toBe(`<div><span></span></div>`);
  });

  test("reconciliation alg is not confused in some specific situation", async () => {
    // in this test, we set t-key to 4 because it was in conflict with the
    // template id corresponding to the first child.
    class Child extends Component<any, any> {
      static template = xml`<span>child</span>`;
    }

    class Parent extends Component<any, any> {
      static template = xml`
        <div>
            <Child />
            <Child t-key="4"/>
        </div>
      `;
      static components = { Child };
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>child</span><span>child</span></div>");
  });

  test("reconciliation alg works for t-foreach in t-foreach", async () => {
    const warn = console.warn;
    console.warn = () => {};
    class Child extends Component<any, any> {
      static template = xml`<div><t t-esc="props.blip"/></div>`;
    }

    class Parent extends Component<any, any> {
      static template = xml`
        <div>
            <t t-foreach="state.s" t-as="section">
                <t t-foreach="section.blips" t-as="blip">
                  <Child blip="blip"/>
                </t>
            </t>
        </div>`;
      static components = { Child };
      state = { s: [{ blips: ["a1", "a2"] }, { blips: ["b1"] }] };
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>a1</div><div>a2</div><div>b1</div></div>");
    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
    console.warn = warn;
  });

  test("same t-keys in two different places", async () => {
    class Child extends Component<any, any> {
      static template = xml`<span><t t-esc="props.blip"/></span>`;
    }

    class Parent extends Component<any, any> {
      static template = xml`
        <div>
            <div><Child t-key="1" blip="'1'"/></div>
            <div><Child t-key="1" blip="'2'"/></div>
        </div>`;
      static components = { Child };
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>1</span></div><div><span>2</span></div></div>");
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
    class ChildWidget extends Widget {
      async willStart() {
        ok = true;
      }
    }

    class ParentWidget extends Widget {
      static template = xml`<div><t t-component="child"/></div>`;
      static components = { child: ChildWidget };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(ok).toBe(true);
  });

  test("mounted hook is called on subcomponents, in proper order", async () => {
    const steps: any[] = [];

    class ChildWidget extends Widget {
      mounted() {
        expect(document.body.contains(this.el)).toBe(true);
        steps.push("child:mounted");
      }
    }

    class ParentWidget extends Widget {
      static template = xml`<div><ChildWidget /></div>`;
      static components = { ChildWidget };
      mounted() {
        steps.push("parent:mounted");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["child:mounted", "parent:mounted"]);
  });

  test("mounted hook is called on subsubcomponents, in proper order", async () => {
    const steps: any[] = [];

    class ChildChildWidget extends Widget {
      mounted() {
        steps.push("childchild:mounted");
      }
      willUnmount() {
        steps.push("childchild:willUnmount");
      }
    }

    class ChildWidget extends Widget {
      static template = xml`<div><t t-component="childchild"/></div>`;
      static components = { childchild: ChildChildWidget };
      mounted() {
        steps.push("child:mounted");
      }
      willUnmount() {
        steps.push("child:willUnmount");
      }
    }

    class ParentWidget extends Widget {
      static template = xml`<div><t t-if="state.flag"><t t-component="child"/></t></div>`;
      static components = { child: ChildWidget };
      state = useState({ flag: false });
      mounted() {
        steps.push("parent:mounted");
      }
      willUnmount() {
        steps.push("parent:willUnmount");
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

  test("willPatch, patched hook are called on subsubcomponents, in proper order", async () => {
    const steps: any[] = [];

    env.qweb.addTemplate("ChildWidget", `<div><t t-component="childchild" n="props.n"/></div>`);
    env.qweb.addTemplate("ChildChildWidget", `<div><t t-esc="props.n"/></div>`);

    class ChildChildWidget extends Widget {
      willPatch() {
        steps.push("childchild:willPatch");
      }
      patched() {
        steps.push("childchild:patched");
      }
    }
    class ChildWidget extends Widget {
      static components = { childchild: ChildChildWidget };
      willPatch() {
        steps.push("child:willPatch");
      }
      patched() {
        steps.push("child:patched");
      }
    }

    env.qweb.addTemplate("ParentWidget", `<div><t t-component="child" n="state.n"/></div>`);
    class ParentWidget extends Widget {
      static components = { child: ChildWidget };
      state = useState({ n: 1 });
      willPatch() {
        steps.push("parent:willPatch");
      }
      patched() {
        steps.push("parent:patched");
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
              <t t-component="child"/>
            </t>
            <t t-else="1">
              <div/>
            </t>
          </div>`
    );
    class ChildWidget extends Widget {
      async willStart() {
        steps.push("child:willStart");
      }
      mounted() {
        steps.push("child:mounted");
      }
    }
    class ParentWidget extends Widget {
      state = useState({ ok: false });
      static components = { child: ChildWidget };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual([]);
    widget.state.ok = true;
    await nextTick();
    expect(steps).toEqual(["child:willStart", "child:mounted"]);
  });

  test("mounted hook is correctly called on subcomponents created in mounted hook", async () => {
    // the issue here is that the parent widget creates in the
    // mounted hook a new widget, which means that it modifies
    // in place its list of children. But this list of children is currently
    // being visited, so the mount action of the parent could cause a mount
    // action of the new child widget, even though it is not ready yet.
    expect.assertions(1);
    class ParentWidget extends Widget {
      mounted() {
        const child = new ChildWidget(this);
        child.mount(this.el!);
      }
    }
    class ChildWidget extends Widget {
      mounted() {
        expect(this.el).toBeTruthy();
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture); // wait for ParentWidget
    await nextTick(); // wait for ChildWidget
  });

  test("components are unmounted and destroyed if no longer in DOM", async () => {
    let steps: string[] = [];

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
    class ParentWidget extends Widget {
      static template = xml`
        <div>
          <t t-if="state.ok"><ChildWidget /></t>
        </div>
      `;
      static components = { ChildWidget };
      state = useState({ ok: true });
    }

    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["init", "willstart", "mounted"]);
    widget.state.ok = false;
    await nextTick();
    expect(steps).toEqual(["init", "willstart", "mounted", "willunmount"]);
  });

  test("components are unmounted and destroyed if no longer in DOM, even after updateprops", async () => {
    let childUnmounted = false;

    class ChildWidget extends Widget {
      static template = xml`<span><t t-esc="props.n"/></span>`;
      willUnmount() {
        childUnmounted = true;
      }
    }

    class ParentWidget extends Widget {
      static template = xml`
        <div>
          <div t-if="state.flag">
            <ChildWidget n="state.n"/>
          </div>
        </div>
      `;
      static components = { ChildWidget };
      state = useState({ n: 0, flag: true });
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
    class ParentWidget extends Widget {
      static template = xml`<div><t t-component="child"/></div>`;
      static components = { child: ChildWidget };
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
    env.qweb.addTemplate("Parent", '<span><Child n="state.n"/></span>');
    class HookWidget extends Widget {
      willUpdateProps(nextProps) {
        expect(nextProps.n).toBe(2);
        return def;
      }
    }
    class Parent extends Widget {
      state = useState({ n: 1 });
      static components = { Child: HookWidget };
    }
    env.qweb.addTemplate("HookWidget", '<span><t t-esc="props.n"/></span>');
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
      state = useState({ a: 1 });

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

    class TestWidget extends Widget {
      patched() {
        n++;
      }
    }
    class Parent extends Widget {
      static template = xml`<div><Child a="state.a"/></div>`;
      state = useState({ a: 1 });
      static components = { Child: TestWidget };
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(n).toBe(0);

    widget.state.a = 2;
    await nextTick();
    expect(n).toBe(1);
  });

  test("shouldUpdate hook prevent rerendering", async () => {
    let shouldUpdate = false;
    class TestWidget extends Widget {
      static template = xml`<div><t t-esc="props.val"/></div>`;
      shouldUpdate() {
        return shouldUpdate;
      }
    }
    class Parent extends Widget {
      static template = xml`<div><Child val="state.val"/></div>`;
      static components = { Child: TestWidget };
      state = useState({ val: 42 });
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

    class ChildWidget extends Widget {
      constructor(parent, props) {
        super(parent, props);
        created = true;
      }
      mounted() {
        mounted = true;
      }
    }
    class ParentWidget extends Widget {
      static template = xml`
        <div>
          <t t-if="state.flag">
            <div><t t-component="child"/></div>
          </t>
        </div>
      `;
      static components = { child: ChildWidget };
      state = useState({ flag: false });
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

    class ChildWidget extends Widget {
      willPatch() {
        steps.push("child:willPatch");
      }
      patched() {
        steps.push("child:patched");
      }
    }
    class ParentWidget extends Widget {
      static template = xml`
        <div>
          <t t-component="child" v="state.n"/>
        </div>
      `;
      static components = { child: ChildWidget };
      state = useState({ n: 1 });
      willPatch() {
        steps.push("parent:willPatch");
      }
      patched() {
        steps.push("parent:patched");
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
    class ParentWidget extends Widget {
      static template = xml`
        <div>
          <ChildWidget t-if="state.flag" v="state.n" t-keepalive="1"/>
        </div>
      `;
      static components = { ChildWidget };
      state = useState({ n: 1, flag: true });
    }

    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(env.qweb.templates[ParentWidget.template].fn.toString()).toMatchSnapshot();
    expect(steps).toEqual(["child:mounted"]);
    widget.state.flag = false;
    await nextTick();
    expect(steps).toEqual(["child:mounted", "child:willUnmount"]);
    widget.state.flag = true;
    await nextTick();
    expect(steps).toEqual(["child:mounted", "child:willUnmount", "child:mounted"]);
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

  test("destroying a widget before being mounted", async () => {
    class GrandChild extends Component<any, any> {
      static template = xml`
        <span>
          <t t-esc="props.val.val"/>
        </span>
      `;
    }
    class Child extends Component<any, any> {
      static template = xml`
        <span>
          <GrandChild t-if="state.flag" val="something"/>
          <button t-on-click="doSomething">click</button>
        </span>
      `;
      static components = { GrandChild };
      state = useState({ val: 33, flag: false });
      doSomething() {
        this.state.val = 12;
        this.state.flag = true;
        this.trigger("some-event");
      }
      get something() {
        return { val: this.state.val };
      }
    }
    class Parent extends Component<any, any> {
      static template = xml`
        <div t-on-some-event="doStuff">
          <Child />
        </div>
      `;
      static components = { Child };
      state = useState({ p: 1 });
      doStuff() {
        this.state.p = 2;
      }
    }

    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span><button>click</button></span></div>");
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span><span>12</span><button>click</button></span></div>");
  });
});

describe("composition", () => {
  test("a widget with a sub widget", async () => {
    const widget = new WidgetA(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hello<div>world</div></div>");
    expect(children(widget)[0].__owl__.parent).toBe(widget);
  });

  test("can use components from the global registry", async () => {
    QWeb.registerComponent("WidgetB", WidgetB);
    env.qweb.addTemplate("ParentWidget", `<div><t t-component="WidgetB"/></div>`);
    class ParentWidget extends Widget {}
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>world</div></div>");
    delete QWeb.components["WidgetB"];
  });

  test("can use dynamic components (the class) if given", async () => {
    class A extends Component<any, any> {
      static template = xml`<span>child a</span>`;
    }
    class B extends Component<any, any> {
      static template = xml`<span>child b</span>`;
    }
    class App extends Component<any, any> {
      static template = xml`<t t-component="myComponent" t-key="state.child"/>`;
      state = useState({
        child: "a"
      });
      get myComponent() {
        return this.state.child === "a" ? A : B;
      }
    }
    const widget = new App(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>child a</span>");
    widget.state.child = "b";
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>child b</span>");
  });

  test("can use dynamic components (the class) if given (with different root tagname)", async () => {
    class A extends Component<any, any> {
      static template = xml`<span>child a</span>`;
    }
    class B extends Component<any, any> {
      static template = xml`<div>child b</div>`;
    }
    class App extends Component<any, any> {
      static template = xml`<t t-component="myComponent" t-key="state.child"/>`;
      state = useState({
        child: "a"
      });
      get myComponent() {
        return this.state.child === "a" ? A : B;
      }
    }
    const widget = new App(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>child a</span>");
    widget.state.child = "b";
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>child b</div>");
  });

  test("don't fallback to global registry if widget defined locally", async () => {
    QWeb.registerComponent("WidgetB", WidgetB); // should not use this widget
    env.qweb.addTemplate("ParentWidget", `<div><t t-component="WidgetB"/></div>`);
    env.qweb.addTemplate("AnotherWidgetB", `<span>Belgium</span>`);
    class AnotherWidgetB extends Widget {}
    class ParentWidget extends Widget {
      static components = { WidgetB: AnotherWidgetB };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>Belgium</span></div>");
    delete QWeb.components["WidgetB"];
  });

  test("can define components in template without t-component", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="P"><C a="1"/></div>
        <span t-name="C"><t t-esc="props.a"/></span>
      </templates>`);
    class C extends Widget {}
    class P extends Widget {
      static components = { C };
    }
    const parent = new P(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
  });

  test("display a nice error if it cannot find component", async () => {
    const consoleError = console.error;
    console.error = jest.fn();

    env.qweb.addTemplate("Parent", `<div><SomeMispelledWidget /></div>`);
    class Parent extends Widget {
      static components = { SomeWidget: Widget };
    }
    const parent = new Parent(env);
    let error;
    try {
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe('Cannot find the definition of component "SomeMispelledWidget"');
    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("t-refs on widget are components", async () => {
    class WidgetC extends Widget {
      static template = xml`<div>Hello<WidgetB t-ref="mywidgetb" /></div>`;
      static components = { WidgetB };
      widget = useRef("mywidgetb");
    }

    const widget = new WidgetC(env);
    await widget.mount(fixture);
    expect(widget.widget.comp).toBeInstanceOf(WidgetB);
  });

  test("t-refs are bound at proper timing", async () => {
    expect.assertions(2);
    class ParentWidget extends Widget {
      static template = xml`
        <div>
          <t t-foreach="state.list" t-as="elem" t-ref="child" t-key="elem" t-component="Widget"/>
        </div>
      `;
      static components = { Widget };
      state = useState({ list: <any>[] });
      child = useRef("child");
      willPatch() {
        expect(this.child.comp).toBeNull();
      }
      patched() {
        expect(this.child.comp).not.toBeNull();
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
          <t t-if="state.child1" t-ref="child1" t-component="Widget"/>
          <t t-if="state.child2" t-ref="child2" t-component="Widget"/>
        </div>`
    );
    class ParentWidget extends Widget {
      static components = { Widget };
      state = useState({ child1: true, child2: false });
      child1 = useRef("child1");
      child2 = useRef("child2");
      count = 0;
      mounted() {
        expect(this.child1.comp).toBeDefined();
        expect(this.child2.comp).toBeNull();
      }
      willPatch() {
        if (this.count === 0) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeNull();
        }
        if (this.count === 1) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeDefined();
        }
      }
      patched() {
        if (this.count === 0) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeDefined();
        }
        if (this.count === 1) {
          expect(this.child1.comp).toBeNull();
          expect(this.child2.comp).toBeDefined();
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
    env.qweb.addTemplate("ParentWidget", `<div><t t-component="Counter"/></div>`);
    class ParentWidget extends Widget {
      static components = { Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>0<button>Inc</button></div></div>");
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>1<button>Inc</button></div></div>");
  });

  test("refs in a loop", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div>
        <t t-foreach="state.items" t-as="item">
          <t t-component="Child" t-ref="{{item}}" t-key="item"/>
        </t>
      </div>`
    );
    class ParentWidget extends Widget {
      static components = { Child: Widget };
      elem1 = useRef("1");
      elem2 = useRef("2");
      elem3 = useRef("3");
      elem4 = useRef("4");
      state = useState({ items: [1, 2, 3] });
    }
    const parent = new ParentWidget(env);
    await parent.mount(fixture);
    expect(parent.elem1.comp).toBeDefined();
    expect(parent.elem2.comp).toBeDefined();
    expect(parent.elem3.comp).toBeDefined();
    expect(parent.elem4.comp).toBeNull();
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

  test("parent env is propagated to child components", async () => {
    const widget = new WidgetA(env);
    await widget.mount(fixture);

    expect(children(widget)[0].env).toBe(env);
  });

  test("rerendering a widget with a sub widget", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-component="Counter"/></div>`);
    class ParentWidget extends Widget {
      static components = { Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>1<button>Inc</button></div></div>");
    await widget.render();
    expect(fixture.innerHTML).toBe("<div><div>1<button>Inc</button></div></div>");
  });

  test("sub components are destroyed if no longer in dom, then recreated", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-if="state.ok"><Counter /></t></div>`);
    class ParentWidget extends Widget {
      state = useState({ ok: true });
      static components = { Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>1<button>Inc</button></div></div>");
    widget.state.ok = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    widget.state.ok = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>0<button>Inc</button></div></div>");
  });

  test("sub components with t-keepalive are not destroyed if no longer in dom", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-if="state.ok"><Counter t-keepalive="1"/></t></div>`
    );
    class ParentWidget extends Widget {
      state = useState({ ok: true });
      static components = { Counter };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    const button = fixture.getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>1<button>Inc</button></div></div>");
    const counter = children(widget)[0];
    expect(counter.__owl__.isMounted).toBe(true);

    widget.state.ok = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(counter.__owl__.isMounted).toBe(false);

    widget.state.ok = true;
    await nextTick();
    expect(counter.__owl__.isMounted).toBe(true);
    expect(fixture.innerHTML).toBe("<div><div>1<button>Inc</button></div></div>");
  });

  test("sub components dom state with t-keepalive is preserved", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div><t t-if="state.ok"><InputWidget t-keepalive="1"/></t></div>`
    );
    class InputWidget extends Widget {}
    class ParentWidget extends Widget {
      state = useState({ ok: true });
      static components = { InputWidget };
    }
    env.qweb.addTemplate("InputWidget", "<input/>");
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
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("sub widget with t-ref and t-keepalive", async () => {
    class ChildWidget extends Widget {
      static template = xml`<span>Hello</span>`;
    }
    class ParentWidget extends Widget {
      static template = xml`
            <div>
                <t t-if="state.ok"><ChildWidget t-ref="child" t-keepalive="1"/></t>
            </div>
        `;
      static components = { ChildWidget };
      state = useState({ ok: true });
      child = useRef("child");
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    let child = children(widget)[0];

    expect(fixture.innerHTML).toBe("<div><span>Hello</span></div>");
    expect(widget.child.comp).toEqual(child);

    widget.state.ok = false;
    await nextTick();

    expect(fixture.innerHTML).toBe("<div></div>");
    expect(widget.child.comp).toEqual(child);

    widget.state.ok = true;
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><span>Hello</span></div>");
    expect(widget.child.comp).toEqual(child);
  });

  test("sub components rendered in a loop", async () => {
    env.qweb.addTemplate("ChildWidget", `<span><t t-esc="props.n"/></span>`);
    class ChildWidget extends Widget {}

    env.qweb.addTemplate(
      "Parent",
      `
        <div>
          <t t-foreach="state.numbers" t-as="number">
            <t t-component="ChildWidget" t-key="number" n="number"/>
          </t>
        </div>`
    );
    class Parent extends Widget {
      state = useState({
        numbers: [1, 2, 3]
      });
      static components = { ChildWidget };
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

  test("sub components with some state rendered in a loop", async () => {
    let n = 1;
    env.qweb.addTemplate("ChildWidget", `<span><t t-esc="state.n"/></span>`);
    class ChildWidget extends Widget {
      state: any;
      constructor(parent) {
        super(parent);
        this.state = useState({ n });
        n++;
      }
    }

    env.qweb.addTemplate(
      "parent",
      `<div>
          <t t-foreach="state.numbers" t-as="number">
            <t t-component="ChildWidget" t-key="number"/>
          </t>
        </div>`
    );
    class Parent extends Widget {
      static template = "parent";
      state = useState({
        numbers: [1, 2, 3]
      });
      static components = { ChildWidget };
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

  test("sub components between t-ifs", async () => {
    // this confuses the patching algorithm...
    class ChildWidget extends Widget {
      static template = xml`<span>child</span>`;
    }

    class Parent extends Widget {
      static template = xml`
        <div>
          <h1 t-if="state.flag">hey</h1>
          <h2 t-else="1">noo</h2>
          <span><ChildWidget/></span>
          <t t-if="state.flag"><span>test</span></t>
        </div>`;
      static components = { ChildWidget };
      state = useState({ flag: false });
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    const child = children(parent)[0];
    expect(normalize(fixture.innerHTML)).toBe(
      normalize(`
        <div>
          <h2>noo</h2>
          <span><span>child</span></span>
        </div>
      `)
    );

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

  test("list of sub components inside other nodes", async () => {
    // this confuses the patching algorithm...
    env.qweb.addTemplate("ChildWidget", `<span>child</span>`);

    env.qweb.addTemplates(`
        <templates>
            <div t-name="Parent">
                <div t-foreach="state.blips" t-as="blip" t-key="blip.id">
                    <SubWidget />
                </div>
            </div>
            <span t-name="SubWidget">asdf</span>
        </templates>`);

    class SubWidget extends Widget {}
    class Parent extends Widget {
      static components = { SubWidget };
      state = useState({ blips: [{ a: "a", id: 1 }, { b: "b", id: 2 }, { c: "c", id: 4 }] });
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div><span>asdf</span></div><div><span>asdf</span></div><div><span>asdf</span></div></div>"
    );
    parent.state.blips.splice(0, 1);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>asdf</span></div><div><span>asdf</span></div></div>"
    );
  });

  test("list of two sub components inside other nodes", async () => {
    // this confuses the patching algorithm...
    env.qweb.addTemplate("ChildWidget", `<span>child</span>`);

    env.qweb.addTemplates(`
        <templates>
            <div t-name="Parent">
                <div t-foreach="state.blips" t-as="blip" t-key="blip.id">
                    <SubWidget />
                    <SubWidget />
                </div>
            </div>
            <span t-name="SubWidget">asdf</span>
        </templates>`);

    class SubWidget extends Widget {}
    class Parent extends Widget {
      static components = { SubWidget };
      state = useState({ blips: [{ a: "a", id: 1 }] });
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>asdf</span><span>asdf</span></div></div>");
  });

  test("t-component with dynamic value", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-component="{{state.widget}}"/></div>`);
    class ParentWidget extends Widget {
      static components = { WidgetB };
      state = useState({ widget: "WidgetB" });
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>world</div></div>");
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-component with dynamic value 2", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-component="Widget{{state.widget}}"/></div>`);
    class ParentWidget extends Widget {
      static components = { WidgetB };
      state = useState({ widget: "B" });
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>world</div></div>");
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("sub components, loops, and shouldUpdate", async () => {
    class ChildWidget extends Component<any, any> {
      static template = xml`<span><t t-esc="props.val"/></span>`;
      shouldUpdate(nextProps) {
        if (nextProps.val === 12) {
          return false;
        }
        return true;
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`
          <div>
            <t t-foreach="state.records" t-as="record">
              <ChildWidget t-key="record.id" val="record.val"/>
            </t>
          </div>`;
      state = useState({
        records: [{ id: 1, val: 1 }, { id: 2, val: 2 }, { id: 3, val: 3 }]
      });
      static components = { ChildWidget };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(normalize(fixture.innerHTML)).toBe(
      "<div><span>1</span><span>2</span><span>3</span></div>"
    );

    parent.state.records[0].val = 11;
    parent.state.records[1].val = 12;
    parent.state.records[2].val = 13;
    await nextTick();
    expect(normalize(fixture.innerHTML)).toBe(
      "<div><span>11</span><span>2</span><span>13</span></div>"
    );
  });
});

describe("props evaluation ", () => {
  test("explicit object prop", async () => {
    env.qweb.addTemplate("Parent", `<div><t t-component="child" value="state.val"/></div>`);
    class Child extends Widget {
      state: { someval: number };
      constructor(parent: Parent, props: { value: number }) {
        super(parent);
        this.state = useState({ someval: props.value });
      }
    }
    class Parent extends Widget {
      static components = { child: Child };
      state = useState({ val: 42 });
    }

    env.qweb.addTemplate("Child", `<span><t t-esc="state.someval"/></span>`);

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("accept ES6-like syntax for props (with getters)", async () => {
    env.qweb.addTemplate("Child", `<span><t t-esc="props.greetings"/></span>`);
    class Child extends Widget {}

    env.qweb.addTemplate("Parent", `<div><t t-component="child" greetings="greetings"/></div>`);
    class Parent extends Widget {
      static components = { child: Child };
      get greetings() {
        return `hello ${this.props.name}`;
      }
    }
    const widget = new Parent(env, { name: "aaron" });
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>hello aaron</span></div>");
  });

  test("t-set works ", async () => {
    class Child extends Widget {}
    env.qweb.addTemplate(
      "Parent",
      `
        <div>
          <t t-set="val" t-value="42"/>
          <t t-component="child" val="val"/>
        </div>`
    );
    class Parent extends Widget {
      static components = { child: Child };
    }
    env.qweb.addTemplate(
      "Child",
      `
        <span>
          <t t-esc="props.val"/>
        </span>`
    );

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(normalize(fixture.innerHTML)).toBe("<div><span>42</span></div>");
  });
});

describe("class and style attributes with t-component", () => {
  test("class is properly added on widget root el", async () => {
    class Child extends Widget {
      static template = xml`<div class="c"/>`;
    }
    class ParentWidget extends Widget {
      static template = xml`<div><Child class="a b"/></div>`;
      static components = { Child };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="c a b"></div></div>`);
  });

  test("t-att-class is properly added/removed on widget root el", async () => {
    class Child extends Widget {
      static template = xml`<div class="c"/>`;
    }
    class ParentWidget extends Widget {
      static template = xml`<div><Child t-att-class="{a:state.a, b:state.b}"/></div>`;
      static components = { Child };
      state = useState({ a: true, b: false });
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="c a"></div></div>`);
    expect(QWeb.TEMPLATES[ParentWidget.template].fn.toString());

    widget.state.a = false;
    widget.state.b = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div><div class="c b"></div></div>`);
  });

  test("class with extra whitespaces", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div>
            <Child class="a  b c   d"/>
      </div>`
    );
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { Child };
    }
    env.qweb.addTemplate("Child", `<div/>`);
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="a b c d"></div></div>`);
  });

  test("t-att-class is properly added/removed on widget root el (v2)", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget">
          <Child class="a" t-att-class="{ b: state.b }" t-ref="child"/>
        </div>
        <span t-name="Child" class="c" t-att-class="{ d: state.d }"/>
      </templates>`);

    class Child extends Widget {
      state = useState({ d: true });
    }
    class ParentWidget extends Widget {
      static components = { Child };
      state = useState({ b: true });
      child = useRef("child");
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    const span = fixture.querySelector("span")!;
    expect(span.className).toBe("c d a b");

    widget.state.b = false;
    await nextTick();
    expect(span.className).toBe("c d a");

    (widget.child.comp as Child).state.d = false;
    await nextTick();
    expect(span.className).toBe("c a");

    widget.state.b = true;
    await nextTick();
    expect(span.className).toBe("c a b");

    (widget.child.comp as Child).state.d = true;
    await nextTick();
    expect(span.className).toBe("c a b d");
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.Child.fn.toString()).toMatchSnapshot();
  });

  test("t-att-class is properly added/removed on widget root el (v3)", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget">
          <Child class="a" t-att-class="state.b ? 'b' : ''" t-ref="child"/>
        </div>
        <span t-name="Child" class="c" t-att-class="state.d ? 'd' : ''"/>
      </templates>`);

    class Child extends Widget {
      state = useState({ d: true });
    }
    class ParentWidget extends Widget {
      static components = { Child };
      state = useState({ b: true });
      child = useRef("child");
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    const span = fixture.querySelector("span")!;
    expect(span.className).toBe("c d a b");

    widget.state.b = false;
    await nextTick();
    expect(span.className).toBe("c d a");

    (widget.child.comp as Child).state.d = false;
    await nextTick();
    expect(span.className).toBe("c a");

    widget.state.b = true;
    await nextTick();
    expect(span.className).toBe("c a b");

    (widget.child.comp as Child).state.d = true;
    await nextTick();
    expect(span.className).toBe("c a b d");
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.Child.fn.toString()).toMatchSnapshot();
  });

  test("class on components do not interfere with user defined classes", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="App" t-att-class="{ c: state.c }" />
      </templates>`);

    class App extends Widget {
      state = useState({ c: true });
      mounted() {
        this.el!.classList.add("user");
      }
    }

    const widget = new App(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe('<div class="c user"></div>');

    widget.state.c = false;
    await nextTick();

    expect(fixture.innerHTML).toBe('<div class="user"></div>');
  });

  test("style is properly added on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
            <t t-component="child" style="font-weight: bold;"/>
        </div>`
    );
    class ParentWidget extends Widget {
      static components = { child: Widget };
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div style="font-weight: bold;"></div></div>`);
  });

  test("dynamic t-att-style is properly added and updated on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
            <t t-component="child" t-att-style="state.style"/>
        </div>`
    );
    class ParentWidget extends Widget {
      static components = { child: Widget };
      state = useState({ style: "font-size: 20px" });
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();

    expect(fixture.innerHTML).toBe(`<div><div style="font-size: 20px;"></div></div>`);

    widget.state.style = "font-size: 30px";
    await nextTick();

    expect(fixture.innerHTML).toBe(`<div><div style="font-size: 30px;"></div></div>`);
  });
});

describe("other directives with t-component", () => {
  test("t-on works as expected", async () => {
    expect.assertions(4);
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget"><t t-component="child" t-on-custom-event="someMethod"/></div>
      </templates>
    `);
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      n = 0;
      someMethod(ev) {
        expect(ev.detail).toBe(43);
        this.n++;
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    let child = children(widget)[0];
    expect(widget.n).toBe(0);
    child.trigger("custom-event", 43);
    expect(widget.n).toBe(1);
    child.destroy();
    child.trigger("custom-event", 43);
    expect(widget.n).toBe(1);
  });

  test("t-on with handler bound to argument", async () => {
    expect.assertions(3);
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget"><t t-component="child" t-on-ev="onEv(3)"/></div>
      </templates>
    `);
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      onEv(n, ev) {
        expect(n).toBe(3);
        expect(ev.detail).toBe(43);
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    let child = children(widget)[0];
    child.trigger("ev", 43);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with handler bound to object", async () => {
    expect.assertions(3);
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget"><t t-component="child" t-on-ev="onEv({val: 3})"/></div>
      </templates>
    `);
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      onEv(o, ev) {
        expect(o).toEqual({ val: 3 });
        expect(ev.detail).toBe(43);
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    let child = children(widget)[0];
    child.trigger("ev", 43);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with handler bound to empty object", async () => {
    expect.assertions(3);
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget"><t t-component="child" t-on-ev="onEv({})"/></div>
      </templates>
    `);
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      onEv(o, ev) {
        expect(o).toEqual({});
        expect(ev.detail).toBe(43);
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    let child = children(widget)[0];
    child.trigger("ev", 43);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with handler bound to empty object (with non empty inner string)", async () => {
    expect.assertions(3);
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget"><t t-component="child" t-on-ev="onEv({  })"/></div>
      </templates>
    `);
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      onEv(o, ev) {
        expect(o).toEqual({});
        expect(ev.detail).toBe(43);
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    let child = children(widget)[0];
    child.trigger("ev", 43);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with stop and/or prevent modifiers", async () => {
    expect.assertions(7);
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget">
          <t t-component="child"
           t-on-ev-1.stop="onEv1"
           t-on-ev-2.prevent="onEv2"
           t-on-ev-3.stop.prevent="onEv3"/>
        </div>
      </templates>
    `);
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      onEv1(ev) {
        expect(ev.defaultPrevented).toBe(false);
        expect(ev.cancelBubble).toBe(true);
      }
      onEv2(ev) {
        expect(ev.defaultPrevented).toBe(true);
        expect(ev.cancelBubble).toBe(false);
      }
      onEv3(ev) {
        expect(ev.defaultPrevented).toBe(true);
        expect(ev.cancelBubble).toBe(true);
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    const child = children(widget)[0];
    child.trigger("ev-1");
    child.trigger("ev-2");
    child.trigger("ev-3");
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with self modifier", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget">
          <t t-component="child" t-on-ev-1="onEv1" t-on-ev-2.self="onEv2"/>
        </div>
        <div t-name="Child"><t t-component="child"/></div>
      </templates>
    `);
    const steps: string[] = [];
    class GrandChild extends Widget {}
    class Child extends Widget {
      static components = { child: GrandChild };
    }
    class ParentWidget extends Widget {
      static components = { child: Child };
      onEv1(ev) {
        steps.push("onEv1");
      }
      onEv2(ev) {
        steps.push("onEv2");
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    const child = children(widget)[0];
    const grandChild = children(child)[0];
    child.trigger("ev-1");
    child.trigger("ev-2");
    expect(steps).toEqual(["onEv1", "onEv2"]);
    grandChild.trigger("ev-1");
    grandChild.trigger("ev-2");
    expect(steps).toEqual(["onEv1", "onEv2", "onEv1"]);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with self and prevent modifiers (order matters)", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget">
          <t t-component="child" t-on-ev.self.prevent="onEv"/>
        </div>
        <div t-name="Child"><t t-component="child"/></div>
      </templates>
    `);
    const steps: boolean[] = [];
    class GrandChild extends Widget {}
    class Child extends Widget {
      static components = { child: GrandChild };
    }
    class ParentWidget extends Widget {
      static components = { child: Child };
      onEv() {}
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    (<HTMLElement>fixture).addEventListener("ev", function(e) {
      steps.push(e.defaultPrevented);
    });

    const child = children(widget)[0];
    const grandChild = children(child)[0];
    child.trigger("ev");
    grandChild.trigger("ev");
    expect(steps).toEqual([true, false]);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with prevent and self modifiers (order matters)", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget">
          <Child t-on-ev.prevent.self="onEv"/>
        </div>
        <div t-name="Child"><GrandChild/></div>
      </templates>
    `);
    const steps: boolean[] = [];
    class GrandChild extends Widget {}
    class Child extends Widget {
      static components = { GrandChild };
    }
    class ParentWidget extends Widget {
      static components = { Child };
      onEv() {}
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    (<HTMLElement>fixture).addEventListener("ev", function(e) {
      steps.push(e.defaultPrevented);
    });

    const child = children(widget)[0];
    const grandChild = children(child)[0];
    child.trigger("ev");
    grandChild.trigger("ev");
    expect(steps).toEqual([true, true]);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("t-on with getter as handler", async () => {
    class Child extends Component<any, any> {
      static template = xml`<span></span>`;
    }
    class Parent extends Component<any, any> {
      static template = xml`
        <div>
          <t t-esc="state.counter"/>
          <Child t-on-ev="handler"/>
        </div>`;
      static components = { Child };
      state = useState({ counter: 0 });
      get handler() {
        this.state.counter++;
        return () => {};
      }
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
    expect(fixture.innerHTML).toBe("<div>0<span></span></div>");

    let child = children(parent)[0];
    child.trigger("ev");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<span></span></div>");
  });

  test("t-on with inline statement", async () => {
    class Child extends Component<any, any> {
      static template = xml`<span></span>`;
    }
    class Parent extends Component<any, any> {
      static template = xml`
        <div>
          <t t-esc="state.counter"/>
          <Child t-on-ev="state.counter++"/>
        </div>`;
      static components = { Child };
      state = useState({ counter: 0 });
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
    expect(fixture.innerHTML).toBe("<div>0<span></span></div>");

    let child = children(parent)[0];
    child.trigger("ev");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<span></span></div>");
  });

  test("t-on with no handler (only modifiers)", async () => {
    expect.assertions(2);
    class ComponentB extends Component<any, any> {
      static template = xml`<span></span>`;
    }
    class ComponentA extends Component<any, any> {
      static template = xml`<p><ComponentB t-on-ev.prevent=""/></p>`;
      static components = { ComponentB };
    }
    class Parent extends Component<any, any> {
      static template = xml`<div><ComponentA t-on-ev="onEv"/></div>`;
      static components = { ComponentA };
      onEv(ev) {
        expect(ev.defaultPrevented).toBe(true);
      }
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    let componentB = children(children(parent)[0])[0];
    componentB.trigger("ev");

    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
  });

  test("t-if works with t-component", async () => {
    env.qweb.addTemplate("ParentWidget", `<div><t t-component="child" t-if="state.flag"/></div>`);
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      state = useState({ flag: true });
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");

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

  test("t-else works with t-component", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <div t-if="state.flag">somediv</div>
          <t t-else="1" t-component="child"/>
        </div>`
    );
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      state = useState({ flag: true });
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");

    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(normalize(fixture.innerHTML)).toBe("<div><div>somediv</div></div>");

    widget.state.flag = false;
    await nextTick();
    expect(normalize(fixture.innerHTML)).toBe("<div><span>hey</span></div>");
  });

  test("t-elif works with t-component", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <div t-if="state.flag">somediv</div>
          <t t-elif="!state.flag" t-component="child"/>
        </div>`
    );
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      state = useState({ flag: true });
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");

    const widget = new ParentWidget(env);
    await widget.mount(fixture);

    expect(normalize(fixture.innerHTML)).toBe("<div><div>somediv</div></div>");

    widget.state.flag = false;
    await nextTick();
    expect(normalize(fixture.innerHTML)).toBe("<div><span>hey</span></div>");
  });

  test("t-else with empty string works with t-component", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
        <div>
          <div t-if="state.flag">somediv</div>
          <t t-else="" t-component="child"/>
        </div>`
    );
    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { child: Child };
      state = useState({ flag: true });
    }
    env.qweb.addTemplate("Child", "<span>hey</span>");

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
    // context with the inLoop variable, which is then used in the t-component
    // directive as a key
    env.qweb.addTemplate(
      "Test",
      `<div><t t-foreach="Array(2)">txt</t><t t-component="widget"/></div>`
    );
    class Test extends Widget {
      static components = { widget: Widget };
    }
    const widget = new Test(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>txttxt<div></div></div>");
  });

  test("t-on with handler bound to dynamic argument on a t-foreach", async () => {
    expect.assertions(3);
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ParentWidget">
          <t t-foreach="props.items" t-as="item">
            <Child t-key="item" t-on-ev="onEv(item)"/>
          </t>
        </div>
      </templates>
    `);
    const items = [1, 2, 3, 4];

    class Child extends Widget {}
    class ParentWidget extends Widget {
      static components = { Child };
      onEv(n, ev) {
        expect(n).toBe(1);
        expect(ev.detail).toBe(43);
      }
    }

    const widget = new ParentWidget(env, { items });
    await widget.mount(fixture);
    children(widget)[0].trigger("ev", 43);
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
  });

  test("updating widget immediately", async () => {
    // in this situation, we protect against a bug that occurred: because of the
    // interplay between components and vnodes, a sub widget vnode was patched
    // twice.
    env.qweb.addTemplate("Parent", `<div><t t-component="child" flag="state.flag"/></div>`);
    class Child extends Widget {}
    class Parent extends Widget {
      static components = { child: Child };
      state = useState({ flag: false });
    }

    env.qweb.addTemplate("Child", `<span>abc<t t-if="props.flag">def</t></span>`);

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
      `<div><t t-component="child" t-key="'somestring'" flag="state.flag"/></div>`
    );
    class Child extends Widget {}
    class Parent extends Widget {
      static components = { child: Child };
      state = useState({ flag: false });
    }

    env.qweb.addTemplate("Child", `<span>abc<t t-if="props.flag">def</t></span>`);

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
      __render(f) {
        steps.push(`${this.name}:render`);
        return super.__render(f);
      }
      __patch(vnode) {
        steps.push(`${this.name}:__patch`);
        super.__patch(vnode);
      }
      __mount(vnode, elm) {
        steps.push(`${this.name}:__patch(from __mount)`);
        return super.__mount(vnode, elm);
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
    env.qweb.addTemplate("B", `<div>B</div>`);
    class B extends TestWidget {
      name = "B";
      constructor(parent, props) {
        super(parent, props);
        steps.push("B:constructor");
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
    env.qweb.addTemplate(
      "C",
      `
        <div>C<D />
            <E t-if="state.flag" />
            <F t-else="!state.flag" />
        </div>`
    );
    class C extends TestWidget {
      static components = { D, E, F };
      name = "C";
      state = useState({ flag: true });

      constructor(parent, props) {
        super(parent, props);
        c = this;
        steps.push("C:constructor");
      }
    }
    env.qweb.addTemplate("A", `<div>A<B /><C /></div>`);
    class A extends TestWidget {
      static components = { B, C };
      name = "A";
    }

    const a = new A(env);
    await a.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div>A<div>B</div><div>C<div>D</div><div>E</div></div></div>`);
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
      "A:__patch",
      "B:__patch(from __mount)",
      "C:__patch(from __mount)",
      "D:__patch(from __mount)",
      "E:__patch(from __mount)",
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
      "C:__patch",
      "E:willUnmount",
      "E:destroy",
      "F:__patch(from __mount)",
      "F:mounted",
      "D:__patch",
      "D:patched",
      "C:patched"
    ]);
  });

  test("can inject values in tagged templates", async () => {
    const SUBTEMPLATE = xml`<span><t t-esc="state.n"/></span>`;
    class Parent extends Widget {
      static template = xml`<div><t t-call="${SUBTEMPLATE}"/></div>`;
      state = useState({ n: 42 });
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
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
    class Child extends Widget {
      static template = xml`<span>child:<t t-esc="props.val"/></span>`;
      constructor(parent, props) {
        super(parent, props);
        n++;
      }
      willStart(): Promise<void> {
        return def;
      }
    }
    class W extends Widget {
      static template = xml`<div><t t-if="state.val > 1"><Child val="state.val"/></t></div>`;
      static components = { Child };
      state = useState({ val: 1 });
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

  test("creating two async components, scenario 1", async () => {
    let defA = makeDeferred();
    let defB = makeDeferred();
    let nbRenderings: number = 0;

    class ChildA extends Component<any, any> {
      static template = xml`<span><t t-esc="getValue()"/></span>`;
      willStart(): Promise<void> {
        return defA;
      }
      getValue() {
        nbRenderings++;
        return "a";
      }
    }

    class ChildB extends Component<any, any> {
      static template = xml`<span>b</span>`;
      willStart(): Promise<void> {
        return defB;
      }
    }
    class Parent extends Component<any, any> {
      static template = xml`
        <div>
          <t t-if="state.flagA"><ChildA /></t>
          <t t-if="state.flagB"><ChildB /></t>
        </div>`;
      static components = { ChildA, ChildB };
      state = useState({ flagA: false, flagB: false });
    }
    const parent = new Parent(env);
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

    class ChildA extends Component<any, any> {
      static template = xml`<span>a<t t-esc="props.val"/></span>`;
      willUpdateProps(): Promise<void> {
        return defA;
      }
    }
    class ChildB extends Component<any, any> {
      static template = xml`<span>b<t t-esc="props.val"/></span>`;
      willStart(): Promise<void> {
        return defB;
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`
        <div>
          <ChildA val="state.valA"/>
          <t t-if="state.flagB"><ChildB val="state.valB"/></t>
        </div>`;
      static components = { ChildA, ChildB };
      state = useState({ valA: 1, valB: 2, flagB: false });
    }
    const parent = new Parent(env);
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

    class ChildA extends Component<any, any> {
      static template = xml`<span>a<t t-esc="props.val"/></span>`;
      willUpdateProps(): Promise<void> {
        return defA;
      }
    }
    class ChildB extends Component<any, any> {
      static template = xml`<span>b<t t-esc="props.val"/></span>`;
      willStart(): Promise<void> {
        return defB;
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`
        <div>
          <ChildA val="state.valA"/>
          <t t-if="state.flagB"><ChildB val="state.valB"/></t>
        </div>`;
      static components = { ChildA, ChildB };
      state = useState({ valA: 1, valB: 2, flagB: false });
    }
    const parent = new Parent(env);
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
    class ChildA extends Component<any, any> {
      static template = xml`<span><t t-esc="props.val"/></span>`;
      willUpdateProps(): Promise<void> {
        return defs[index++];
      }
      patched() {
        steps.push("patched");
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`<div><ChildA val="state.valA"/></div>`;
      static components = { ChildA };
      state = useState({ valA: 1 });
    }
    const parent = new Parent(env);
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
    class ChildA extends Component<any, any> {
      static template = xml`<span><t t-esc="val()"/></span>`;
      patched() {
        steps.push("patched");
      }
      val() {
        steps.push("render");
        return this.props.val;
      }
    }

    class Parent extends Component<any, any> {
      static template = xml`<div><ChildA val="state.valA"/></div>`;
      static components = { ChildA };
      state = useState({ valA: 1 });
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    parent.state.valA = 2;
    await nextMicroTick();
    expect(steps).toEqual(["render"]);
    await nextMicroTick();
    expect(steps).toEqual(["render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    parent.state.valA = 3;
    await nextMicroTick();
    expect(steps).toEqual(["render", "render"]);
    await nextMicroTick();
    expect(steps).toEqual(["render", "render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
    expect(steps).toEqual(["render", "render", "render", "patched"]);
  });

  test("components in a node in a t-foreach ", async () => {
    class Child extends Widget {}

    class App extends Widget {
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

    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><ul><li><div>1</div></li><li><div>2</div></li></ul></div>"
    );
  });

  test("properly behave when destroyed/unmounted while rendering ", async () => {
    const def = makeDeferred();

    class SubChild extends Widget {
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

    class Child extends Widget {
      static template = xml`<div><SubChild /></div>`;
      static components = { SubChild };
    }

    class Parent extends Widget {
      static template = xml`<div><t t-if="state.flag"><Child val="state.val"/></t></div>`;
      static components = { Child };
      state = useState({ flag: true, val: "Framboise Lindemans" });
    }
    const parent = new Parent(env);
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
    class ChildA extends Widget {
      destroy() {
        destroyCount++;
        super.destroy();
      }
    }
    class ChildB extends Widget {
      willStart(): any {
        return new Promise(function() {});
      }
    }
    class Parent extends Widget {
      static components = { ChildA, ChildB };
      state = useState({ valA: 1, valB: 2, flag: false });
    }
    const parent = new Parent(env);
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
    class Child extends Widget {
      static template = xml`<div t-name="Child">Child</div>`;
    }

    class App extends Widget {
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

    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><button>Click</button></div>");
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>Click</button><div>Child</div></div>");
  });

  test("concurrent renderings scenario 1", async () => {
    const def = makeDeferred();
    let stateB;

    class ComponentC extends Component<any, any> {
      static template = xml`<span><t t-esc="props.fromA"/><t t-esc="someValue()"/></span>`;
      someValue() {
        return this.props.fromB;
      }
      willUpdateProps() {
        return def;
      }
    }
    ComponentC.prototype.someValue = jest.fn(ComponentC.prototype.someValue);

    class ComponentB extends Component<any, any> {
      static components = { ComponentC };
      static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
      state = useState({ fromB: "b" });

      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
    }

    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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
    class ComponentC extends Component<any, any> {
      static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;
      willUpdateProps() {
        return defs[index++];
      }
    }

    class ComponentB extends Component<any, any> {
      static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
      static components = { ComponentC };
      state = useState({ fromB: "b" });

      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
    }

    class ComponentA extends Component<any, any> {
      static template = xml`<div><t t-esc="state.fromA"/><ComponentB fromA="state.fromA"/></div>`;
      static components = { ComponentB };
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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
    class ComponentC extends Component<any, any> {
      static template = xml`<span><t t-esc="props.fromA"/><t t-esc="props.fromB"/></span>`;
      willUpdateProps() {
        return defs[index++];
      }
    }

    class ComponentB extends Component<any, any> {
      static template = xml`<p><ComponentC fromA="props.fromA" fromB="state.fromB" /></p>`;
      static components = { ComponentC };
      state = useState({ fromB: "b" });

      constructor(parent, props) {
        super(parent, props);
        stateB = this.state;
      }
    }

    class ComponentA extends Component<any, any> {
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      static components = { ComponentB };
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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

    class ComponentD extends Component<any, any> {
      static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;
      someValue() {
        return this.props.fromC;
      }
      willUpdateProps() {
        return defsD[index++];
      }
    }
    ComponentD.prototype.someValue = jest.fn(ComponentD.prototype.someValue);

    class ComponentC extends Component<any, any> {
      static template = xml`<span><ComponentD fromA="props.fromA" fromC="state.fromC" /></span>`;
      static components = { ComponentD };
      state = useState({ fromC: "c" });
      constructor(parent, props) {
        super(parent, props);
        stateC = this.state;
      }
    }

    class ComponentB extends Component<any, any> {
      static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
      static components = { ComponentC };

      willUpdateProps() {
        return defB;
      }
    }

    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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

    class ComponentD extends Component<any, any> {
      static template = xml`<i><t t-esc="props.fromA"/><t t-esc="someValue()"/></i>`;
      someValue() {
        return this.props.fromC;
      }
      willUpdateProps() {
        return defsD[index++];
      }
    }
    ComponentD.prototype.someValue = jest.fn(ComponentD.prototype.someValue);

    class ComponentC extends Component<any, any> {
      static template = xml`<span><ComponentD fromA="props.fromA" fromC="state.fromC" /></span>`;
      static components = { ComponentD };
      state = useState({ fromC: "c" });
      constructor(parent, props) {
        super(parent, props);
        stateC = this.state;
      }
    }

    class ComponentB extends Component<any, any> {
      static template = xml`<p><ComponentC fromA="props.fromA" /></p>`;
      static components = { ComponentC };

      willUpdateProps() {
        return defB;
      }
    }

    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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

    class ComponentB extends Component<any, any> {
      static template = xml`<p><t t-esc="someValue()" /></p>`;
      someValue() {
        return this.props.fromA;
      }
      willUpdateProps() {
        return defsB[index++];
      }
    }
    ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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

    class ComponentB extends Component<any, any> {
      static template = xml`<p><t t-esc="someValue()" /></p>`;
      someValue() {
        return this.props.fromA;
      }
      willUpdateProps() {
        return defsB[index++];
      }
    }
    ComponentB.prototype.someValue = jest.fn(ComponentB.prototype.someValue);

    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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
    class ComponentB extends Component<any, any> {
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

    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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
    class ComponentB extends Component<any, any> {
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

    class ComponentA extends Component<any, any> {
      static components = { ComponentB };
      static template = xml`<div><ComponentB fromA="state.fromA"/></div>`;
      state = useState({ fromA: 1 });
    }

    const component = new ComponentA(env);
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
});

describe("widget and observable state", () => {
  test("widget is rerendered when its state is changed", async () => {
    class TestWidget extends Widget {
      static template = xml`<div><t t-esc="state.drink"/></div>`;
      state = useState({ drink: "water" });
    }
    const widget = new TestWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<div>water</div>");
    widget.state.drink = "beer";

    await nextTick();
    expect(fixture.innerHTML).toBe("<div>beer</div>");
  });

  test("subcomponents cannot change observable state received from parent", async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    env.qweb.addTemplate("Parent", `<div><Child obj="state.obj"/></div>`);
    class Child extends Widget {
      constructor(parent, props) {
        super(parent, props);
        props.obj.coffee = 2;
      }
    }
    class Parent extends Widget {
      state = useState({ obj: { coffee: 1 } });
      static components = { Child };
    }
    const parent = new Parent(env);
    let error;
    try {
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe('Observed state cannot be changed here! (key: "coffee", val: "2")');
    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
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
      static template = "Achel";
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

describe("t-slot directive", () => {
  test("can define and call slots", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
             <Dialog>
                <t t-set="header"><span>header</span></t>
                <t t-set="footer"><span>footer</span></t>
             </Dialog>
          </div>
          <div t-name="Dialog">
            <div><t t-slot="header"/></div>
            <div><t t-slot="footer"/></div>
          </div>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      "<div><div><div><span>header</span></div><div><span>footer</span></div></div></div>"
    );
    expect(env.qweb.templates.Parent.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.Dialog.fn.toString()).toMatchSnapshot();
    expect(QWeb.slots["1_header"].toString()).toMatchSnapshot();
    expect(QWeb.slots["1_footer"].toString()).toMatchSnapshot();
  });

  test("slots are rendered with proper context", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
            <span class="counter"><t t-esc="state.val"/></span>
            <Dialog>
              <t t-set="footer"><button t-on-click="doSomething">do something</button></t>
            </Dialog>
          </div>
          <span t-name="Dialog"><t t-slot="footer"/></span>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
      state = useState({ val: 0 });
      doSomething() {
        this.state.val++;
      }
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    fixture.querySelector("button")!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
    expect(QWeb.slots["1_footer"].toString()).toMatchSnapshot();
  });

  test("slots are rendered with proper context, part 2", async () => {
    env.qweb.addTemplates(`
        <templates>
            <a t-name="Link" t-att-href="props.to">
                <t t-slot="default"/>
            </a>
            <div t-name="App">
                <u><li t-foreach="state.users" t-as="user" t-key="user.id">
                    <Link to="'/user/' + user.id">User <t t-esc="user.name"/></Link>
                </li></u>
            </div>
        </templates>
    `);
    class Link extends Widget {}

    class App extends Widget {
      state = useState({ users: [{ id: 1, name: "Aaron" }, { id: 2, name: "David" }] });
      static components = { Link };
    }

    const app = new App(env);
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User David</a></li></u></div>'
    );
    expect(env.qweb.templates.Link.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();

    // test updateprops here
    app.state.users[1].name = "Mathieu";
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User Mathieu</a></li></u></div>'
    );
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("slots are rendered with proper context, part 3", async () => {
    env.qweb.addTemplates(`
        <templates>
            <a t-name="Link" t-att-href="props.to">
                <t t-slot="default"/>
            </a>
            <div t-name="App">
                <u><li t-foreach="state.users" t-as="user" t-key="user.id" >
                    <t t-set="userdescr" t-value="'User ' + user.name"/>
                    <Link to="'/user/' + user.id"><t t-esc="userdescr"/></Link>
                </li></u>
            </div>
        </templates>
    `);
    class Link extends Widget {}

    class App extends Widget {
      state = useState({ users: [{ id: 1, name: "Aaron" }, { id: 2, name: "David" }] });
      static components = { Link };
    }

    const app = new App(env);
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User David</a></li></u></div>'
    );
    expect(env.qweb.templates.Link.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();

    // test updateprops here
    app.state.users[1].name = "Mathieu";
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User Mathieu</a></li></u></div>'
    );
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("slots are rendered with proper context, part 4", async () => {
    env.qweb.addTemplates(`
        <templates>
            <a t-name="Link" t-att-href="props.to">
                <t t-slot="default"/>
            </a>
            <div t-name="App">
                <t t-set="userdescr" t-value="'User ' + state.user.name"/>
                <Link to="'/user/' + state.user.id"><t t-esc="userdescr"/></Link>
            </div>
        </templates>
    `);
    class Link extends Widget {}

    class App extends Widget {
      state = useState({ user: { id: 1, name: "Aaron" } });
      static components = { Link };
    }

    const app = new App(env);
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe('<div><a href="/user/1">User Aaron</a></div>');

    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();

    // test updateprops here
    app.state.user.name = "David";
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><a href="/user/1">User David</a></div>');
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("refs are properly bound in slots", async () => {
    class Dialog extends Widget {
      static template = xml`<span><t t-slot="footer"/></span>`;
    }
    class Parent extends Widget {
      static template = xml`
          <div>
            <span class="counter"><t t-esc="state.val"/></span>
            <Dialog>
              <t t-set="footer"><button t-ref="myButton" t-on-click="doSomething">do something</button></t>
            </Dialog>
          </div>
        `;
      static components = { Dialog };
      state = useState({ val: 0 });
      button = useRef("myButton");
      doSomething() {
        this.state.val++;
      }
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    parent.button.el!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
    expect(QWeb.slots["1_footer"].toString()).toMatchSnapshot();
  });

  test("content is the default slot", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
             <Dialog>
                <span>sts rocks</span>
             </Dialog>
          </div>
          <div t-name="Dialog"><t t-slot="default"/></div>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts rocks</span></div></div>");
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("default slot work with text nodes", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
             <Dialog>sts rocks</Dialog>
          </div>
          <div t-name="Dialog"><t t-slot="default"/></div>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div>sts rocks</div></div>");
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("multiple roots are allowed in a named slot", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
             <Dialog>
                <t t-set="content">
                    <span>sts</span>
                    <span>rocks</span>
                </t>
             </Dialog>
          </div>
          <div t-name="Dialog"><t t-slot="content"/></div>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts</span><span>rocks</span></div></div>");
    expect(QWeb.slots["1_content"].toString()).toMatchSnapshot();
  });

  test("multiple roots are allowed in a default slot", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
             <Dialog>
                <span>sts</span>
                <span>rocks</span>
             </Dialog>
          </div>
          <div t-name="Dialog"><t t-slot="default"/></div>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts</span><span>rocks</span></div></div>");
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("missing slots are ignored", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
            <Dialog/>
          </div>
          <span t-name="Dialog">
            <t t-slot="default"/>
            <span>some content</span>
            <t t-slot="footer"/>
          </span>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span><span>some content</span></span></div>");
  });

  test("t-debug on a t-set (defining a slot)", async () => {
    const consoleLog = console.log;
    console.log = jest.fn();

    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
            <Dialog><t t-set="content" t-debug="1">abc</t></Dialog>
          </div>
          <span t-name="Dialog">
            <t t-slot="content"/>
          </span>
        </templates>
    `);
    class Dialog extends Widget {}
    class Parent extends Widget {
      static components = { Dialog };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(console.log).toHaveBeenCalledTimes(0);
    console.log = consoleLog;
  });

  test("slot preserves properly parented relationship", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
             <Child>
                <GrandChild/>
             </Child>
          </div>
          <div t-name="Child"><t t-slot="default"/></div>
          <div t-name="GrandChild">Grand Child</div>
        </templates>
    `);
    class Child extends Widget {}
    class GrandChild extends Widget {}
    class Parent extends Widget {
      static components = { Child, GrandChild };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><div>Grand Child</div></div></div>");

    const parentChildren = children(parent);
    expect(parentChildren.length).toBe(1);
    expect(parentChildren[0]).toBeInstanceOf(Child);

    const childrenChildren = children(parentChildren[0]);
    expect(childrenChildren.length).toBe(1);
    expect(childrenChildren[0]).toBeInstanceOf(GrandChild);
  });

  test("slot are properly rendered if inner props are changed", async () => {
    env.qweb.addTemplates(`
    <templates>
        <div t-name="SomeComponent">
            SC:<t t-esc="props.val"/>
        </div>


        <div t-name="GenericComponent">
            <t t-slot="default" />
        </div>

        <div t-name="App">
            <button t-on-click="inc">Inc[<t t-esc="state.val"/>]</button>
            <GenericComponent>
                <SomeComponent val="state.val"/>
            </GenericComponent>
        </div>
    </templates>
    `);
    class SomeComponent extends Widget {}
    class GenericComponent extends Widget {}
    class App extends Widget {
      static components = { GenericComponent, SomeComponent };
      state = useState({ val: 4 });

      inc() {
        this.state.val++;
      }
    }
    const app = new App(env);
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><button>Inc[4]</button><div><div> SC:4</div></div></div>");
    (<any>fixture.querySelector("button")).click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>Inc[5]</button><div><div> SC:5</div></div></div>");
  });

  test("slots and wrapper components", async () => {
    class Link extends Component<any, any> {
      static template = xml`
        <a href="abc">
            <t t-slot="default"/>
        </a>`;
    }

    class A extends Component<any, any> {
      static template = xml`<Link>hey</Link>`;
      static components = { Link: Link };
    }

    const a = new A(env);
    await a.mount(fixture);

    expect(fixture.innerHTML).toBe(`<a href="abc">hey</a>`);
  });

  test("template can just return a slot", async () => {
    class Child extends Widget {
      static template = xml`<span><t t-esc="props.value"/></span>`;
    }
    class SlotComponent extends Widget {
      static template = xml`<t t-slot="default"/>`;
    }

    class Parent extends Widget {
      static template = xml`
        <div>
            <SlotComponent><Child value="state.value"/></SlotComponent>
        </div>`;
      static components = { SlotComponent, Child };
      state = useState({ value: 3 });
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");

    expect(QWeb.TEMPLATES[SlotComponent.template].fn.toString()).toMatchSnapshot();

    parent.state.value = 5;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>5</span></div>");
  });
});

describe("t-model directive", () => {
  test("basic use, on an input", async () => {
    class SomeComponent extends Widget {
      static template = xml`
        <div>
          <input t-model="state.text"/>
          <span><t t-esc="state.text"/></span>
        </div>`;
      state = useState({ text: "" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
    expect(env.qweb.templates[SomeComponent.template].fn.toString()).toMatchSnapshot();
  });

  test("basic use, on another key in component", async () => {
    env.qweb.addTemplates(`
    <templates>
        <div t-name="SomeComponent">
            <input t-model="some.text"/>
            <span><t t-esc="some.text"/></span>
        </div>
    </templates>`);
    class SomeComponent extends Widget {
      some = useState({ text: "" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.some.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
    expect(env.qweb.templates.SomeComponent.fn.toString()).toMatchSnapshot();
  });

  test("on an input, type=checkbox", async () => {
    env.qweb.addTemplates(`
    <templates>
        <div t-name="SomeComponent">
            <input type="checkbox" t-model="state.flag"/>
            <span>
                <t t-if="state.flag">yes</t>
                <t t-else="1">no</t>
            </span>
        </div>
    </templates>`);
    class SomeComponent extends Widget {
      state = useState({ flag: false });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe('<div><input type="checkbox"><span>no</span></div>');

    let input = fixture.querySelector("input")!;
    input.click();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><input type="checkbox"><span>yes</span></div>');
    expect(comp.state.flag).toBe(true);
    expect(env.qweb.templates.SomeComponent.fn.toString()).toMatchSnapshot();

    input.click();
    await nextTick();
    expect(comp.state.flag).toBe(false);
  });

  test("on an textarea", async () => {
    env.qweb.addTemplates(`
    <templates>
        <div t-name="SomeComponent">
            <textarea t-model="state.text"/>
            <span><t t-esc="state.text"/></span>
        </div>
    </templates>`);
    class SomeComponent extends Widget {
      state = useState({ text: "" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><textarea></textarea><span></span></div>");

    const textarea = fixture.querySelector("textarea")!;
    await editInput(textarea, "test");
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><textarea></textarea><span>test</span></div>");
  });

  test("on an input type=radio", async () => {
    env.qweb.addTemplates(`
    <templates>
        <div t-name="SomeComponent">
            <input type="radio" id="one" value="One" t-model="state.choice"/>
            <input type="radio" id="two" value="Two" t-model="state.choice"/>
            <span>Choice: <t t-esc="state.choice"/></span>
        </div>
    </templates>`);
    class SomeComponent extends Widget {
      state = useState({ choice: "" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: </span></div>'
    );

    const firstInput = fixture.querySelector("input")!;
    firstInput.click();
    await nextTick();
    expect(comp.state.choice).toBe("One");
    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: One</span></div>'
    );

    const secondInput = fixture.querySelectorAll("input")[1];
    secondInput.click();
    await nextTick();
    expect(comp.state.choice).toBe("Two");
    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: Two</span></div>'
    );
    expect(env.qweb.templates.SomeComponent.fn.toString()).toMatchSnapshot();
  });

  test("on a select", async () => {
    env.qweb.addTemplates(`
    <templates>
        <div t-name="SomeComponent">
            <select t-model="state.color">
                <option value="">Please select one</option>
                <option value="red">Red</option>
                <option value="blue">Blue</option>
            </select>
            <span>Choice: <t t-esc="state.color"/></span>
        </div>
    </templates>`);
    class SomeComponent extends Widget {
      state = useState({ color: "" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><select><option value="">Please select one</option><option value="red">Red</option><option value="blue">Blue</option></select><span>Choice: </span></div>'
    );

    const select = fixture.querySelector("select")!;
    select.value = "red";
    select.dispatchEvent(new Event("change"));
    await nextTick();

    expect(comp.state.color).toBe("red");
    expect(fixture.innerHTML).toBe(
      '<div><select><option value="">Please select one</option><option value="red">Red</option><option value="blue">Blue</option></select><span>Choice: red</span></div>'
    );

    expect(env.qweb.templates.SomeComponent.fn.toString()).toMatchSnapshot();
  });

  test("on a select, initial state", async () => {
    class SomeComponent extends Widget {
      static template = xml`
        <div>
          <select t-model="state.color">
            <option value="">Please select one</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
          </select>
        </div>
      `;
      state = useState({ color: "red" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);
    const select = fixture.querySelector("select")!;
    expect(select.value).toBe("red");
  });

  test("on a sub state key", async () => {
    class SomeComponent extends Widget {
      static template = xml`
        <div>
          <input t-model="state.something.text"/>
          <span><t t-esc="state.something.text"/></span>
        </div>
      `;
      state = useState({ something: { text: "" } });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.state.something.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
    expect(env.qweb.templates[SomeComponent.template].fn.toString()).toMatchSnapshot();
  });

  test(".lazy modifier", async () => {
    class SomeComponent extends Widget {
      static template = xml`
        <div>
            <input t-model.lazy="state.text"/>
            <span><t t-esc="state.text"/></span>
        </div>
      `;
      state = useState({ text: "" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(comp.state.text).toBe("");
    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");
    input.dispatchEvent(new Event("change"));
    await nextTick();
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
    expect(env.qweb.templates[SomeComponent.template].fn.toString()).toMatchSnapshot();
  });

  test(".trim modifier", async () => {
    class SomeComponent extends Widget {
      static template = xml`
        <div t-name="SomeComponent">
          <input t-model.trim="state.text"/>
          <span><t t-esc="state.text"/></span>
        </div>
      `;
      state = useState({ text: "" });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);

    const input = fixture.querySelector("input")!;
    await editInput(input, " test ");
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test(".number modifier", async () => {
    class SomeComponent extends Widget {
      static template = xml`
        <div>
          <input t-model.number="state.number"/>
          <span><t t-esc="state.number"/></span>
        </div>
      `;
      state = useState({ number: 0 });
    }
    const comp = new SomeComponent(env);
    await comp.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><input><span>0</span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "13");
    expect(comp.state.number).toBe(13);
    expect(fixture.innerHTML).toBe("<div><input><span>13</span></div>");

    await editInput(input, "invalid");
    expect(comp.state.number).toBe("invalid");
    expect(fixture.innerHTML).toBe("<div><input><span>invalid</span></div>");
  });
});

describe("environment and plugins", () => {
  // some source of external events
  let bus = new EventBus();

  // definition of a plugin
  const somePlugin = env => {
    env.someFlag = true;
    bus.on("some-event", null, () => {
      env.someFlag = !env.someFlag;
      env.qweb.forceUpdate();
    });
  };

  test("plugin works as expected", async () => {
    somePlugin(env);
    class App extends Widget {
      static template = xml`
        <div>
            <t t-if="env.someFlag">Red</t>
            <t t-else="1">Blue</t>
        </div>
      `;
    }

    const app = new App(env);
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe("<div>Red</div>");
    bus.trigger("some-event");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>Blue</div>");
  });
});

describe("component error handling (catchError)", () => {
  /**
   * This test suite requires often to wait for 3 ticks. Here is why:
   * - First tick is to let the app render and crash.
   * - When we crash, we call the catchError handler in a setTimeout (because we
   *   need to wait for the previous rendering to be completely stopped). So, we
   *   need to wait for the second tick.
   * - Then, when the handler changes the state, we need to wait for the interface
   *   to be rerendered.
   *  */

  test("can catch an error in a component render function", async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
    class ErrorComponent extends Widget {
      static template = xml`<div>hey<t t-esc="props.flag and state.this.will.crash"/></div>`;
    }
    class ErrorBoundary extends Widget {
      static template = xml`
        <div>
          <t t-if="state.error">Error handled</t>
          <t t-else="1"><t t-slot="default" /></t>
        </div>`;
      state = useState({ error: false });

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Widget {
      static template = xml`
        <div>
          <ErrorBoundary><ErrorComponent flag="state.flag"/></ErrorBoundary>
        </div>`;
      state = useState({ flag: false });
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><div>hey</div></div></div>");
    app.state.flag = true;
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(1);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("no component catching error lead to full app destruction", async () => {
    expect.assertions(6);
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();

    class ErrorComponent extends Widget {
      static template = xml`<div>hey<t t-esc="props.flag and state.this.will.crash"/></div>`;
    }

    class App extends Widget {
      static template = xml`<div><ErrorComponent flag="state.flag"/></div>`;
      static components = { ErrorComponent };
      state = useState({ flag: false });
      async render() {
        try {
          await super.render();
        } catch (e) {
          expect(e.message).toBe("Cannot read property 'this' of undefined");
        }
      }
    }
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>hey</div></div>");
    app.state.flag = true;
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(app.__owl__.isDestroyed).toBe(true);
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the initial call of a component render function", async () => {
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();
    class ErrorComponent extends Component<any, any> {
      static template = xml`<div>hey<t t-esc="state.this.will.crash"/></div>`;
    }
    class ErrorBoundary extends Component<any, any> {
      static template = xml`
        <div>
          <t t-if="state.error">Error handled</t>
          <t t-else="1"><t t-slot="default" /></t>
        </div>`;
      state = useState({ error: false });

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Component<any, any> {
      static template = xml`
        <div>
            <ErrorBoundary><ErrorComponent /></ErrorBoundary>
        </div>`;
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = new App(env);
    await app.mount(fixture);
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(1);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the constructor call of a component render function", async () => {
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ErrorBoundary">
            <t t-if="state.error">Error handled</t>
            <t t-else="1"><t t-slot="default" /></t>
        </div>
        <div t-name="ErrorComponent">Some text</div>
        <div t-name="App">
            <ErrorBoundary><ErrorComponent /></ErrorBoundary>
        </div>
      </templates>`);
    class ErrorComponent extends Widget {
      constructor(parent) {
        super(parent);
        throw new Error("NOOOOO");
      }
    }
    class ErrorBoundary extends Widget {
      state = useState({ error: false });

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Widget {
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = new App(env);
    await app.mount(fixture);
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(1);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the willStart call", async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    class ErrorComponent extends Widget {
      static template = xml`<div t-name="ErrorComponent">Some text</div>`;
      async willStart() {
        // we wait a little bit to be in a different stack frame
        await nextTick();
        throw new Error("NOOOOO");
      }
    }
    class ErrorBoundary extends Widget {
      static template = xml`
        <div>
          <t t-if="state.error">Error handled</t>
          <t t-else="1"><t t-slot="default" /></t>
        </div>`;
      state = useState({ error: false });

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Widget {
      static template = xml`<div><ErrorBoundary><ErrorComponent /></ErrorBoundary></div>`;
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = new App(env);
    await app.mount(fixture);
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(1);
    console.error = consoleError;
  });

  test.skip("can catch an error in the mounted call", async () => {
    // we do not catch error in mounted anymore
    console.error = jest.fn();
    env.qweb.addTemplates(`
      <templates>
        <div t-name="ErrorBoundary">
            <t t-if="state.error">Error handled</t>
            <t t-else="1"><t t-slot="default" /></t>
        </div>
        <div t-name="ErrorComponent">Some text</div>
        <div t-name="App">
            <ErrorBoundary><ErrorComponent /></ErrorBoundary>
        </div>
      </templates>`);
    class ErrorComponent extends Widget {
      mounted() {
        throw new Error("NOOOOO");
      }
    }
    class ErrorBoundary extends Widget {
      state = useState({ error: false });

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Widget {
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = new App(env);
    await app.mount(fixture);
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
  });

  test.skip("can catch an error in the willPatch call", async () => {
    // we do not catch error in willPatch anymore
    const consoleError = console.error;
    console.error = jest.fn();
    class ErrorComponent extends Widget {
      static template = xml`<div><t t-esc="props.message"/></div>`;
      willPatch() {
        throw new Error("NOOOOO");
      }
    }
    class ErrorBoundary extends Widget {
      static template = xml`
        <div>
          <t t-if="state.error">Error handled</t>
          <t t-else="1"><t t-slot="default" /></t>
        </div>`;
      state = useState({ error: false });

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Widget {
      static template = xml`
        <div>
            <span><t t-esc="state.message"/></span>
          <ErrorBoundary><ErrorComponent message="state.message" /></ErrorBoundary>
        </div>`;
      state = useState({ message: "abc" });
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>abc</span><div><div>abc</div></div></div>");
    app.state.message = "def";
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>def</span><div>Error handled</div></div>");
    expect(console.error).toHaveBeenCalledTimes(1);
    console.error = consoleError;
  });

  test("a rendering error will reject the mount promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});
    // we do not catch error in willPatch anymore
    class App extends Component<any, any> {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }

    const app = new App(env);
    let error;
    try {
      await app.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("a rendering error in a sub component will reject the mount promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});
    // we do not catch error in willPatch anymore
    class Child extends Component<any, any> {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }
    class App extends Component<any, any> {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
    }

    const app = new App(env);
    let error;
    try {
      await app.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("a rendering error will reject the render promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});
    // we do not catch error in willPatch anymore
    class App extends Component<any, any> {
      static template = xml`<div><t t-if="flag" t-esc="this.will.crash"/></div>`;
      flag = false;
    }

    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    app.flag = true;
    let error;
    try {
      await app.render();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });
});

describe("top level sub widgets", () => {
  test("basic use", async () => {
    env.qweb.addTemplates(`
        <templates>
          <t t-name="Parent">
            <Child p="1"/>
          </t>
          <span t-name="Child">child<t t-esc="props.p"/></span>
        </templates>`);
    class Child extends Widget {}
    class Parent extends Widget {
      static components = { Child };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>child1</span>");
    expect(env.qweb.templates.Parent.fn.toString()).toMatchSnapshot();
  });

  test("sub widget is interactive", async () => {
    env.qweb.addTemplates(`
        <templates>
          <t t-name="Parent">
            <Child p="1"/>
          </t>
          <span t-name="Child"><button t-on-click="inc">click</button>child<t t-esc="state.val"/></span>
        </templates>`);
    class Child extends Widget {
      state = useState({ val: 1 });
      inc() {
        this.state.val++;
      }
    }
    class Parent extends Widget {
      static components = { Child };
    }
    const parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<span><button>click</button>child1</span>");
    const button = fixture.querySelector("button")!;
    button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span><button>click</button>child2</span>");
  });

  test("can select a sub widget ", async () => {
    class Child extends Widget {
      static template = xml`<span>CHILD 1</span>`;
    }
    class OtherChild extends Widget {
      static template = xml`<div>CHILD 2</div>`;
    }
    class Parent extends Widget {
      static template = xml`
        <t>
          <t t-if="env.flag"><Child /></t>
          <t t-if="!env.flag"><OtherChild /></t>
        </t>
      `;
      static components = { Child, OtherChild };
    }
    (<any>env).flag = true;
    let parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>CHILD 1</span>");
    parent.destroy();
    (<any>env).flag = false;
    parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>CHILD 2</div>");

    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
  });

  test("can select a sub widget, part 2", async () => {
    class Child extends Widget {
      static template = xml`<span>CHILD 1</span>`;
    }
    class OtherChild extends Widget {
      static template = xml`<div>CHILD 2</div>`;
    }
    class Parent extends Widget {
      static template = xml`
        <t>
          <t t-if="state.flag"><Child /></t>
          <t t-if="!state.flag"><OtherChild /></t>
        </t>
      `;
      state = useState({ flag: true });
      static components = { Child, OtherChild };
    }
    let parent = new Parent(env);
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>CHILD 1</span>");
    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>CHILD 2</div>");
  });

  test("top level sub widget with a parent", async () => {
    class ComponentC extends Component<any, any> {
      static template = xml`<span>Hello</span>`;
    }
    class ComponentB extends Component<any, any> {
      static template = xml`<ComponentC />`;
      static components = { ComponentC };
    }
    class ComponentA extends Component<any, any> {
      static template = xml`<div><ComponentB/></div>`;
      static components = { ComponentB };
    }

    const component = new ComponentA(env);
    await component.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>Hello</span></div>");
  });
});

describe("unmounting and remounting", () => {
  test("widget can be unmounted and remounted", async () => {
    const steps: string[] = [];
    class MyWidget extends Widget {
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

    const w = new MyWidget(env);
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
    class MyWidget extends Widget {
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

    const w = new MyWidget(env);
    await w.mount(fixture);
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hey</div>");
    expect(steps).toEqual(["willstart", "mounted"]);
  });

  test("state changes in willUnmount do not trigger rerender", async () => {
    const steps: string[] = [];

    class Child extends Widget {
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
    class Parent extends Widget {
      static template = xml`
        <div>
          <Child t-if="state.flag" val="state.val"/>
        </div>
      `;
      static components = { Child };
      state = useState({ val: 1, flag: true });
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    expect(steps).toEqual(["render"]);
    expect(fixture.innerHTML).toBe("<div><span>12</span></div>");
    widget.state.flag = false;
    await nextTick();
    // we make sure here that no call to __render is done
    expect(steps).toEqual(["render", "willUnmount"]);
  });

  test("state changes in willUnmount will be applied on remount", async () => {
    class TestWidget extends Widget {
      static template = xml`
        <div><t t-esc="state.val"/></div>
      `;
      state = useState({ val: 1 });
      willUnmount() {
        this.state.val = 3;
      }
    }

    const widget = new TestWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");
    widget.unmount();
    expect(fixture.innerHTML).toBe("");
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");
    widget.unmount();
    await widget.mount(fixture, true);
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });
});

describe("dynamic root nodes", () => {
  test("template with t-if, part 1", async () => {
    class TestWidget extends Widget {
      static template = xml`
        <t>
          <t t-if="true"><span>hey</span></t>
          <t t-if="false"><div>abc</div></t>
        </t>
      `;
    }

    const widget = new TestWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<span>hey</span>");
  });

  test("template with t-if, part 2", async () => {
    class TestWidget extends Widget {
      static template = xml`
        <t>
          <t t-if="false"><span>hey</span></t>
          <t t-if="true"><div>abc</div></t>
        </t>
      `;
    }

    const widget = new TestWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<div>abc</div>");
  });

  test("switching between sub branches dynamically", async () => {
    class TestWidget extends Widget {
      static template = xml`
        <t>
          <t t-if="state.flag"><span>hey</span></t>
          <t t-if="!state.flag"><div>abc</div></t>
        </t>
      `;
      state = useState({ flag: true });
    }

    const widget = new TestWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<span>hey</span>");
    widget.state.flag = false;
    await nextTick();

    expect(fixture.innerHTML).toBe("<div>abc</div>");
  });

  test("switching between sub components dynamically", async () => {
    class ChildA extends Widget {
      static template = xml`<span>hey</span>`;
    }
    class ChildB extends Widget {
      static template = xml`<div>abc</div>`;
    }
    class TestWidget extends Widget {
      static template = xml`
        <t>
            <t t-if="state.flag"><ChildA/></t>
            <t t-if="!state.flag"><ChildB/></t>
        </t>
      `;
      static components = { ChildA, ChildB };
      state = useState({ flag: true });
    }

    const widget = new TestWidget(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<span>hey</span>");
    widget.state.flag = false;
    await nextTick();

    expect(fixture.innerHTML).toBe("<div>abc</div>");
  });
});

describe("dynamic t-props", () => {
  test("basic use", async () => {
    expect.assertions(4);

    class Child extends Widget {
      static template = xml`
        <span>
            <t t-esc="props.a + props.b"/>
        </span>
      `;
      constructor(parent, props) {
        super(parent, props);
        expect(props).toEqual({ a: 1, b: 2 });
        expect(props).not.toBe(widget.some.obj);
      }
    }
    class Parent extends Widget {
      static template = xml`
        <div>
            <Child t-props="some.obj"/>
        </div>
      `;
      static components = { Child };

      some = { obj: { a: 1, b: 2 } };
    }

    const widget = new Parent(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
  });
});

describe("support svg components", () => {
  test("add proper namespace to svg", async () => {
    class GComp extends Widget {
      static template = xml`
        <g>
            <circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/>
        </g>`;
    }

    class Svg extends Widget {
      static template = xml`
        <svg>
            <GComp/>
        </svg>`;
      static components = { GComp };
    }
    const widget = new Svg(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<svg><g><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"></circle></g></svg>'
    );
  });
});

describe("t-raw in components", () => {
  test("update properly on state changes", async () => {
    class TestW extends Widget {
      static template = xml`<div><t t-raw="state.value"/></div>`;
      state = useState({ value: "<b>content</b>" });
    }
    const widget = new TestW(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><b>content</b></div>");

    widget.state.value = "<span>other content</span>";
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>other content</span></div>");
  });

  test("can render list of t-raw ", async () => {
    class TestW extends Widget {
      static template = xml`
        <div>
            <t t-foreach="state.items" t-as="item">
            <t t-esc="item"/>
            <t t-raw="item"/>
            </t>
        </div>`;
      state = useState({ items: ["<b>one</b>", "<b>two</b>", "<b>tree</b>"] });
    }
    const widget = new TestW(env);
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe(
      "<div>&lt;b&gt;one&lt;/b&gt;<b>one</b>&lt;b&gt;two&lt;/b&gt;<b>two</b>&lt;b&gt;tree&lt;/b&gt;<b>tree</b></div>"
    );
  });
});
