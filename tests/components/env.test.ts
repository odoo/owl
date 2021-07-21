import { App, Component, mount, xml } from "../../src";
import { makeTestFixture } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("env handling", () => {
  test("keeps a reference to env", async () => {
    const env = {};
    class Test extends Component {
      static template = xml`<div/>`;
    }
    const app = new App(Test);
    app.configure({ env });
    const component = await app.mount(fixture);
    expect(component.env).toBe(env);
  });

  test("has an env by default", async () => {
    class Test extends Component {
      static template = xml`<div/>`;
    }
    const component = await mount(Test, fixture);
    expect(component.env).toEqual({});
  });

  test("parent env is propagated to child components", async () => {
    const env = {};
    let child: any = null;

    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        child = this;
      }
    }

    class Test extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }

    const app = new App(Test);
    app.configure({ env });
    await app.mount(fixture);
    expect(child.env).toBe(env);
  });
});
