import { Context } from "../src/context";
import { Component, mount } from "../src/core";
import { makeTestFixture, nextTick } from "./helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("Context", () => {
  test("a component can be mounted with an context", async () => {
    class Test extends Component {
      static template = "test";
    }
    const context = new Context();
    context.addTemplate("test", `<div class="myapp"/>`);
    await mount(Test, { target: fixture, context });
    expect(fixture.innerHTML).toBe(`<div class="myapp"></div>`);
  });

  test("a component can be used instead of a context", async () => {
    class Child extends Component {
      static template = "child";
    }

    class Parent extends Component {
      static template = "test";
      mounted() {
        mount(Child, { target: this.el! as any, context: this });
      }
    }

    const context = new Context();
    context.addTemplate("test", `<div class="myapp"/>`);
    context.addTemplate("child", `<span>child</span>`);
    await mount(Parent, { target: fixture, context });
    expect(fixture.innerHTML).toBe(`<div class="myapp"></div>`);
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div class="myapp"><span>child</span></div>`);
  });
});
