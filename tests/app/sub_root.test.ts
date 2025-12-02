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

  test("by default, env is the same in sub root", async () => {
    let env, subenv;
    class SC extends SomeComponent {
      setup() {
        env = this.env;
      }
    }
    class Sub extends SubComponent {
      setup() {
        subenv = this.env;
      }
    }

    const app = new App();
    await app.createRoot(SC).mount(fixture);
    const subRoot = app.createRoot(Sub);
    await subRoot.mount(fixture);

    expect(env).toBeDefined();
    expect(subenv).toBeDefined();
    expect(env).toBe(subenv);
  });

  test("env can be specified for sub roots", async () => {
    const env1 = { env1: true };
    const env2 = {};
    let someComponentEnv: any, subComponentEnv: any;
    class SC extends SomeComponent {
      setup() {
        someComponentEnv = this.env;
      }
    }
    class Sub extends SubComponent {
      setup() {
        subComponentEnv = this.env;
      }
    }

    const app = new App({ env: env1 });
    await app.createRoot(SC).mount(fixture);
    const subRoot = app.createRoot(Sub, { env: env2 });
    await subRoot.mount(fixture);

    // because env is different in app => it is given a sub object, frozen and all
    // not sure it is a good idea, but it's the way owl 2 works. maybe we should
    // avoid doing anything with the main env and let user code do it if they
    // want. in that case, we can change the test here to assert that they are equal
    expect(someComponentEnv).not.toBe(env1);
    expect(someComponentEnv!.env1).toBe(true);
    expect(subComponentEnv).toBe(env2);
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
