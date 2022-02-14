import { Component, mount } from "../../src";
import {
  onError,
  onMounted,
  onPatched,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  useState,
  xml,
} from "../../src/index";
import {
  logStep,
  makeTestFixture,
  nextTick,
  nextMicroTick,
  snapshotEverything,
  useLogLifecycle,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

let originalconsoleError = console.error;
let mockConsoleError: any;
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;

beforeEach(() => {
  fixture = makeTestFixture();
  mockConsoleError = jest.fn(() => {});
  mockConsoleWarn = jest.fn(() => {});
  console.error = mockConsoleError;
  console.warn = mockConsoleWarn;
});

afterEach(() => {
  console.error = originalconsoleError;
  console.warn = originalconsoleWarn;
});

describe("basics", () => {
  test("no component catching error lead to full app destruction", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-esc="props.flag and state.this.will.crash"/></div>`;
    }

    class Parent extends Component {
      static template = xml`<div><ErrorComponent flag="state.flag"/></div>`;
      static components = { ErrorComponent };
      state = { flag: false };
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><div>heyfalse</div></div>");
    parent.state.flag = true;

    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleError).toBeCalledTimes(1);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("display a nice error if it cannot find component", async () => {
    class SomeComponent extends Component {}
    class Parent extends Component {
      static template = xml`<SomeMispelledComponent />`;
      static components = { SomeComponent };
    }
    let error: Error;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe('Cannot find the definition of component "SomeMispelledComponent"');
    expect(console.error).toBeCalledTimes(0);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("display a nice error if it cannot find component (in dev mode)", async () => {
    class SomeComponent extends Component {}
    class Parent extends Component {
      static template = xml`<SomeMispelledComponent />`;
      static components = { SomeComponent };
    }
    let error: Error;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe('Cannot find the definition of component "SomeMispelledComponent"');
    expect(console.error).toBeCalledTimes(0);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("simple catchError", async () => {
    class Boom extends Component {
      static template = xml`<div t-esc="a.b.c"/>`;
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
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>Error</div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });
});

describe("errors and promises", () => {
  test("a rendering error will reject the mount promise", async () => {
    // we do not catch error in willPatch anymore
    class App extends Component {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }

    let error: Error;
    try {
      await mount(App, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleError).toBeCalledTimes(0);
  });

  test("an error in mounted call will reject the mount promise", async () => {
    class App extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    let error: Error;
    try {
      await mount(App, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("boom");
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("an error in onMounted callback will have the component's setup in its stack trace", async () => {
    class App extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    let error: Error;
    try {
      await mount(App, fixture, { test: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.stack).toContain("App.setup");
    expect(error!.stack).toContain("error_handling.test.ts");
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("an error in willPatch call will reject the render promise", async () => {
    class Root extends Component {
      static template = xml`<div><t t-esc="val"/></div>`;
      val = 3;
      setup() {
        onWillPatch(() => {
          throw new Error("boom");
        });
        onError((e) => (error = e));
      }
    }

    const root = await mount(Root, fixture, { test: true });
    root.val = 4;
    let error: Error;
    root.render();
    await nextTick();
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`The following error occurred in onWillPatch: "boom"`);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("an error in patched call will reject the render promise", async () => {
    class Root extends Component {
      static template = xml`<div><t t-esc="val"/></div>`;
      val = 3;
      setup() {
        onPatched(() => {
          throw new Error("boom");
        });
        onError((e) => (error = e));
      }
    }

    const root = await mount(Root, fixture, { test: true });
    root.val = 4;
    let error: Error;
    root.render();
    await nextTick();
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`The following error occurred in onPatched: "boom"`);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("a rendering error in a sub component will reject the mount promise", async () => {
    // we do not catch error in willPatch anymore
    class Child extends Component {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }
    class App extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
    }

    let error: Error;
    try {
      await mount(App, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("a rendering error will reject the render promise", async () => {
    class Root extends Component {
      static template = xml`<div><t t-if="flag" t-esc="this.will.crash"/></div>`;
      flag = false;
      setup() {
        onError((e) => (error = e));
      }
    }

    const root = await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    root.flag = true;
    let error: Error;
    root.render();
    await nextTick();
    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("a rendering error will reject the render promise (with sub components)", async () => {
    class Child extends Component {
      static template = xml`<span></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child/><t t-esc="x.y"/></div>`;
      static components = { Child };
    }

    let error: Error;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'y'\)|Cannot read property 'y' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("errors in mounted and in willUnmount", async () => {
    class Example extends Component {
      static template = xml`<div/>`;
      val: any;
      setup() {
        onMounted(() => {
          throw new Error("Error in mounted");
          this.val = { foo: "bar" };
        });

        onWillUnmount(() => {
          console.log(this.val.foo);
        });
      }
    }

    try {
      await mount(Example, fixture, { test: true });
    } catch (e) {
      expect((e as Error).message).toBe(
        `The following error occurred in onMounted: "Error in mounted"`
      );
    }
    // 1 additional error is logged because the destruction of the app causes
    // the onWillUnmount hook to be called and to fail
    expect(mockConsoleError).toBeCalledTimes(1);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("errors in rerender", async () => {
    class Example extends Component {
      static template = xml`<div t-esc="state.a.b"/>`;
      state: any = { a: { b: 1 } };
    }
    const root = await mount(Example, fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");

    root.state = "boom";
    root.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleError).toBeCalledTimes(1);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });
});

describe("can catch errors", () => {
  test("can catch an error in a component render function", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-esc="props.flag and state.this.will.crash"/></div>`;
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="state.error">Error handled</t>
            <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`
          <div>
            <ErrorBoundary><ErrorComponent flag="state.flag"/></ErrorBoundary>
          </div>`;
      state = useState({ flag: false });
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div><div>heyfalse</div></div></div>");
    app.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("calling a hook outside setup should crash", async () => {
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = useState({ value: 1 });

      setup() {
        onWillStart(() => {
          this.state = useState({ value: 2 });
        });
      }
    }
    let e: Error;
    try {
      await mount(Root, fixture, { test: true });
    } catch (error) {
      e = error as Error;
    }
    expect(e!.message).toBe(
      `The following error occurred in onWillStart: "No active component (a hook function should only be called in 'setup')"`
    );
  });

  test("can catch an error in the initial call of a component render function (parent mounted)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-esc="state.this.will.crash"/></div>`;
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="state.error">Error handled</t>
            <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => {
          this.state.error = true;
        });
      }
    }
    class App extends Component {
      static template = xml`
          <div>
              <ErrorBoundary><ErrorComponent /></ErrorBoundary>
          </div>`;
      static components = { ErrorBoundary, ErrorComponent };
    }
    await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the initial call of a component render function (parent updated)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-esc="state.this.will.crash"/></div>`;
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="state.error">Error handled</t>
            <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`
          <div>
              <ErrorBoundary t-if="state.flag"><ErrorComponent /></ErrorBoundary>
          </div>`;
      state = useState({ flag: false });
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = await mount(App, fixture);
    app.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the constructor call of a component render function", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        throw new Error("NOOOOO");
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`<div>
              <t t-if="state.error">Error handled</t>
              <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`<div>
              <ErrorBoundary><ErrorComponent /></ErrorBoundary>
          </div>`;
      static components = { ErrorBoundary, ErrorComponent };
    }
    await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the constructor call of a component render function 2", async () => {
    class ClassicCompoent extends Component {
      static template = xml`<div>classic</div>`;
    }

    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        throw new Error("NOOOOO");
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`<div>
              <t t-if="state.error">Error handled</t>
              <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`<div>
              <ErrorBoundary><ClassicCompoent/><ErrorComponent /></ErrorBoundary>
          </div>`;
      static components = { ErrorBoundary, ErrorComponent, ClassicCompoent };
    }
    await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the willStart call", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        onWillStart(async () => {
          // we wait a little bit to be in a different stack frame
          await nextTick();
          throw new Error("NOOOOO");
        });
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="state.error">Error handled</t>
            <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`<div><ErrorBoundary><ErrorComponent /></ErrorBoundary></div>`;
      static components = { ErrorBoundary, ErrorComponent };
    }
    await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error origination from a child's willStart function", async () => {
    class ClassicCompoent extends Component {
      static template = xml`<div>classic</div>`;
    }

    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        onWillStart(() => {
          throw new Error("NOOOOO");
        });
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`<div>
              <t t-if="state.error">Error handled</t>
              <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`<div>
              <ErrorBoundary><ClassicCompoent/><ErrorComponent /></ErrorBoundary>
          </div>`;
      static components = { ErrorBoundary, ErrorComponent, ClassicCompoent };
    }
    await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the mounted call", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`<div>
       <t t-if="state.error">Error handled</t>
       <t t-else=""><t t-slot="default" /></t>
      </div>`;
      state = useState({ error: false });

      setup() {
        useLogLifecycle();
        onError(() => (this.state.error = true));
      }
    }
    class Root extends Component {
      static template = xml`<div>
        <ErrorBoundary><ErrorComponent /></ErrorBoundary>
      </div>`;
      static components = { ErrorBoundary, ErrorComponent };
      setup() {
        useLogLifecycle();
      }
    }
    await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect([
      "Root:setup",
      "Root:willStart",
      "Root:willRender",
      "ErrorBoundary:setup",
      "ErrorBoundary:willStart",
      "Root:rendered",
      "ErrorBoundary:willRender",
      "ErrorComponent:setup",
      "ErrorComponent:willStart",
      "ErrorBoundary:rendered",
      "ErrorComponent:willRender",
      "ErrorComponent:rendered",
      "ErrorComponent:mounted",
      "boom",
      "ErrorBoundary:willRender",
      "ErrorBoundary:rendered",
      "ErrorBoundary:mounted",
      "Root:mounted",
    ]).toBeLogged();
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the mounted call (in root component)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }
    class Root extends Component {
      static template = xml`<div>
       <t t-if="state.error">Error handled</t>
       <t t-else=""><ErrorComponent /></t>
      </div>`;
      static components = { ErrorComponent };
      state = useState({ error: false });

      setup() {
        useLogLifecycle();
        onError(() => (this.state.error = true));
      }
    }
    await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("<div>Error handled</div>");
    expect([
      "Root:setup",
      "Root:willStart",
      "Root:willRender",
      "ErrorComponent:setup",
      "ErrorComponent:willStart",
      "Root:rendered",
      "ErrorComponent:willRender",
      "ErrorComponent:rendered",
      "ErrorComponent:mounted",
      "boom",
      "Root:willRender",
      "Root:rendered",
      "Root:mounted",
    ]).toBeLogged();
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the mounted call (in child of child)", async () => {
    class Boom extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }

    class C extends Component {
      static template = xml`<div>
       <t t-if="state.error">Error handled</t>
       <t t-else=""><Boom/></t>
      </div>`;
      static components = { Boom };
      state = useState({ error: false });

      setup() {
        useLogLifecycle();
        onError(() => (this.state.error = true));
      }
    }

    class B extends Component {
      static template = xml`<div><C/></div>`;
      static components = { C };
      setup() {
        useLogLifecycle();
      }
    }
    class A extends Component {
      static template = xml`<B/>`;
      static components = { B };
      setup() {
        useLogLifecycle();
      }
    }
    await mount(A, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect([
      "A:setup",
      "A:willStart",
      "A:willRender",
      "B:setup",
      "B:willStart",
      "A:rendered",
      "B:willRender",
      "C:setup",
      "C:willStart",
      "B:rendered",
      "C:willRender",
      "Boom:setup",
      "Boom:willStart",
      "C:rendered",
      "Boom:willRender",
      "Boom:rendered",
      "Boom:mounted",
      "boom",
      "C:willRender",
      "C:rendered",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]).toBeLogged();
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("error in mounted on a component with a sibling (properly mounted)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`<div>
       <t t-if="state.error">Error handled</t>
       <t t-else=""><t t-slot="default" /></t>
      </div>`;
      state = useState({ error: false });

      setup() {
        useLogLifecycle();
        onError(() => (this.state.error = true));
      }
    }
    class OK extends Component {
      static template = xml`OK`;
      setup() {
        useLogLifecycle();
      }
    }

    class Root extends Component {
      static template = xml`<div>
        <OK/>
        <ErrorBoundary><ErrorComponent /></ErrorBoundary>
      </div>`;
      static components = { ErrorBoundary, ErrorComponent, OK };
      setup() {
        useLogLifecycle();
      }
    }
    await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("<div>OK<div>Error handled</div></div>");
    expect([
      "Root:setup",
      "Root:willStart",
      "Root:willRender",
      "OK:setup",
      "OK:willStart",
      "ErrorBoundary:setup",
      "ErrorBoundary:willStart",
      "Root:rendered",
      "OK:willRender",
      "OK:rendered",
      "ErrorBoundary:willRender",
      "ErrorComponent:setup",
      "ErrorComponent:willStart",
      "ErrorBoundary:rendered",
      "ErrorComponent:willRender",
      "ErrorComponent:rendered",
      "ErrorComponent:mounted",
      "boom",
      "ErrorBoundary:willRender",
      "ErrorBoundary:rendered",
      "ErrorBoundary:mounted",
      "OK:mounted",
      "Root:mounted",
    ]).toBeLogged();
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the willPatch call", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div><t t-esc="props.message"/></div>`;
      setup() {
        onWillPatch(() => {
          throw new Error("NOOOOO");
        });
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="state.error">Error handled</t>
            <t t-else=""><t t-slot="default" /></t>
          </div>`;
      state = useState({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`
          <div>
              <span><t t-esc="state.message"/></span>
            <ErrorBoundary><ErrorComponent message="state.message" /></ErrorBoundary>
          </div>`;
      state = useState({ message: "abc" });
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><span>abc</span><div><div>abc</div></div></div>");
    app.state.message = "def";
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>def</span><div>Error handled</div></div>");
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("catchError in catchError", async () => {
    class Boom extends Component {
      static template = xml`<div t-esc="a.b.c"/>`;
    }

    class Child extends Component {
      static template = xml`
        <div>
          <Boom />
        </div>`;
      static components = { Boom };

      setup() {
        onError((error) => {
          throw error;
        });
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-if="error">Error</t>
          <t t-else="">
            <Child />
          </t>
        </div>`;
      static components = { Child };

      error: any = false;

      setup() {
        onError((error) => {
          this.error = error;
          this.render();
        });
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>Error</div>");
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("onError in class inheritance is not called if no rethrown", async () => {
    const steps: string[] = [];

    class Abstract extends Component {
      static template = xml`<div>
          <t t-if="!state.error">
            <t t-esc="this.will.crash" />
          </t>
          <t t-else="">
            <t t-esc="state.error"/>
          </t>
        </div>`;
      state: any;
      setup() {
        this.state = useState({});
        onError(() => {
          steps.push("Abstract onError");
          this.state.error = "Abstract";
        });
      }
    }

    class Concrete extends Abstract {
      setup() {
        super.setup();
        onError(() => {
          steps.push("Concrete onError");
          this.state.error = "Concrete";
        });
      }
    }

    class Parent extends Component {
      static components = { Concrete };
      static template = xml`<Concrete />`;
    }

    await mount(Parent, fixture);

    expect(steps).toStrictEqual(["Concrete onError"]);
    expect(fixture.innerHTML).toBe("<div>Concrete</div>");
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("onError in class inheritance is called if rethrown", async () => {
    const steps: string[] = [];

    class Abstract extends Component {
      static template = xml`<div>
          <t t-if="!state.error">
            <t t-esc="this.will.crash" />
          </t>
          <t t-else="">
            <t t-esc="state.error"/>
          </t>
        </div>`;
      state: any;
      setup() {
        this.state = useState({});
        onError(() => {
          steps.push("Abstract onError");
          this.state.error = "Abstract";
        });
      }
    }

    class Concrete extends Abstract {
      setup() {
        super.setup();
        onError((error) => {
          steps.push("Concrete onError");
          this.state.error = "Concrete";
          throw error;
        });
      }
    }

    class Parent extends Component {
      static components = { Concrete };
      static template = xml`<Concrete />`;
    }

    await mount(Parent, fixture);

    expect(steps).toStrictEqual(["Concrete onError", "Abstract onError"]);
    expect(fixture.innerHTML).toBe("<div>Abstract</div>");
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("catching error, rethrow, render parent  -- a main component loop implementation", async () => {
    let parentState: any;

    class ErrorComponent extends Component {
      static template = xml`<div />`;
      setup() {
        throw new Error("My Error");
      }
    }

    class Child extends Component {
      static template = xml`<ErrorComponent />`;
      static components = { ErrorComponent };
      setup() {
        onError((error) => {
          throw error;
        });
      }
    }

    class Sibling extends Component {
      static template = xml`<div>Sibling</div>`;
    }

    class ErrorHandler extends Component {
      static template = xml`<t t-slot="default" />`;
      setup() {
        onError(() => {
          this.props.onError();
          Promise.resolve().then(() => {
            parentState.cps[2] = {
              id: 2,
              Comp: Sibling,
            };
          });
        });
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-foreach="Object.values(state.cps)" t-as="cp" t-key="cp.id">
          <ErrorHandler onError="() => this.cleanUp(cp.id)">
              <t t-component="cp.Comp" />
            </ErrorHandler>
        </t>`;

      static components = { ErrorHandler };
      state: any = useState({
        cps: {},
      });

      setup() {
        parentState = this.state;
      }

      cleanUp(id: number) {
        delete this.state.cps[id];
      }
    }

    await mount(Parent, fixture);
    parentState.cps[1] = { id: 1, Comp: Child };
    await nextMicroTick();
    expect(fixture.innerHTML).toBe("");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>Sibling</div>");
  });

  test("catching in child makes parent render", async () => {
    class Child extends Component {
      static template = xml`<div t-esc="'Child ' + props.id" />`;
    }

    class ErrorComp extends Component {
      static template = xml`<div />`;
      setup() {
        throw new Error("Error Component");
      }
    }

    class Catch extends Component {
      static template = xml`<t t-slot="default" />`;
      setup() {
        onError((error) => {
          this.props.onError(error);
        });
      }
    }

    const steps: any[] = [];
    class Parent extends Component {
      static components = { Catch };
      static template = xml`
        <t t-foreach="Object.entries(this.elements)" t-as="elem" t-key="elem[0]">
          <Catch onError="(error) => this.onError(elem[0], error)">
            <t t-component="elem[1]" id="elem[0]" />
          </Catch>
        </t>
      `;

      elements: any = {};

      onError(id: any, error: Error) {
        steps.push(error.message);
        delete this.elements[id];
        this.elements[2] = Child;
        this.render();
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("");

    parent.elements[1] = ErrorComp;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>Child 2</div>");
    expect(steps).toEqual(["Error Component"]);
  });
});
