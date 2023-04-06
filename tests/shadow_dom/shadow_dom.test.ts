import { App, Component, useRef, xml } from "../../src";
import { status } from "../../src/runtime/status";
import { makeTestFixture, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("shadow_dom", () => {
  test("can mount app", async () => {
    class SomeComponent extends Component {
      static template = xml`<div class="my-div"/>`;
    }

    const container = document.createElement("div");
    fixture.appendChild(container);
    const shadow = container.attachShadow({ mode: "open" });
    const app = new App(SomeComponent);
    const comp = await app.mount(shadow);
    const div = shadow.querySelector(".my-div");
    expect(div).not.toBe(null);
    expect(shadow.contains(div)).toBe(true);
    app.destroy();
    expect(shadow.contains(div)).toBe(false);
    expect(status(comp)).toBe("destroyed");
  });

  test("can bind event handler", async () => {
    let a = 1;
    class SomeComponent extends Component {
      static template = xml`<button t-on-click="add">Click</button>`;

      add() {
        a = 3;
      }
    }
    const container = document.createElement("div");
    fixture.appendChild(container);
    const shadow = container.attachShadow({ mode: "open" });
    await new App(SomeComponent).mount(shadow);
    expect(a).toBe(1);
    shadow.querySelector("button")!.click();
    expect(a).toBe(3);
  });

  test("useRef hook", async () => {
    let comp: SomeComponent;
    class SomeComponent extends Component {
      static template = xml`<div t-ref="refName" class="my-div"/>`;
      div = useRef("refName");
      setup() {
        comp = this;
      }
    }
    const container = document.createElement("div");
    fixture.appendChild(container);
    const shadow = container.attachShadow({ mode: "open" });
    const mountedProm = new App(SomeComponent).mount(shadow);
    expect(comp!.div.el).toBe(null);
    await mountedProm;
    expect(comp!.div.el).toBe(shadow.querySelector(".my-div"));
  });
});
