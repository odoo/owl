import Widget from "../src/core/widget";
import QWeb from "../src/core/qweb_vdom";

function makeWidget(W: typeof Widget): Widget {
  const env = {
    qweb: new QWeb(),
    services: {}
  };
  const w = new W(null);
  w.setEnvironment(env);
  return w;
}

async function click(el: HTMLElement) {
  el.click();
  return Promise.resolve();
}

const template = `
    <div><t t-esc="state.counter"/><button t-on-click="inc">Inc</button></div>
`;

export default class Counter extends Widget {
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
    class StyledWidget extends Widget {
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
    class HookWidget extends Widget {
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
    class HookWidget extends Widget {
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
    class HookWidget extends Widget {
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
  class WidgetA extends Widget {
    name = "a";
    template = `<div>Hello<t t-widget="b"/></div>`;
    widgets = { b: WidgetB };
  }

  class WidgetB extends Widget {
    template = `<div>world</div>`;
  }

  test("a widget with a sub widget", async () => {
    const widget = makeWidget(WidgetA);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(target.innerHTML).toBe("<div>Hello<div>world</div></div>");
  });

  test("t-refs on widget are widgets", async () => {
    class WidgetC extends Widget {
      name = "a";
      template = `<div t-debug="1">Hello<t t-ref="mywidgetb" t-widget="b"/></div>`;
      widgets = { b: WidgetB };
    }
    const widget = makeWidget(WidgetC);
    const target = document.createElement("div");
    await widget.mount(target);
    expect(widget.refs.mywidgetb instanceof WidgetB).toBe(true);
  });
});
