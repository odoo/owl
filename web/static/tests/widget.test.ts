import { Widget, WEnv } from "../src/ts/core/widget";
import { QWeb } from "../src/ts/core/qweb_vdom";

interface Type<T> extends Function {
  new (...args: any[]): T;
}

type TestEnv = WEnv;
type TestWidget = Widget<TestEnv>;

function makeWidget(W: Type<TestWidget>): TestWidget {
  const env = {
    qweb: new QWeb()
  };
  const w = new W(env);
  return w;
}

async function click(el: HTMLElement) {
  el.click();
  return Promise.resolve();
}

const template = `
    <div><t t-esc="state.counter"/><button t-on-click="inc">Inc</button></div>
`;

class Counter extends Widget<TestEnv> {
  name = "counter";
  template = template;
  state = {
    counter: 0
  };

  inc() {
    this.updateState({ counter: this.state.counter + 1 });
  }
}

describe("basic widget properties", () => {
  test("has no el after creation", async () => {
    const widget = makeWidget(Widget);
    expect(widget.el).toBe(null);
  });

  test("can be mounted", async () => {
    const widget = makeWidget(Widget);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(target.innerHTML).toBe("<div></div>");
  });

  test("can be clicked on and updated", async () => {
    const counter = makeWidget(Counter);
    const target = document.createElement("div");
    await counter.mount(target);
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    await click((<HTMLElement>counter.el).getElementsByTagName("button")[0]);
    expect(target.innerHTML).toBe("<div>1<button>Inc</button></div>");
  });

  test("widget style and classname", async () => {
    class StyledWidget extends Widget<TestEnv> {
      template = `<div style="font-weight:bold;" class="some-class">world</div>`;
    }
    const widget = makeWidget(StyledWidget);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(target.innerHTML).toBe(
      `<div style="font-weight:bold;" class="some-class">world</div>`
    );
  });
});

describe("lifecycle hooks", () => {
  test("willStart hook is called", async () => {
    let willstart = false;
    class HookWidget extends Widget<TestEnv> {
      async willStart() {
        willstart = true;
      }
    }
    const widget = makeWidget(HookWidget);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(willstart).toBe(true);
  });

  test("mounted hook is not called if not in DOM", async () => {
    let mounted = false;
    class HookWidget extends Widget<TestEnv> {
      async mounted() {
        mounted = true;
      }
    }
    const widget = makeWidget(HookWidget);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(mounted).toBe(false);
  });

  test("mounted hook is called if mounted in DOM", async () => {
    let mounted = false;
    class HookWidget extends Widget<TestEnv> {
      async mounted() {
        mounted = true;
      }
    }
    const widget = makeWidget(HookWidget);
    const target = document.createElement("div");
    document.body.appendChild(target);
    await widget.mount(target);
    expect(mounted).toBe(true);
    target.remove();
  });

  test("mounted hook is called on subwidgets, in proper order", async () => {
    expect.assertions(2);
    let parentMounted = false;
    let childMounted = false;
    class ParentWidget extends Widget<TestEnv> {
      name = "a";
      template = `<div>Hello<t t-widget="child"/></div>`;
      widgets = { child: ChildWidget };
      async mounted() {
        expect(childMounted).toBe(false);
        parentMounted = true;
      }
    }
    class ChildWidget extends Widget<TestEnv> {
      async mounted() {
        expect(parentMounted).toBe(true);
        childMounted = true;
      }
    }
    const widget = makeWidget(ParentWidget);
    const target = document.createElement("div");
    document.body.appendChild(target);
    await widget.mount(target);
    target.remove();
  });
});

describe("destroy method", () => {
  test("destroy remove the widget from the DOM", async () => {
    const widget = makeWidget(Widget);
    const target = document.body;
    await widget.mount(target);
    expect(document.contains(widget.el)).toBe(true);
    widget.destroy();
    expect(document.contains(widget.el)).toBe(false);
  });
});

describe("composition", () => {
  class WidgetA extends Widget<TestEnv> {
    name = "a";
    template = `<div>Hello<t t-widget="b"/></div>`;
    widgets = { b: WidgetB };
  }

  class WidgetB extends Widget<TestEnv> {
    template = `<div>world</div>`;
  }

  test("a widget with a sub widget", async () => {
    const widget = makeWidget(WidgetA);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(target.innerHTML).toBe("<div>Hello<div>world</div></div>");
  });

  test("t-refs on widget are widgets", async () => {
    class WidgetC extends Widget<TestEnv> {
      name = "a";
      template = `<div>Hello<t t-ref="mywidgetb" t-widget="b"/></div>`;
      widgets = { b: WidgetB };
    }
    const widget = makeWidget(WidgetC);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(widget.refs.mywidgetb instanceof WidgetB).toBe(true);
  });
});
