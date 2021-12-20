import {
  App,
  Component,
  mount,
  onError,
  onMounted,
  onPatched,
  onWillPatch,
  onWillUnmount,
  useState,
} from "../../src";
import { Portal } from "../../src/";
import { xml } from "../../src/tags";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;

function addOutsideDiv(fixture: HTMLElement): HTMLElement {
  let outside = document.createElement("div");
  outside.setAttribute("id", "outside");
  fixture.appendChild(outside);
  return outside;
}

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
  mockConsoleWarn = jest.fn(() => {});
  console.warn = mockConsoleWarn;
});

afterEach(() => {
  console.warn = originalconsoleWarn;
});

describe("Portal", () => {
  test("basic use of portal", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
          <div>
            <span>1</span>
            <Portal target="'#outside'">
              <p>2</p>
            </Portal>
          </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"><p>2</p></div><div><span>1</span></div>');
  });

  test("conditional use of Portal", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
            <span>1</span>
            <Portal target="'#outside'" t-if="state.hasPortal">
              <p>2</p>
            </Portal>`;

      state = useState({ hasPortal: false });
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside"></div><span>1</span>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"><p>2</p></div><span>1</span>');

    parent.state.hasPortal = false;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div><span>1</span>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"><p>2</p></div><span>1</span>');
  });

  test("conditional use of Portal (with sub Component)", async () => {
    class Child extends Component {
      static template = xml`<p><t t-esc="props.val"/></p>`;
    }
    class Parent extends Component {
      static components = { Portal, Child };
      static template = xml`
              <span>1</span>
              <Portal t-if="state.hasPortal" target="'#outside'">
                <Child val="state.val"/>
              </Portal>`;
      state = useState({ hasPortal: false, val: 1 });
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"></div><span>1</span>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"><p>1</p></div><span>1</span>');

    parent.state.hasPortal = false;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div><span>1</span>');

    parent.state.val = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div><span>1</span>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"><p>2</p></div><span>1</span>');
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

    const parent = await mount(Parent, fixture);
    expect((parent.el as any)!.innerHTML).toBe(
      '<div id="local-target"><p>2</p></div><span>1</span>'
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

    const parent = await mount(Parent, fixture);
    expect((parent.el as any)!.innerHTML).toBe(
      '<span>1</span><div id="local-target"><p>2</p></div>'
    );
  });

  test("portal with target not in dom", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
            <div>
              <Portal target="'#does-not-exist'">
                <div>2</div>
              </Portal>
            </div>`;
    }

    let error: Error;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e as Error;
    }

    expect(error!).toBeDefined();
    expect(error!.message).toBe("invalid portal target");
    expect(fixture.innerHTML).toBe(`<div></div>`);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("portal with child and props", async () => {
    const steps: string[] = [];
    const outside = addOutsideDiv(fixture);

    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;

      setup() {
        onMounted(() => {
          steps.push("mounted");
          expect(outside.innerHTML).toBe("<span>1</span>");
        });
        onPatched(() => {
          steps.push("patched");
          expect(outside.innerHTML).toBe("<span>2</span>");
        });
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

    const parent = await mount(Parent, fixture);
    expect(outside.innerHTML).toBe("<span>1</span>");
    expect((parent.el as any).innerHTML).toBe("");

    parent.state.val = 2;
    await nextTick();
    expect(outside.innerHTML).toBe("<span>2</span>");
    expect((parent.el as any).innerHTML).toBe("");
    expect(steps).toEqual(["mounted", "patched"]);
  });

  test("portal with only text as content", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
            <div>
              <Portal target="'#outside'">
                <t t-esc="'only text'"/>
              </Portal>
            </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside">only text</div><div></div>');
  });

  test("portal with no content", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
            <div>
              <Portal target="'#outside'">
                <t t-if="false" t-esc="'ABC'"/>
              </Portal>
            </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div id="outside"></div><div></div>`);
  });

  test("portal with many children", async () => {
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
    addOutsideDiv(fixture);
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside"><div>1</div><p>2</p></div><div></div>');
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

    const outside = addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    expect(outside.innerHTML).toBe(`<span>ab</span>`);

    parent.state.val = "";
    await nextTick();
    expect(outside.innerHTML).toBe(`<div></div>`);
  });

  test("portal could have dynamically no content", async () => {
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
            <div>
              <Portal target="'#outside'">
                <span t-if="state.val" t-esc="state.val"/>
              </Portal>
            </div>`;
      state = useState({ val: "ab" });
    }
    const outside = addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    expect(outside.innerHTML).toBe(`<span>ab</span>`);

    parent.state.val = "";
    await nextTick();
    expect(outside.innerHTML).toBe(``);
  });

  test("lifecycle hooks of portal sub component are properly called", async () => {
    const steps: any[] = [];

    class Child extends Component {
      static template = xml`<span t-esc="props.val"/>`;
      setup() {
        onMounted(() => steps.push("child:mounted"));
        onWillPatch(() => steps.push("child:willPatch"));
        onPatched(() => steps.push("child:patched"));
        onWillUnmount(() => steps.push("child:willUnmount"));
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
      setup() {
        onMounted(() => steps.push("parent:mounted"));
        onWillPatch(() => steps.push("parent:willPatch"));
        onPatched(() => steps.push("parent:patched"));
        onWillUnmount(() => steps.push("parent:willUnmount"));
      }
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);
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
      setup() {
        onError((e) => (error = e));
      }
    }
    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    let error: Error;
    parent.state.error = true;
    parent.render();
    await nextTick();
    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
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
    const env = {};
    const app = new App(Parent);
    app.configure({ env });
    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);
    expect(parent.env).toStrictEqual({});
  });

  test("Portal composed with t-slot", async () => {
    const steps: Array<string> = [];
    let childInst: Component | null = null;
    class Child2 extends Component {
      static template = xml`<div t-on-custom="onCustom"><span id="childSpan">child2</span></div>`;
      setup() {
        childInst = this;
      }
      onCustom(ev: Event) {
        this.props.customHandler(ev);
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
            <div>
              <Child>
                <Child2 customHandler="_handled"/>
              </Child>
            </div>`;

      _handled(ev: Event) {
        steps.push(ev.type as string);
      }
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);

    childInst!.el!.dispatchEvent(new CustomEvent("custom"));
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
    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);
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

describe("Portal: Props validation", () => {
  test("target is mandatory", async () => {
    const consoleInfo = console.info;
    console.info = jest.fn();

    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal>
            <div>2</div>
          </Portal>
        </div>`;
    }
    let error: Error;
    let app = new App(Parent);
    app.configure({ dev: true });
    try {
      await app.mount(fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`Missing props 'target' (component 'Portal')`);
    console.info = consoleInfo;
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("target is not list", async () => {
    const consoleInfo = console.info;
    console.info = jest.fn();
    class Parent extends Component {
      static components = { Portal };
      static template = xml`
        <div>
          <Portal target="['body']">
            <div>2</div>
          </Portal>
        </div>`;
    }
    let error: Error;
    let app = new App(Parent);
    app.configure({ dev: true });
    try {
      await app.mount(fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`Invalid Prop 'target' in component 'Portal'`);
    console.info = consoleInfo;
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });
});
