import { App, Component, mount, onWillStart, useState, xml } from "../../src";
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

    const app = new App(SomeComponent);
    const comp = await app.mount(fixture);
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

    const app = new App(SomeComponent, { env });
    const comp = await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>maggot serv1</div>");
    someVal = "brain";
    services.serv2 = "";
    comp.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>brain serv1,serv2</div>");
  });

  test("can configure an app with props", async () => {
    class SomeComponent extends Component {
      static template = xml`<div t-esc="props.value"/>`;
    }

    const app = new App(SomeComponent, { props: { value: 333 } });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>333</div>");
  });

  test("warnIfNoStaticProps works as expected", async () => {
    let originalconsoleWarn = console.warn;
    let mockConsoleWarn = jest.fn(() => {});
    console.warn = mockConsoleWarn;

    class Root extends Component {
      static template = xml`<div t-esc="message"/>`;
    }

    await mount(Root, fixture, { test: true, props: { messge: "hey" }, warnIfNoStaticProps: true });

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
    const app = new App(SomeComponent);
    const iframeDoc = iframe.contentDocument!;
    const comp = await app.mount(iframeDoc.body);
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
      state = useState({ value: false });
      setup() {
        useLogLifecycle();
      }
    }

    const app = new App(A);
    const comp = await app.mount(fixture);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
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
      Array [
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
      Array [
        "A:willRender",
        "B:setup",
        "B:willStart",
        "A:rendered",
      ]
    `);

    app.destroy();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "A:willUnmount",
        "B:willDestroy",
        "A:willDestroy",
        "B:willDestroy",
      ]
    `);
  });
});
