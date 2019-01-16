import Widget from "../src/core/widget";
import QWeb from "../src/core/qweb";

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
});
