import { QWeb } from "../src/ts/core/qweb_vdom";
import { idGenerator } from "../src/ts/core/utils";
import { WEnv, Widget } from "../src/ts/core/widget";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - env: a WEnv, necessary to create new widgets

let fixture: HTMLElement;
let env: WEnv;

beforeEach(() => {
  fixture = document.createElement("div");
  document.body.appendChild(fixture);
  env = {
    qweb: new QWeb(),
    getID: idGenerator()
  };
});

afterEach(() => {
  fixture.remove();
});

function nextTick(): Promise<void> {
  return Promise.resolve();
}

// Test widget
class Counter extends Widget<WEnv> {
  name = "counter";
  template = `<div><t t-esc="state.counter"/><button t-on-click="inc">Inc</button></div>`;
  state = {
    counter: 0
  };

  inc() {
    this.updateState({ counter: this.state.counter + 1 });
  }
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("basic widget properties", () => {
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
    const target = document.createElement("div");
    await counter.mount(target);
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    await button.click();
    await nextTick();
    expect(target.innerHTML).toBe("<div>1<button>Inc</button></div>");
  });

  test("widget style and classname", async () => {
    class StyledWidget extends Widget<WEnv> {
      template = `<div style="font-weight:bold;" class="some-class">world</div>`;
    }
    const widget = new StyledWidget(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(
      `<div style="font-weight:bold;" class="some-class">world</div>`
    );
  });

  test("updateState before first render does not trigger a render", async () => {
    let renderCalls = 0;
    class TestW extends Widget<WEnv> {
      async willStart() {
        this.updateState({});
      }
      async render() {
        renderCalls++;
        return super.render();
      }
    }
    const widget = new TestW(env);
    await widget.mount(fixture);
    expect(renderCalls).toBe(1);
  });
});

describe("lifecycle hooks", () => {
  test("willStart hook is called", async () => {
    let willstart = false;
    class HookWidget extends Widget<WEnv> {
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
    class HookWidget extends Widget<WEnv> {
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
    class HookWidget extends Widget<WEnv> {
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
    class ParentWidget extends Widget<WEnv> {
      name = "a";
      template = `<div><t t-widget="child"/></div>`;
      widgets = { child: ChildWidget };
    }
    class ChildWidget extends Widget<WEnv> {
      async willStart() {
        ok = true;
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(ok).toBe(true);
  });

  test("mounted hook is called on subwidgets, in proper order", async () => {
    expect.assertions(4);
    let parentMounted = false;
    let childMounted = false;
    class ParentWidget extends Widget<WEnv> {
      name = "a";
      template = `<div><t t-widget="child"/></div>`;
      widgets = { child: ChildWidget };
      mounted() {
        expect(childMounted).toBe(false);
        parentMounted = true;
      }
    }
    class ChildWidget extends Widget<WEnv> {
      mounted() {
        expect(document.body.contains(this.el)).toBe(true);
        expect(parentMounted).toBe(true);
        childMounted = true;
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(childMounted).toBe(true);
  });

  test("willStart, mounted on subwidget rendered after main is mounted in some other position", async () => {
    expect.assertions(3);
    let hookCounter = 0;
    class ParentWidget extends Widget<WEnv> {
      name = "a";
      state = { ok: false };
      template = `
          <div>
            <t t-if="state.ok">
              <t t-widget="child"/>
            </t>
            <t t-else="1">
              <div/>
            </t>
          </div>`; // the t-else part in this template is important. This is
      // necessary to have a situation that could confuse the vdom
      // patching algorithm
      widgets = { child: ChildWidget };
    }
    class ChildWidget extends Widget<WEnv> {
      async willStart() {
        hookCounter++;
      }
      mounted() {
        expect(hookCounter).toBe(1);
        hookCounter++;
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(fixture);
    expect(hookCounter).toBe(0); // sub widget not created yet
    await widget.updateState({ ok: true });
    expect(hookCounter).toBe(2);
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
    class ParentWidget extends Widget<WEnv> {
      name = "a";
      mounted() {
        const child = new ChildWidget(this);
        child.mount(this.el!);
      }
    }
    class ChildWidget extends Widget<WEnv> {
      mounted() {
        expect(this.el).toBeTruthy();
        done();
      }
    }
    const widget = new ParentWidget(env);
    await widget.mount(target);
  });
});

describe("destroy method", () => {
  test("destroy remove the widget from the DOM", async () => {
    const widget = new Widget(env);
    await widget.mount(fixture);
    expect(document.contains(widget.el)).toBe(true);
    widget.destroy();
    expect(document.contains(widget.el)).toBe(false);
  });

  test("destroying a widget twice only call destroyed once", async () => {
    let count = 0;
    class TestWidget extends Widget<WEnv> {
      destroyed() {
        count++;
      }
    }
    const widget = new TestWidget(env);
    await widget.mount(fixture);
    widget.destroy();
    expect(count).toBe(1);
    widget.destroy();
    expect(count).toBe(1);
  });
});

describe("composition", () => {
  class WidgetA extends Widget<WEnv> {
    name = "a";
    template = `<div>Hello<t t-widget="b"/></div>`;
    widgets = { b: WidgetB };
  }
  class WidgetB extends Widget<WEnv> {
    template = `<div>world</div>`;
  }

  test("a widget with a sub widget", async () => {
    const widget = new WidgetA(env);
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hello<div>world</div></div>");
    expect(widget._.children[0]._.parent).toBe(widget);
  });

  test("t-refs on widget are widgets", async () => {
    class WidgetC extends Widget<WEnv> {
      name = "a";
      template = `<div>Hello<t t-ref="mywidgetb" t-widget="b"/></div>`;
      widgets = { b: WidgetB };
    }
    const widget = new WidgetC(env);
    await widget.mount(fixture);
    expect(widget.refs.mywidgetb instanceof WidgetB).toBe(true);
  });

  test("modifying a sub widget", async () => {
    class ParentWidget extends Widget<WEnv> {
      template = `<div><t t-widget="Counter"/></div>`;
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

  test("parent's elm for a children === children's elm, even after rerender", async () => {
    const widget = new WidgetA(env);
    await widget.mount(fixture);

    expect((<any>widget._.vnode!.children![1]).elm).toBe(
      (<any>widget._.children[0]._.vnode).elm
    );
    await widget._.children[0].render();
    expect((<any>widget._.vnode!.children![1]).elm).toBe(
      (<any>widget._.children[0]._.vnode).elm
    );
  });
});
