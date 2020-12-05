import { Component, mount } from "../../src/core";
import { xml } from "../../src/index";
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
    const component = await mount(Test, { target: fixture, env });
    expect(component.env).toBe(env);
  });

  test("has an env by default", async () => {
    class Test extends Component {
      static template = xml`<div/>`;
    }
    const component = await mount(Test, { target: fixture });
    expect(component.env).toEqual({});
  });
});
