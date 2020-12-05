import { App } from "../src/app";
import { Component, mount } from "../src/core";
import { makeTestFixture, nextTick } from "./helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("App", () => {
  test("a component can be mounted with an app", async () => {
    class Test extends Component {
      static template = "test";
    }
    const app = new App();
    app.addTemplate("test", `<div class="myapp"/>`);
    await mount(Test, { target: fixture, app });
    expect(fixture.innerHTML).toBe(`<div class="myapp"></div>`);
  });

  test("a component can be used instead of an app", async () => {
    class Child extends Component {
      static template = "child";
    }

    class Parent extends Component {
      static template = "test";
      mounted() {
        mount(Child, { target: this.el! as any, app: this });
      }
    }

    const app = new App();
    app.addTemplate("test", `<div class="myapp"/>`);
    app.addTemplate("child", `<span>child</span>`);
    await mount(Parent, { target: fixture, app });
    expect(fixture.innerHTML).toBe(`<div class="myapp"></div>`);
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div class="myapp"><span>child</span></div>`);
  });
});
