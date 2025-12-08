import { App, Component, mount, onWillPatch, onWillStart, props, proxy, xml } from "../../src";
import { status } from "../../src/runtime/status";
import {
  makeTestFixture,
  snapshotEverything,
  nextTick,
  elem,
  useLogLifecycle,
  makeDeferred,
  nextMicroTick,
  steps,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("app", () => {
  test("destroy remove the widget from the DOM", async () => {
    class SomeComponent extends Component {
      static template = xml`<div/>`;
    }

    const app = new App();
    const comp = await app.createRoot(SomeComponent).mount(fixture);
    const el = elem(comp);
    expect(document.contains(el)).toBe(true);
    app.destroy();
    expect(document.contains(el)).toBe(false);
    expect(status(comp)).toBe("destroyed");
  });

  test("App supports env with getters/setters", async () => {
    let someVal = "maggot";

    const services: any = { serv1: "" };
    const env = {
      get someVal() {
        return someVal;
      },
      services,
    };

    class SomeComponent extends Component {
      static template = xml`<div><t t-esc="env.someVal" /> <t t-esc="Object.keys(env.services)" /></div>`;
    }

    const app = new App({ env });
    const comp = await app.createRoot(SomeComponent).mount(fixture);
    expect(fixture.innerHTML).toBe("<div>maggot serv1</div>");
    someVal = "brain";
    services.serv2 = "";
    comp.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>brain serv1,serv2</div>");
  });

  test("can configure an app with props", async () => {
    class SomeComponent extends Component {
      static template = xml`<div t-esc="this.props.value"/>`;
      props = props();
    }

    const app = new App();
    await app.createRoot(SomeComponent, { props: { value: 333 } }).mount(fixture);
    expect(fixture.innerHTML).toBe("<div>333</div>");
  });

  test.skip("warnIfNoStaticProps works as expected", async () => {
    let originalconsoleWarn = console.warn;
    let mockConsoleWarn = jest.fn(() => {});
    console.warn = mockConsoleWarn;

    class Root extends Component {
      static template = xml`<div t-esc="message"/>`;
      props = props();
    }

    await mount(Root, fixture, {
      test: true,
      props: { messge: "hey" },
      warnIfNoStaticProps: true,
    } as any);

    console.warn = originalconsoleWarn;
    expect(mockConsoleWarn).toBeCalledWith(
      "Component 'Root' does not have a static props description"
    );
  });

  test("can mount app in an iframe", async () => {
    class SomeComponent extends Component {
      static template = xml`<div class="my-div"/>`;
    }

    const iframe = document.createElement("iframe");
    fixture.appendChild(iframe);
    const app = new App();
    const iframeDoc = iframe.contentDocument!;
    const comp = await app.createRoot(SomeComponent).mount(iframeDoc.body);
    const div = iframeDoc.querySelector(".my-div");
    expect(div).not.toBe(null);
    expect(iframeDoc.contains(div)).toBe(true);
    app.destroy();
    expect(iframeDoc.contains(div)).toBe(false);
    expect(status(comp)).toBe("destroyed");
  });

  test("app: clear scheduler tasks and destroy cancelled nodes immediately on destroy", async () => {
    let def = makeDeferred();
    class B extends Component {
      static template = xml`B`;
      setup() {
        useLogLifecycle();
        onWillStart(() => def);
      }
    }
    class A extends Component {
      static template = xml`A<t t-if="state.value"><B/></t>`;
      static components = { B };
      state = proxy({ value: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App();
    const comp = await app.createRoot(A).mount(fixture);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "A:setup",
        "A:willStart",
        "A:willRender",
        "A:rendered",
        "A:mounted",
      ]
    `);

    comp.state.value = true;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "A:willRender",
        "B:setup",
        "B:willStart",
        "A:rendered",
      ]
    `);

    // rerender to force the instantiation of a new B component (and cancelling the first)
    comp.render();
    await nextMicroTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "A:willRender",
        "B:setup",
        "B:willStart",
        "A:rendered",
      ]
    `);

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "A:willUnmount",
        "B:willDestroy",
        "A:willDestroy",
        "B:willDestroy",
      ]
    `);
  });

  test("can load templates from an object name-string", async () => {
    const templates = {
      hello: `<div class="hello">hello</div>`,
      world: `<div>world</div>`,
    };
    class SomeComponent extends Component {
      static template = "hello";
    }

    const app = new App({ templates });
    await app.createRoot(SomeComponent).mount(fixture);
    expect(fixture.querySelector(".hello")).toBeDefined();
    // Only the "hello" template is used, so the "world" template is not yet loaded
    expect(Object.keys(app.templates)).toEqual(["hello"]);
    expect(Object.keys(app.rawTemplates)).toEqual(["hello", "world"]);
  });

  test("can call processTask twice in a row without crashing", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        onWillPatch(() => app.scheduler.processTasks());
      }
    }
    class SomeComponent extends Component {
      static template = xml`parent<Child/>`;
      static components = { Child };
    }

    const app = new App();
    await app.createRoot(SomeComponent).mount(fixture);
    expect(fixture.innerHTML).toBe("parent<div></div>");
  });

  test("can add functions to the bdom", async () => {
    const steps: string[] = [];
    class SomeComponent extends Component {
      static template = xml`<div t-on-click="() => __globals__.plop('click')" class="my-div"/>`;
    }
    const app = new App({
      globalValues: {
        plop: (string: any) => {
          steps.push(string);
        },
      },
    });
    await app.createRoot(SomeComponent).mount(fixture);
    expect(fixture.innerHTML).toBe(`<div class="my-div"></div>`);
    fixture.querySelector("div")!.click();
    expect(steps).toEqual(["click"]);
  });
});
