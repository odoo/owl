import { OwlError } from "../../src/runtime/error_handling";
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
import { xml } from "../../src/";
import { DEV_MSG } from "../../src/runtime/app";
import { elem, makeTestFixture, nextAppError, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;
const info = console.info;

function addOutsideDiv(fixture: HTMLElement): HTMLElement {
  let outside = document.createElement("div");
  outside.setAttribute("id", "outside");
  fixture.appendChild(outside);
  return outside;
}

snapshotEverything();

beforeAll(() => {
  console.info = (message: any) => {
    if (message === DEV_MSG()) {
      return;
    }
    info(message);
  };
});

afterAll(() => {
  console.info = info;
});

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
      static template = xml`
          <div>
            <span>1</span>
            <t t-portal="'#outside'">
              <p>2</p>
            </t>
          </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"><p>2</p></div><div><span>1</span></div>');
  });

  test("basic use of portal, variation", async () => {
    class Parent extends Component {
      static template = xml`
          <div>
            <span>1</span>
            <t t-portal="target">
              <p>2</p>
            </t>
          </div>`;
      target = "#outside";
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"><p>2</p></div><div><span>1</span></div>');
  });

  test("basic use of portal on div", async () => {
    class Parent extends Component {
      static template = xml`
          <div>
            <span>1</span>
            <div t-portal="'#outside'">
              <p>2</p>
            </div>
          </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div id="outside"><div><p>2</p></div></div><div><span>1</span></div>'
    );
  });
  test("simple catchError with portal", async () => {
    class Boom extends Component {
      static template = xml`
          <div>
            <span>1</span>
            <t t-portal="'#outside'">
              <p><t t-esc="a.b.c"/></p>
            </t>
          </div>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-if="error">Error</t>
          <t t-else="">
            <Boom />
          </t>
        </div>`;
      static components = { Boom };

      error: any = false;

      setup() {
        onError((err) => {
          this.error = err;
          this.render();
        });
      }
    }
    addOutsideDiv(fixture);

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside"></div><div>Error</div>');
  });

  test("basic use of portal in dev mode", async () => {
    class Parent extends Component {
      static template = xml`
          <div>
            <span>1</span>
            <t t-portal="'#outside'">
              <p>2</p>
            </t>
          </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture, { dev: true });

    expect(fixture.innerHTML).toBe('<div id="outside"><p>2</p></div><div><span>1</span></div>');
  });

  test("conditional use of Portal", async () => {
    class Parent extends Component {
      static template = xml`
            <span>1</span>
            <t t-portal="'#outside'" t-if="state.hasPortal">
              <p>2</p>
            </t>`;

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
      static components = { Child };
      static template = xml`
              <span>1</span>
              <t t-portal="'#outside'" t-if="state.hasPortal">
                <Child val="state.val"/>
              </t>`;
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
      static template = xml`
            <div>
              <div id="local-target"></div>
              <span>1</span>
              <t t-portal="'#local-target'">
                <p>2</p>
              </t>
            </div>`;
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      '<div><div id="local-target"><p>2</p></div><span>1</span></div>'
    );
  });

  test("with target in template (after portal)", async () => {
    class Parent extends Component {
      static template = xml`
            <div>
              <span>1</span>
              <t t-portal="'#local-target'">
                <p>2</p>
              </t>
              <div id="local-target"></div>
            </div>`;
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      '<div><span>1</span><div id="local-target"><p>2</p></div></div>'
    );
  });

  test("portal with target not in dom", async () => {
    class Parent extends Component {
      static template = xml`
            <div>
              <t t-portal="'#does-not-exist'">
                <div>2</div>
              </t>
            </div>`;
    }

    let error: Error;
    const app = new App(Parent);
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("invalid portal target");
    await mountProm;

    expect(error!).toBeDefined();
    expect(error!.message).toBe("invalid portal target");
    expect(fixture.innerHTML).toBe(``);
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
      static components = { Child };
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <Child val="state.val"/>
              </t>
            </div>`;
      state = useState({ val: 1 });
    }

    const parent = await mount(Parent, fixture);
    expect(outside.innerHTML).toBe("<span>1</span>");
    expect(fixture.innerHTML).toBe('<div id="outside"><span>1</span></div><div></div>');

    parent.state.val = 2;
    await nextTick();
    expect(outside.innerHTML).toBe("<span>2</span>");
    expect(fixture.innerHTML).toBe('<div id="outside"><span>2</span></div><div></div>');
    expect(steps).toEqual(["mounted", "patched"]);
  });

  test("portal with only text as content", async () => {
    class Parent extends Component {
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <t t-esc="'only text'"/>
              </t>
            </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside">only text</div><div></div>');
  });

  test("portal with no content", async () => {
    class Parent extends Component {
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <t t-if="false" t-esc="'ABC'"/>
              </t>
            </div>`;
    }

    addOutsideDiv(fixture);
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div id="outside"></div><div></div>`);
  });

  test("portal with many children", async () => {
    class Parent extends Component {
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <div>1</div>
                <p>2</p>
              </t>
            </div>`;
    }
    addOutsideDiv(fixture);
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside"><div>1</div><p>2</p></div><div></div>');
  });

  test("portal with dynamic body", async () => {
    class Parent extends Component {
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <span t-if="state.val" t-esc="state.val"/>
                <div t-else=""/>
              </t>
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
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <span t-if="state.val" t-esc="state.val"/>
              </t>
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
      static components = { Child };
      static template = xml`
            <div>
              <t t-portal="'#outside'" t-if="state.hasChild">
                <Child val="state.val"/>
              </t>
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
    expect(fixture.innerHTML).toBe('<div id="outside"></div><div></div>');

    parent.state.hasChild = true;
    await nextTick();
    expect(steps).toEqual([
      "parent:mounted",
      "parent:willPatch",
      "child:mounted",
      "parent:patched",
    ]);
    expect(fixture.innerHTML).toBe('<div id="outside"><span>1</span></div><div></div>');

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
    expect(fixture.innerHTML).toBe('<div id="outside"><span>2</span></div><div></div>');

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
    expect(fixture.innerHTML).toBe('<div id="outside"></div><div></div>');
  });

  test("portal destroys on crash", async () => {
    class Child extends Component {
      static template = xml`<span t-esc="props.error and this.will.crash" />`;
      state = {};
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`
        <div>
          <t t-portal="'#outside'" >
            <Child error="state.error"/>
          </t>
        </div>`;
      state = { error: false };
      setup() {
        onError(({ cause }) => (error = cause));
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
      static components = { Child };
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <Child />
              </t>
            </div>`;
    }
    const env = {};
    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture, { env });
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
      static components = { Child2 };
      static template = xml`
            <t t-portal="'#outside'">
              <t t-slot="default"/>
            </t>`;
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

    elem(childInst!).dispatchEvent(new CustomEvent("custom"));
    expect(steps).toEqual(["custom"]);
  });

  test("Add and remove portals", async () => {
    class Parent extends Component {
      static template = xml`
          <t t-portal="'#outside'" t-foreach="portalIds" t-as="portalId" t-key="portalId">
            Portal<t t-esc="portalId"/>
          </t>`;
      portalIds = useState([] as any);
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.portalIds.push(1);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1</div>');

    parent.portalIds.push(2);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1 Portal2</div>');

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1</div>');

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');
  });

  test("Add and remove portals on div", async () => {
    class Parent extends Component {
      static template = xml`
          <div t-portal="'#outside'" t-foreach="portalIds" t-as="portalId" t-key="portalId">
            Portal<t t-esc="portalId"/>
          </div>`;
      portalIds = useState([] as any);
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.portalIds.push(1);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"><div> Portal1</div></div>');

    parent.portalIds.push(2);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"><div> Portal1</div><div> Portal2</div></div>'
    );

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"><div> Portal1</div></div>');

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');
  });

  test("Add and remove portals with t-foreach", async () => {
    class Parent extends Component {
      static template = xml`
          <t t-foreach="portalIds" t-as="portalId" t-key="portalId">
            <div>
              <t t-esc="portalId"/>
              <t t-portal="'#outside'">
                Portal<t t-esc="portalId"/>
              </t>
            </div>
          </t>`;
      portalIds = useState([] as any);
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.portalIds.push(1);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1</div><div>1</div>');

    parent.portalIds.push(2);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"> Portal1 Portal2</div><div>1</div><div>2</div>'
    );

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1</div><div>1</div>');

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');
  });

  test("Add and remove portals with t-foreach and destroy", async () => {
    class Parent extends Component {
      static template = xml`
          <t t-foreach="portalIds" t-as="portalId" t-key="portalId">
            <div>
              <t t-esc="portalId"/>
              <t t-portal="'#outside'">
                Portal<t t-esc="portalId"/>
              </t>
            </div>
          </t>`;
      portalIds = useState([] as any);
    }

    addOutsideDiv(fixture);
    const app = new App(Parent);
    const parent = await app.mount(fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.portalIds.push(1);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1</div><div>1</div>');

    parent.portalIds.push(2);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"> Portal1 Portal2</div><div>1</div><div>2</div>'
    );

    app.destroy();
    //This will test explicitly that we don't use an await nextTick(); after the destroy.
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');
  });

  test("conditional use of Portal with div", async () => {
    class Parent extends Component {
      static template = xml`
              <t t-if="state.hasPortal">
                <div>
                  <span>hasPortal</span>
                  <t t-portal="'#outside'">
                    <p>thePortal</p>
                  </t>
                </div>
              </t>`;

      state = useState({ hasPortal: false });
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"><p>thePortal</p></div><div><span>hasPortal</span></div>'
    );

    parent.state.hasPortal = false;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"><p>thePortal</p></div><div><span>hasPortal</span></div>'
    );
  });

  test("conditional use of Portal with child and div", async () => {
    class Child extends Component {
      static template = xml`
        <div>
          <span>hasPortal</span>
          <t t-foreach="[1]" t-as="elem" t-key="elem">
            <t t-portal="'#outside'">
              <p>thePortal</p>
            </t>
          </t>
        </div>`;
    }
    class Parent extends Component {
      static template = xml`
        <t t-if="state.hasPortal">
          <Child />
        </t>`;

      static components = { Child };

      state = useState({ hasPortal: false });
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"><p>thePortal</p></div><div><span>hasPortal</span></div>'
    );

    parent.state.hasPortal = false;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"><p>thePortal</p></div><div><span>hasPortal</span></div>'
    );
  });

  test("conditional use of Portal with child and div, variation", async () => {
    class Child extends Component {
      static template = xml`
          <span>hasPortal</span>
          <t t-foreach="[1]" t-as="elem" t-key="elem">
            <t t-portal="'#outside'">
              <p>thePortal</p>
            </t>
          </t>`;
    }
    class Parent extends Component {
      static template = xml`
        <t t-if="state.hasPortal">
          <div>
            <Child />
          </div>
        </t>`;

      static components = { Child };

      state = useState({ hasPortal: false });
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"><p>thePortal</p></div><div><span>hasPortal</span></div>'
    );

    parent.state.hasPortal = false;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div>');

    parent.state.hasPortal = true;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"><p>thePortal</p></div><div><span>hasPortal</span></div>'
    );
  });
  test("Add and remove portals with t-foreach inside div", async () => {
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-foreach="portalIds" t-as="portalId" t-key="portalId">
            <div>
              <t t-esc="portalId"/>
              <t t-portal="'#outside'">
                Portal<t t-esc="portalId"/>
              </t>
            </div>
          </t>
        </div>`;
      portalIds = useState([] as any);
    }

    addOutsideDiv(fixture);
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe('<div id="outside"></div><div></div>');

    parent.portalIds.push(1);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1</div><div><div>1</div></div>');

    parent.portalIds.push(2);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div id="outside"> Portal1 Portal2</div><div><div>1</div><div>2</div></div>'
    );

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"> Portal1</div><div><div>1</div></div>');

    parent.portalIds.pop();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div id="outside"></div><div></div>');
  });

  test("Child and Portal", async () => {
    class Child extends Component {
      static template = xml`
        <span>child</span>
        <t t-portal="'.portal'"><span>portal</span></t>`;
    }
    class Parent extends Component {
      static template = xml`
        <t>
          <Child/>
          <div class="portal"></div>
        </t>`;

      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      '<span>child</span><div class="portal"></div><span>portal</span>'
    );
  });

  test("portal and Child", async () => {
    class Child extends Component {
      static template = xml`
        <span>child</span>
        <t t-portal="'.portal'"><span>portal</span></t>`;
    }
    class Parent extends Component {
      static template = xml`
        <t>
          <div class="portal"></div>
          <Child/>
        </t>`;

      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      '<div class="portal"><span>portal</span></div><span>child</span>'
    );
  });
});

describe("Portal: UI/UX", () => {
  test("focus is kept across re-renders", async () => {
    class Child extends Component {
      static template = xml`
            <input id="target-me" t-att-placeholder="props.val"/>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`
            <div>
              <t t-portal="'#outside'">
                <Child val="state.val"/>
              </t>
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
  test("target is mandatory 1", async () => {
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-portal>
            <div>2</div>
          </t>
        </div>`;
    }
    let error: Error;
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toContain(`attribute without value.`);
  });

  test("target is mandatory 2", async () => {
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-portal="">
            <div>2</div>
          </t>
        </div>`;
    }
    let error: Error;
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`Unexpected token ','`);
  });

  test("target must be a valid selector", async () => {
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-portal="' '">
            <div>2</div>
          </t>
        </div>`;
    }
    let error: OwlError;
    const app = new App(Parent);
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("error occured in the owl lifecycle");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause).toBeDefined();
    expect(error!.cause.message).toBe(`' ' is not a valid selector`);
  });

  test("target must be a valid selector 2", async () => {
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-portal="'aa'">
            <div>2</div>
          </t>
        </div>`;
    }
    let error: Error;
    const app = new App(Parent);
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("invalid portal target");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`invalid portal target`);
  });
});
