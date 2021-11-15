import { App, Component, mount, xml } from "../../src";
import { makeTestFixture } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("env handling", () => {
  test("has an env by default", async () => {
    class Test extends Component {
      static template = xml`<div/>`;
    }
    const component = await mount(Test, fixture);
    expect(component.env).toEqual({});
  });

  test("env is shallow frozen", async () => {
    const env = { foo: 42, bar: { value: 42 } };
    class Test extends Component {
      static template = xml`<div/>`;
    }
    const component = await new App(Test).configure({ env }).mount(fixture);
    expect(Object.isFrozen(component.env)).toBeTruthy();
    expect(component.env).toEqual({ foo: 42, bar: { value: 42 } });
    expect(() => {
      component.env.foo = 23;
    }).toThrow(/Cannot assign to read only property 'foo' of object/);
    component.env.bar.value = 23;
    expect(component.env).toEqual({ foo: 42, bar: { value: 23 } });
  });

  test("parent env is propagated to child components", async () => {
    const env = { foo: 42, bar: { value: 42 } };
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

    await new App(Test).configure({ env }).mount(fixture);
    expect(child.env).toEqual(env);
  });
});
