import "jest";
import { Component, Env } from "../../src/component/component";
import { QWeb } from "../../src/qweb";
import { xml } from "../../src/tags";
import { makeTestFixture, makeTestEnv } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - env: a WEnv, necessary to create new components

let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  Component.env = env;
});

afterEach(() => {
  fixture.remove();
});

describe("data-* attributes with t-component", () => {
  test("data-* is properly added on widget root el", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
    }
    class ParentWidget extends Component {
      static template = xml`<div><Child data-foo="42%"/></div>`;
      static components = { Child };
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div data-foo="42%"></div></div>`);
  });

  test("t-att-data-* is properly added on widget root el", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
    }
    class ParentWidget extends Component {
      static template = xml`<div><Child t-att-data-foo="foo.bar"/></div>`;
      static components = { Child };
      foo = { bar: 42 };
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div data-foo="42"></div></div>`);
  });

  test("t-attf-data-* is properly added on widget root el", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
    }
    class ParentWidget extends Component {
      static template = xml`<div><Child t-attf-data-foo="answer is {{foo.bar}}"/></div>`;
      static components = { Child };
      foo = { bar: 42 };
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div data-foo="answer is 42"></div></div>`);
  });

  test("warns in console if same data-* attr added multiple time on widget root el", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
    }
    class ParentWidget extends Component {
      static template = xml`
        <div>
          <Child data-foo="42" t-att-data-foo="foo.bar" t-attf-data-foo="answer is {{foo.bar}}"/>
        </div>
      `;
      static components = { Child };
      foo = { bar: 42 };
    }
    const isDev = QWeb.dev;
    QWeb.dev = true;
    const consoleSpy = jest.spyOn(console, "warn");
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(consoleSpy).toHaveBeenCalledTimes(3);
    QWeb.dev = isDev;
  });
});
