import { Component, Env } from "../../src/component/component";
import { QWeb } from "../../src/qweb/qweb";
import { xml } from "../../src/tags";
import { useState, useRef } from "../../src/hooks";
import { makeTestFixture, makeTestEnv, nextTick } from "../helpers";

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

describe("class and style attributes with t-component", () => {
  test("class is properly added on widget root el", async () => {
    class Child extends Component {
      static template = xml`<div class="c"/>`;
    }
    class ParentWidget extends Component {
      static template = xml`<div><Child class="a b"/></div>`;
      static components = { Child };
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="c a b"></div></div>`);
  });

  test("empty class attribute is not added on widget root el", async () => {
    class Child extends Component {
      static template = xml`<span/>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child class=""/></div>`;
      static components = { Child };
    }
    const widget = new Parent();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><span></span></div>`);
  });

  test("t-att-class is properly added/removed on widget root el", async () => {
    class Child extends Component {
      static template = xml`<div class="c"/>`;
    }
    class ParentWidget extends Component {
      static template = xml`<div><Child t-att-class="{a:state.a, b:state.b}"/></div>`;
      static components = { Child };
      state = useState({ a: true, b: false });
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="c a"></div></div>`);
    expect(QWeb.TEMPLATES[ParentWidget.template].fn.toString());

    widget.state.a = false;
    widget.state.b = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div><div class="c b"></div></div>`);
  });

  test("class with extra whitespaces", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `<div>
              <Child class="a  b c   d"/>
        </div>`
    );
    class Child extends Component {}
    class ParentWidget extends Component {
      static components = { Child };
    }
    env.qweb.addTemplate("Child", `<div/>`);
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div class="a b c d"></div></div>`);
  });

  test("t-att-class is properly added/removed on widget root el (v2)", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="ParentWidget">
            <Child class="a" t-att-class="{ b: state.b }" t-ref="child"/>
          </div>
          <span t-name="Child" class="c" t-att-class="{ d: state.d }"/>
        </templates>`);

    class Child extends Component {
      state = useState({ d: true });
    }
    class ParentWidget extends Component {
      static components = { Child };
      state = useState({ b: true });
      child = useRef("child");
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);

    const span = fixture.querySelector("span")!;
    expect(span.className).toBe("c d a b");

    widget.state.b = false;
    await nextTick();
    expect(span.className).toBe("c d a");

    (widget.child.comp as Child).state.d = false;
    await nextTick();
    expect(span.className).toBe("c a");

    widget.state.b = true;
    await nextTick();
    expect(span.className).toBe("c a b");

    (widget.child.comp as Child).state.d = true;
    await nextTick();
    expect(span.className).toBe("c a b d");
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.Child.fn.toString()).toMatchSnapshot();
  });

  test("t-att-class is properly added/removed on widget root el (v3)", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="ParentWidget">
            <Child class="a" t-att-class="state.b ? 'b' : ''" t-ref="child"/>
          </div>
          <span t-name="Child" class="c" t-att-class="state.d ? 'd' : ''"/>
        </templates>`);

    class Child extends Component {
      state = useState({ d: true });
    }
    class ParentWidget extends Component {
      static components = { Child };
      state = useState({ b: true });
      child = useRef("child");
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);

    const span = fixture.querySelector("span")!;
    expect(span.className).toBe("c d a b");

    widget.state.b = false;
    await nextTick();
    expect(span.className).toBe("c d a");

    (widget.child.comp as Child).state.d = false;
    await nextTick();
    expect(span.className).toBe("c a");

    widget.state.b = true;
    await nextTick();
    expect(span.className).toBe("c a b");

    (widget.child.comp as Child).state.d = true;
    await nextTick();
    expect(span.className).toBe("c a b d");
    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.Child.fn.toString()).toMatchSnapshot();
  });

  test("class on components do not interfere with user defined classes", async () => {
    env.qweb.addTemplates(`
        <templates>
          <div t-name="App" t-att-class="{ c: state.c }" />
        </templates>`);

    class App extends Component {
      state = useState({ c: true });
      mounted() {
        this.el!.classList.add("user");
      }
    }

    const widget = new App();
    await widget.mount(fixture);

    expect(fixture.innerHTML).toBe('<div class="c user"></div>');

    widget.state.c = false;
    await nextTick();

    expect(fixture.innerHTML).toBe('<div class="user"></div>');
  });

  test("style is properly added on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
          <div>
              <t t-component="child" style="font-weight: bold;"/>
          </div>`
    );

    class SomeComponent extends Component {
      static template = xml`<div/>`;
    }

    class ParentWidget extends Component {
      static components = { child: SomeComponent };
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div><div style="font-weight: bold;"></div></div>`);
  });

  test("dynamic t-att-style is properly added and updated on widget root el", async () => {
    env.qweb.addTemplate(
      "ParentWidget",
      `
          <div>
              <t t-component="child" t-att-style="state.style"/>
          </div>`
    );

    class SomeComponent extends Component {
      static template = xml`<div/>`;
    }

    class ParentWidget extends Component {
      static components = { child: SomeComponent };
      state = useState({ style: "font-size: 20px" });
    }
    const widget = new ParentWidget();
    await widget.mount(fixture);

    expect(env.qweb.templates.ParentWidget.fn.toString()).toMatchSnapshot();

    expect(fixture.innerHTML).toBe(`<div><div style="font-size: 20px;"></div></div>`);

    widget.state.style = "font-size: 30px";
    await nextTick();

    expect(fixture.innerHTML).toBe(`<div><div style="font-size: 30px;"></div></div>`);
  });

  test("error in subcomponent with class", async () => {
    class Child extends Component {
      static template = xml`<div t-esc="this.will.crash"/>`;
    }
    class ParentWidget extends Component {
      static template = xml`<div><Child class="a"/></div>`;
      static components = { Child };
    }
    const widget = new ParentWidget();
    let error;
    try {
      await widget.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");
    expect(fixture.innerHTML).toBe("");
  });
});
