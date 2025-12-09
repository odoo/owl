import { App, Component, onMounted, onWillDestroy, useRef, proxy, xml } from "../../src";
import { status } from "../../src/runtime/status";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

class SomeComponent extends Component {
  static template = xml`<div>main app</div>`;
}

class SubComponent extends Component {
  static template = xml`<div>sub root</div>`;
}

describe("subroot", () => {
  test("can mount subroot", async () => {
    const app = new App();
    const comp = await app.createRoot(SomeComponent).mount(fixture);
    expect(fixture.innerHTML).toBe("<div>main app</div>");
    const subRoot = app.createRoot(SubComponent);
    const subcomp = await subRoot.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>main app</div><div>sub root</div>");

    app.destroy();
    expect(fixture.innerHTML).toBe("");
    expect(status(comp)).toBe("destroyed");
    expect(status(subcomp)).toBe("destroyed");
  });

  test("can mount subroot inside own dom", async () => {
    const app = new App();
    const comp = await app.createRoot(SomeComponent).mount(fixture);
    expect(fixture.innerHTML).toBe("<div>main app</div>");
    const subRoot = app.createRoot(SubComponent);
    const subcomp = await subRoot.mount(fixture.querySelector("div")!);
    expect(fixture.innerHTML).toBe("<div>main app<div>sub root</div></div>");

    app.destroy();
    expect(fixture.innerHTML).toBe("");
    expect(status(comp)).toBe("destroyed");
    expect(status(subcomp)).toBe("destroyed");
  });

  test("subcomponents can be destroyed, and it properly cleanup the subroots", async () => {
    const app = new App();
    const comp = await app.createRoot(SomeComponent).mount(fixture);
    expect(fixture.innerHTML).toBe("<div>main app</div>");
    const root = app.createRoot(SubComponent);
    const subcomp = await root.mount(fixture.querySelector("div")!);
    expect(fixture.innerHTML).toBe("<div>main app<div>sub root</div></div>");

    root.destroy();
    expect(fixture.innerHTML).toBe("<div>main app</div>");
    expect(status(comp)).not.toBe("destroyed");
    expect(status(subcomp)).toBe("destroyed");
  });

  test("can create a root in a setup function, then use a hook", async () => {
    class C extends Component {
      static template = xml`c`;
    }

    class A extends Component {
      static template = xml`a`;
      state: any;
      setup() {
        app.createRoot(C);
        this.state = proxy({ value: 1 });
      }
    }

    const app = new App();
    await app.createRoot(A).mount(fixture);
    expect(fixture.innerHTML).toBe("a");
  });
});

test("destroy a subroot while another component is mounted in main app", async () => {
  class C extends Component {
    static template = xml`c`;
  }

  class ChildA extends Component {
    static template = xml`a<div t-ref="elem"></div>`;
    ref: any;
    setup() {
      this.ref = useRef("elem");
      let root = app.createRoot(C);
      onMounted(() => {
        root.mount(this.ref.el);
      });
      onWillDestroy(() => {
        root.destroy();
      });
    }
  }
  class ChildB extends Component {
    static template = xml`b`;
  }

  class SomeComponent extends Component {
    static template = xml`
        <t t-if="state.flag"><ChildB/></t>
        <t t-else=""><ChildA/></t>
        `;
    static components = { ChildA, ChildB };
    state = proxy({ flag: false });
  }

  const app = new App();
  const comp = await app.createRoot(SomeComponent).mount(fixture);
  expect(fixture.innerHTML).toBe("a<div></div>");
  await nextTick();
  expect(fixture.innerHTML).toBe("a<div>c</div>");
  comp.state.flag = true;
  await nextTick();
  expect(fixture.innerHTML).toBe("b");
});
