import { AsyncRoot } from "../../src/misc/async_root";
import { useState } from "../../src/hooks";
import { xml } from "../../src/tags";
import { makeDeferred, makeTestFixture, makeTestEnv, nextTick } from "../helpers";
import { Component } from "../../src/component/component";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - a test env, necessary to create components, that is set as env

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
  Component.env = makeTestEnv();
});

afterEach(() => {
  fixture.remove();
});

describe("Asyncroot", () => {
  test("delayed component with AsyncRoot component", async () => {
    let def;
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
    }
    class AsyncChild extends Child {
      willUpdateProps() {
        return def;
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <button t-on-click="updateApp">Update App State</button>
            <div class="children">
              <Child val="state.val"/>
              <AsyncRoot>
                  <AsyncChild val="state.val"/>
              </AsyncRoot>
            </div>
          </div>`;
      static components = { Child, AsyncChild, AsyncRoot };
      state = useState({ val: 0 });

      updateApp() {
        this.state.val++;
      }
    }

    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>0</span><span>0</span>");

    // click on button to increment Parent counter
    def = makeDeferred();
    fixture.querySelector("button")!.click();
    await nextTick();

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>1</span><span>0</span>");

    def.resolve();
    await nextTick();

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>1</span><span>1</span>");
  });

  test("fast component with AsyncRoot", async () => {
    let def;
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
    }
    class AsyncChild extends Child {
      willUpdateProps() {
        return def;
      }
    }

    class Parent extends Component {
      static template = xml`
          <div>
            <button t-on-click="updateApp">Update App State</button>
            <div class="children">
              <AsyncRoot>
                <Child val="state.val"/>
              </AsyncRoot>
              <AsyncChild val="state.val"/>
            </div>
          </div>`;
      static components = { Child, AsyncChild, AsyncRoot };
      state = useState({ val: 0 });

      updateApp() {
        this.state.val++;
      }
    }

    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>0</span><span>0</span>");

    // click on button to increment Parent counter
    def = makeDeferred();
    fixture.querySelector("button")!.click();
    await nextTick();

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>1</span><span>0</span>");

    def.resolve();
    await nextTick();

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>1</span><span>1</span>");
  });

  test("asyncroot component: mixed re-renderings", async () => {
    let def;
    class Child extends Component {
      static template = xml`
        <span t-on-click="increment">
          <t t-esc="state.val"/>/<t t-esc="props.val"/>
        </span>`;
      state = useState({ val: 0 });

      increment() {
        this.state.val++;
      }
    }
    class AsyncChild extends Child {
      willUpdateProps() {
        return def;
      }
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <button t-on-click="updateApp">Update App State</button>
          <div class="children">
            <Child val="state.val"/>
            <AsyncRoot>
              <AsyncChild val="state.val"/>
            </AsyncRoot>
          </div>
        </div>`;
      static components = { Child, AsyncChild, AsyncRoot };
      state = useState({ val: 0 });

      updateApp() {
        this.state.val++;
      }
    }

    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>0/0</span><span>0/0</span>");

    // click on button to increment Parent counter
    def = makeDeferred();
    fixture.querySelector("button")!.click();
    await nextTick();

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>0/1</span><span>0/0</span>");

    // click on each Child to increment their local counter
    const children = parent.el!.querySelectorAll("span");
    children[0]!.click();
    await nextTick();
    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>1/1</span><span>0/0</span>");

    children[1]!.click();
    await nextTick();
    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>1/1</span><span>0/0</span>");

    // finalize first re-rendering (coming from the props update)
    def.resolve();
    await nextTick();

    expect(fixture.querySelector(".children")!.innerHTML).toBe("<span>1/1</span><span>1/1</span>");
  });
});
