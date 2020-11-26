import { Portal } from "../../src/misc/portal";
import { xml } from "../../src/tags";
import { makeTestFixture, makeTestEnv, nextTick } from "../helpers";
import { Component } from "../../src/component/component";
import { useState } from "../../src/hooks";
import { QWeb } from "../../src/qweb";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - outside: a div with id #outside appended into fixture, meant to be used as
//   target by Portal component
// - a test env, necessary to create components, that is set on Component

let fixture: HTMLElement;
let outside: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
  outside = document.createElement("div");
  outside.setAttribute("id", "outside");
  fixture.appendChild(outside);

  Component.env = makeTestEnv();
});

afterEach(() => {
  fixture.remove();
});

describe("Portal: Props validation", () => {
  test("target is mandatory", async () => {
    const dev = QWeb.dev;
    QWeb.dev = true;
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal>
            <div>2</div>
          </Portal>
        </div>`;
    }
    let error;
    try {
      const parent = new Parent();
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(`Missing props 'target' (component 'Portal')`);

    QWeb.dev = dev;
  });

  test("target is not list", async () => {
    const dev = QWeb.dev;
    QWeb.dev = true;
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="['body']">
            <div>2</div>
          </Portal>
        </div>`;
    }
    let error;
    try {
      const parent = new Parent();
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(`Invalid Prop 'target' in component 'Portal'`);

    QWeb.dev = dev;
  });
});

describe("Portal: Basic use and DOM placement", () => {
  test("basic use of portal", async () => {
    const dev = QWeb.dev;
    QWeb.dev = true;
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <span>1</span>
          <Portal target="'#outside'">
            <div>2</div>
          </Portal>
        </div>`;
    }
    let error;
    let parent;
    try {
      parent = new Parent();
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    await parent.mount(fixture);
    expect(outside.innerHTML).toBe("<div>2</div>");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span><portal></portal></div>");
    QWeb.dev = dev;
  });

  test("conditional use of Portal", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <span>1</span>
          <Portal target="'#outside'" t-if="state.hasPortal">
            <div>2</div>
          </Portal>
        </div>`;

      state = useState({ hasPortal: false });
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(outside.innerHTML).toBe("");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span></div>");

    parent.state.hasPortal = true;
    await nextTick();
    expect(outside.innerHTML).toBe("<div>2</div>");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span><portal></portal></div>");

    parent.state.hasPortal = false;
    await nextTick();
    expect(outside.innerHTML).toBe("");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span></div>");

    parent.state.hasPortal = true;
    await nextTick();
    expect(outside.innerHTML).toBe("<div>2</div>");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span><portal></portal></div>");
  });

  test("conditional use of Portal (with sub Component)", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="props.val"/></div>`;
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div>
          <span>1</span>
          <Portal t-if="state.hasPortal" target="'#outside'">
            <Child val="state.val"/>
          </Portal>
        </div>`;
      state = useState({ hasPortal: false, val: 1 });
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(outside.innerHTML).toBe("");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span></div>");

    parent.state.hasPortal = true;
    await nextTick();
    expect(outside.innerHTML).toBe("<div>1</div>");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span><portal></portal></div>");

    parent.state.hasPortal = false;
    await nextTick();
    expect(outside.innerHTML).toBe("");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span></div>");

    parent.state.val = 2;
    await nextTick();
    expect(outside.innerHTML).toBe("");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span></div>");

    parent.state.hasPortal = true;
    await nextTick();
    expect(outside.innerHTML).toBe("<div>2</div>");
    expect(parent.el!.outerHTML).toBe("<div><span>1</span><portal></portal></div>");
  });

  test("with target in template (before portal)", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <div id="local-target"></div>
          <span>1</span>
          <Portal target="'#local-target'">
            <p>2</p>
          </Portal>
        </div>`;
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(parent.el!.innerHTML).toBe(
      '<div id="local-target"><p>2</p></div><span>1</span><portal></portal>'
    );
  });

  test("with target in template (after portal)", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <span>1</span>
          <Portal target="'#local-target'">
            <p>2</p>
          </Portal>
          <div id="local-target"></div>
        </div>`;
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(parent.el!.innerHTML).toBe(
      '<span>1</span><portal></portal><div id="local-target"><p>2</p></div>'
    );
  });

  test("portal with target not in dom", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#does-not-exist'">
            <div>2</div>
          </Portal>
        </div>`;
    }

    const parent = new Parent();
    let error;
    try {
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.message).toBe('Could not find any match for "#does-not-exist"');
    expect(console.error).toBeCalledTimes(0);
    expect(fixture.innerHTML).toBe(`<div id="outside"></div>`);
    console.error = consoleError;
  });

  test("portal with child and props", async () => {
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
      mounted() {
        steps.push("mounted");
        expect(outside.innerHTML).toBe("<span>1</span>");
      }
      patched() {
        steps.push("patched");
        expect(outside.innerHTML).toBe("<span>2</span>");
      }
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <Child val="state.val"/>
          </Portal>
        </div>`;
      state = useState({ val: 1 });
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(outside.innerHTML).toBe("<span>1</span>");
    expect(parent.el!.innerHTML).toBe("<portal></portal>");

    parent.state.val = 2;
    await nextTick();
    expect(outside.innerHTML).toBe("<span>2</span>");
    expect(parent.el!.innerHTML).toBe("<portal></portal>");
    expect(steps).toEqual(["mounted", "patched"]);
  });

  test("portal with only text as content", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <t t-esc="'only text'"/>
          </Portal>
        </div>`;
    }

    const parent = new Parent();
    let error;
    try {
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Portal must have exactly one non-text child (has 0)");
    expect(console.error).toBeCalledTimes(0);
    expect(fixture.innerHTML).toBe(`<div id="outside"></div>`);
    console.error = consoleError;
  });

  test("portal with no content", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <t t-if="false" t-esc="'ABC'"/>
          </Portal>
        </div>`;
    }

    const parent = new Parent();
    let error;
    try {
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Portal must have exactly one non-text child (has 0)");
    expect(console.error).toBeCalledTimes(0);
    expect(fixture.innerHTML).toBe(`<div id="outside"></div>`);
    console.error = consoleError;
  });

  test("portal with many children", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <div>1</div>
            <p>2</p>
          </Portal>
        </div>`;
    }
    const parent = new Parent();
    let error;
    try {
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Portal must have exactly one non-text child (has 2)");
    expect(console.error).toBeCalledTimes(0);
    expect(fixture.innerHTML).toBe(`<div id="outside"></div>`);
    console.error = consoleError;
  });

  test("portal with dynamic body", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <span t-if="state.val" t-esc="state.val"/>
            <div t-else=""/>
          </Portal>
        </div>`;
      state = useState({ val: "ab" });
    }

    const parent = new Parent();
    await parent.mount(fixture);

    expect(outside.innerHTML).toBe(`<span>ab</span>`);

    parent.state.val = "";
    await nextTick();
    expect(outside.innerHTML).toBe(`<div></div>`);
  });

  test("portal could have dynamically no content", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <span t-if="state.val" t-esc="state.val"/>
          </Portal>
        </div>`;
      state = { val: "ab" };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(outside.innerHTML).toBe(`<span>ab</span>`);

    let error;
    try {
      parent.state.val = "";
      await parent.render();
    } catch (e) {
      error = e;
    }
    expect(outside.innerHTML).toBe(``);

    expect(error).toBeDefined();
    expect(error.message).toBe("Portal must have exactly one non-text child (has 0)");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("lifecycle hooks of portal sub component are properly called", async () => {
    const steps: any[] = [];

    class Child extends Component {
      static template = xml`<span t-esc="props.val"/>`;
      mounted() {
        steps.push("child:mounted");
      }
      willPatch() {
        steps.push("child:willPatch");
      }
      patched() {
        steps.push("child:patched");
      }
      willUnmount() {
        steps.push("child:willUnmount");
      }
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div>
          <Portal t-if="state.hasChild" target="'#outside'">
            <Child val="state.val"/>
          </Portal>
        </div>`;
      state = useState({ hasChild: false, val: 1 });
      mounted() {
        steps.push("parent:mounted");
      }
      willPatch() {
        steps.push("parent:willPatch");
      }
      patched() {
        steps.push("parent:patched");
      }
      willUnmount() {
        steps.push("parent:willUnmount");
      }
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(steps).toEqual(["parent:mounted"]);

    parent.state.hasChild = true;
    await nextTick();
    expect(steps).toEqual([
      "parent:mounted",
      "parent:willPatch",
      "child:mounted",
      "parent:patched",
    ]);

    parent.state.val = 2;
    await nextTick();
    expect(steps).toEqual([
      "parent:mounted",
      "parent:willPatch",
      "child:mounted",
      "parent:patched",
      "parent:willPatch",
      "child:willPatch",
      "child:patched",
      "parent:patched",
    ]);

    parent.state.hasChild = false;
    await nextTick();
    expect(steps).toEqual([
      "parent:mounted",
      "parent:willPatch",
      "child:mounted",
      "parent:patched",
      "parent:willPatch",
      "child:willPatch",
      "child:patched",
      "parent:patched",
      "parent:willPatch",
      "child:willUnmount",
      "parent:patched",
    ]);
  });

  test("portal destroys on crash", async () => {
    class Child extends Component {
      static template = xml`<span t-esc="props.error and this.will.crash" />`;
      state = {};
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div>
          <Portal target="'#outside'" >
            <Child error="state.error"/>
          </Portal>
        </div>`;
      state = { error: false };
    }

    const parent = new Parent();
    await parent.mount(fixture);
    parent.state.error = true;

    let error;
    try {
      await parent.render();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");
  });

  test("portal manual unmount", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <span>gloria</span>
          </Portal>
        </div>`;
    }

    const parent = new Parent();
    await parent.mount(fixture);

    expect(outside.innerHTML).toBe("<span>gloria</span>");
    expect(parent.el!.innerHTML).toBe("<portal></portal>");

    parent.unmount();
    expect(outside.innerHTML).toBe("");
    expect(parent.el!.innerHTML).toBe("<portal><span>gloria</span></portal>");

    await parent.mount(fixture);
    expect(outside.innerHTML).toBe("<span>gloria</span>");
    expect(parent.el!.innerHTML).toBe("<portal></portal>");
  });

  test("portal manual unmount with subcomponent", async () => {
    expect.assertions(9);
    class Child extends Component {
      static template = xml`<span>gloria</span>`;
      mounted() {
        expect(outside.contains(this.el)).toBeTruthy();
      }
      willUnmount() {
        expect(outside.contains(this.el)).toBeTruthy();
      }
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <Child />
          </Portal>
        </div>`;
    }

    const parent = new Parent();
    await parent.mount(fixture);

    expect(outside.innerHTML).toBe("<span>gloria</span>");
    expect(parent.el!.innerHTML).toBe("<portal></portal>");

    parent.unmount();
    expect(outside.innerHTML).toBe("");
    expect(parent.el!.innerHTML).toBe("<portal><span>gloria</span></portal>");

    await parent.mount(fixture);
    expect(outside.innerHTML).toBe("<span>gloria</span>");
    expect(parent.el!.innerHTML).toBe("<portal></portal>");
  });
});

describe("Portal: Events handling", () => {
  test("events triggered on movable pure node are handled", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <span id="trigger-me" t-on-custom="_onCustom" t-esc="state.val"/>
          </Portal>
        </div>`;
      state = useState({ val: "ab" });

      _onCustom() {
        this.state.val = "triggered";
      }
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(outside.innerHTML).toBe(`<span id="trigger-me">ab</span>`);
    outside.querySelector("#trigger-me")!.dispatchEvent(new Event("custom"));
    await nextTick();
    expect(outside.innerHTML).toBe(`<span id="trigger-me">triggered</span>`);
  });

  test("events triggered on movable owl components are redirected", async () => {
    let childInst: Component | null = null;
    class Child extends Component {
      static template = xml`
         <span t-on-custom="_onCustom" t-esc="props.val"/>`;

      constructor(parent, props) {
        super(parent, props);
        childInst = this;
      }

      _onCustom() {
        this.trigger("custom-portal");
      }
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div t-on-custom-portal="_onCustomPortal">
          <Portal target="'#outside'">
            <Child val="state.val"/>
          </Portal>
        </div>`;
      state = useState({ val: "ab" });

      _onCustomPortal() {
        this.state.val = "triggered";
      }
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(outside.innerHTML).toBe(`<span>ab</span>`);
    childInst!.trigger("custom");
    await nextTick();
    expect(outside.innerHTML).toBe(`<span>triggered</span>`);
  });

  test("events triggered on contained movable owl components are redirected", async () => {
    const steps: string[] = [];
    let childInst: Component | null = null;
    class Child extends Component {
      static template = xml`
         <span t-on-custom="_onCustom"/>`;

      constructor(parent, props) {
        super(parent, props);
        childInst = this;
      }

      _onCustom() {
        this.trigger("custom-portal");
      }
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div t-on-custom="_handled" t-on-custom-portal="_handled">
          <Portal target="'#outside'">
            <div>
              <Child/>
            </div>
          </Portal>
        </div>`;

      _handled(ev) {
        steps.push(ev.type);
      }
    }
    const parent = new Parent();
    await parent.mount(fixture);

    childInst!.trigger("custom");
    await nextTick();

    // This is expected because trigger is synchronous
    expect(steps).toMatchObject(["custom-portal", "custom"]);
  });

  test("Dom events are not mapped", async () => {
    let childInst: Component | null = null;
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`
        <button>child</button>`;

      constructor(parent, props) {
        super(parent, props);
        childInst = this;
      }
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div t-on-click="_handled">
          <Portal target="'#outside'">
            <Child />
          </Portal>
        </div>`;

      _handled(ev) {
        steps.push(ev.type as string);
      }
    }
    const bodyListener = (ev) => {
      steps.push(`body: ${ev.type}`);
    };
    document.body.addEventListener("click", bodyListener);

    const parent = new Parent();
    await parent.mount(fixture);
    childInst!.el!.click();

    expect(steps).toEqual(["body: click"]);
    document.body.removeEventListener("click", bodyListener);
  });

  test("Nested portals event propagation", async () => {
    const outside2 = document.createElement("div");
    outside2.setAttribute("id", "outside2");
    fixture.appendChild(outside2);

    const steps: Array<string> = [];
    let childInst: Component | null = null;
    class Child2 extends Component {
      static template = xml`<div>child2</div>`;
      constructor(parent, props) {
        super(parent, props);
        childInst = this;
      }
    }
    class Child extends Component {
      static components = { Portal, Child2 };
      static template = xml`
        <Portal target="'#outside2'">
          <Child2 />
        </Portal>`;
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div t-on-custom='_handled'>
          <Portal target="'#outside'">
            <Child/>
          </Portal>
        </div>`;

      _handled(ev) {
        steps.push(`${ev.type} from ${ev.originalComponent.constructor.name}`);
      }
    }

    const parent = new Parent();
    await parent.mount(fixture);

    childInst!.trigger("custom");
    expect(steps).toEqual(["custom from Child2"]);
  });

  test("portal's parent's env is not polluted", async () => {
    class Child extends Component {
      static template = xml`
        <button>child</button>`;
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <Child />
          </Portal>
        </div>`;
    }
    const parent = new Parent();
    const parentEnv = Object.assign({}, parent.env);
    await parent.mount(fixture);
    expect(parentEnv).toStrictEqual(parent.env);
  });

  test("Portal composed with t-slot", async () => {
    const steps: Array<string> = [];
    let childInst: Component | null = null;
    class Child2 extends Component {
      static template = xml`<div>child2</div>`;
      constructor(parent, props) {
        super(parent, props);
        childInst = this;
      }
    }
    class Child extends Component {
      static components = { Portal, Child2 };
      static template = xml`
        <Portal target="'#outside'">
          <t t-slot="default"/>
        </Portal>`;
    }
    class Parent extends Component {
      static components = { Child, Child2 };
      static template = xml`
        <div t-on-custom='_handled'>
          <Child>
            <Child2/>
          </Child>
        </div>`;

      _handled(ev) {
        steps.push(ev.type as string);
      }
    }

    const parent = new Parent();
    await parent.mount(fixture);

    childInst!.trigger("custom");
    expect(steps).toEqual(["custom"]);
  });
});

describe("Portal: UI/UX", () => {
  test("focus is kept across re-renders", async () => {
    class Child extends Component {
      static template = xml`
        <input id="target-me" t-att-placeholder="props.val"/>`;
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
        <div>
          <Portal target="'#outside'">
            <Child val="state.val"/>
          </Portal>
        </div>`;
      state = useState({ val: "ab" });
    }
    const parent = new Parent();
    await parent.mount(fixture);
    const input = document.querySelector("#target-me");
    expect(input!.nodeName).toBe("INPUT");
    expect((input as HTMLInputElement).placeholder).toBe("ab");

    (input as HTMLInputElement).focus();
    expect(document.activeElement === input).toBeTruthy();

    parent.state.val = "bc";
    await nextTick();
    const inputReRendered = document.querySelector("#target-me");
    expect(inputReRendered!.nodeName).toBe("INPUT");
    expect((inputReRendered as HTMLInputElement).placeholder).toBe("bc");
    expect(document.activeElement === inputReRendered).toBeTruthy();
  });
});
