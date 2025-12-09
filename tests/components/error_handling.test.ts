import { App, Component, mount, onWillDestroy, props } from "../../src";
import { OwlError } from "../../src/common/owl_error";
import {
  onError,
  onMounted,
  onPatched,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  proxy,
  xml,
} from "../../src/index";
import { getCurrent } from "../../src/runtime/component_node";
import {
  logStep,
  makeTestFixture,
  nextAppError,
  nextMicroTick,
  nextTick,
  snapshotEverything,
  steps,
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
      static template = xml`<div>hey<t t-esc="this.props.flag and state.this.will.crash"/></div>`;
      props = props();
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
    await expect(nextAppError(parent.__owl__.app)).resolves.toThrow(
      "Cannot read properties of undefined (reading 'this')"
    );
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("display a nice error if it cannot find component", async () => {
    class SomeComponent extends Component {}
    class Parent extends Component {
      static template = xml`<SomeMispelledComponent />`;
      static components = { SomeComponent };
    }
    const app = new App();
    let error: Error;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      'Cannot find the definition of component "SomeMispelledComponent"'
    );
    await mountProm;
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
    const app = new App({ test: true });
    let error: Error;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      'Cannot find the definition of component "SomeMispelledComponent"'
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe('Cannot find the definition of component "SomeMispelledComponent"');
    expect(console.error).toBeCalledTimes(0);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("display a nice error if a component is not a component", async () => {
    function notAComponentConstructor() {}
    class Parent extends Component {
      static template = xml`<SomeComponent />`;
      static components = { SomeComponent: notAComponentConstructor };
    }
    const app = new App();
    let error: Error;
    const mountProm = app
      .createRoot(Parent as typeof Component)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      '"SomeComponent" is not a Component. It must inherit from the Component class'
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      '"SomeComponent" is not a Component. It must inherit from the Component class'
    );
  });

  test("display a nice error if the components key is missing with subcomponents", async () => {
    class Parent extends Component {
      static template = xml`<div><MissingChild /></div>`;
    }
    const app = new App();
    let error: Error;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      'Cannot find the definition of component "MissingChild", missing static components key in parent'
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      'Cannot find the definition of component "MissingChild", missing static components key in parent'
    );
  });

  test("display a nice error if the root component template fails to compile", async () => {
    // This is a special case: mount throws synchronously and we don't have any
    // node which can handle the error, hence the different structure of this test
    class Comp extends Component {
      static template = xml`<div t-att-class="a b">test</div>`;
    }
    let error: Error;
    try {
      await mount(Comp, fixture);
    } catch (e) {
      error = e as Error;
    }
    const expectedErrorMessage = `Failed to compile anonymous template: Unexpected identifier 'ctx'

generated code:
function(app, bdom, helpers) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(\`<div block-attribute-0="class">test</div>\`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['a']ctx['b'];
    return block1([attr1]);
  }
}`;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(expectedErrorMessage);
  });

  test("display a nice error if a non-root component template fails to compile", async () => {
    class Child extends Component {
      static template = xml`<div t-att-class="a b">test</div>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child/>`;
    }
    const expectedErrorMessage = `Failed to compile anonymous template: Unexpected identifier 'ctx'

generated code:
function(app, bdom, helpers) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(\`<div block-attribute-0="class">test</div>\`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['a']ctx['b'];
    return block1([attr1]);
  }
}`;
    const app = new App();
    let error: Error;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(expectedErrorMessage);
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(expectedErrorMessage);
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
    class Root extends Component {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }

    const app = new App();
    let error: OwlError;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "Cannot read properties of undefined (reading 'crash')"
    );
    await mountProm;
    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleError).toBeCalledTimes(0);
  });

  test("an error in mounted call will reject the mount promise", async () => {
    class Root extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    const app = new App();
    let error: OwlError;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("boom");
    await mountProm;
    expect(error!).toBeDefined();
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("an error in onMounted callback will have the component's setup in its stack trace", async () => {
    class Root extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    const app = new App({ test: true });
    let error: OwlError;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("boom");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.stack).toContain("error_handling.test.ts");
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("wrapped errors in async code are correctly caught", async () => {
    class Root extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onWillStart(async () => {
          await Promise.resolve();
          throw new Error("boom in onWillStart");
        });
      }
    }

    const app = new App({ test: true });
    let error: OwlError;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`boom in onWillStart`);
    await new Promise((r) => setTimeout(r, 0)); // wait for the rejection event to bubble
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
    expect(error!.message).toBe(`boom`);
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
    expect(error!.message).toBe(`boom`);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("a rendering error in a sub component will reject the mount promise", async () => {
    // we do not catch error in willPatch anymore
    class Child extends Component {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
    }

    const app = new App();
    let error: OwlError;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
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
        onError((cause) => (error = cause));
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

    const app = new App();
    let error: OwlError;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    // await expect(nextAppError(app)).resolves.toThrow("Cannot read properties of undefined (reading 'y')");
    await mountProm;
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

    const app = new App({ test: true });
    let error: OwlError;
    const mountProm = app
      .createRoot(Example)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error!.message).toBe(`Error in mounted`);
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
    await expect(nextAppError(root.__owl__.app)).resolves.toThrow(
      "Cannot read properties of undefined (reading 'b')"
    );
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });
});

describe("can catch errors", () => {
  test("can catch an error in a component render function", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-esc="this.props.flag and state.this.will.crash"/></div>`;
      props = props();
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="state.error">Error handled</t>
            <t t-else=""><t t-slot="default" /></t>
          </div>`;
      props = props();
      state = proxy({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`
          <div>
            <ErrorBoundary><ErrorComponent flag="state.flag"/></ErrorBoundary>
          </div>`;
      state = proxy({ flag: false });
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

  test("can catch an error in onmounted", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Error!!!</div>`;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          throw new Error("error");
        });
      }
    }
    class PerfectComponent extends Component {
      static template = xml`<div>perfect</div>`;
      setup() {
        useLogLifecycle();
      }
    }
    class Main extends Component {
      static template = xml`Main<t t-if="state.ok" t-component="component"/>`;
      component: any;
      state: any;
      setup() {
        this.state = proxy({ ok: false });
        useLogLifecycle();
        this.component = ErrorComponent;
        onError(() => {
          this.component = PerfectComponent;
          this.render();
        });
      }
    }

    const app = await mount(Main, fixture);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Main:setup",
        "Main:willStart",
        "Main:mounted",
      ]
    `);
    expect(fixture.innerHTML).toBe("Main");
    (app as any).state.ok = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("Main<div>Error!!!</div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "ErrorComponent:setup",
        "ErrorComponent:willStart",
        "Main:willPatch",
        "ErrorComponent:mounted",
        "PerfectComponent:setup",
        "PerfectComponent:willStart",
      ]
    `);
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Main:willPatch",
        "ErrorComponent:willUnmount",
        "ErrorComponent:willDestroy",
        "PerfectComponent:mounted",
        "Main:patched",
      ]
    `);
    expect(fixture.innerHTML).toBe("Main<div>perfect</div>");
  });

  test("calling a hook outside setup should crash", async () => {
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onWillStart(() => {
          getCurrent();
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture, { test: true });
    } catch (e: any) {
      error = e;
    }
    expect(error!.message).toBe(
      `No active component (a hook function should only be called in 'setup')`
    );
  });

  test("Errors have the right cause", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw err;
        });
      }
    }
    const app = new App({ test: true });
    let error: any;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error).toBe(err);
  });

  test("Errors in owl lifecycle are wrapped in dev mode: async hook", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onWillStart(async () => {
          await nextMicroTick();
          throw err;
        });
      }
    }
    const app = new App({ test: true });
    let error: any;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error).toBe(err);
  });

  test("Errors in owl lifecycle are wrapped outside dev mode: sync hook", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw err;
        });
      }
    }
    const app = new App();
    let error: any;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error).toBe(err);
  });

  test("Errors in owl lifecycle are wrapped out of dev mode: async hook", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onWillStart(async () => {
          await nextMicroTick();
          throw err;
        });
      }
    }
    const app = new App();
    let error: OwlError;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error!.message).toBe(`test error`);
  });

  test("Thrown values that are not errors are wrapped in dev mode", async () => {
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw "This is not an error";
        });
      }
    }
    const app = new App({ test: true });
    let error: OwlError;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error!).toBe(`This is not an error`);
  });

  test("Thrown values that are not errors are wrapped outside dev mode", async () => {
    class Root extends Component {
      static template = xml`<t t-esc="state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw "This is not an error";
        });
      }
    }
    const app = new App();
    let error: OwlError;
    const mountProm = app
      .createRoot(Root)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error!).toBe(`This is not an error`);
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
      props = props();
      state = proxy({ error: false });

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
      props = props();
      state = proxy({ error: false });

      setup() {
        onError(() => (this.state.error = true));
      }
    }
    class App extends Component {
      static template = xml`
          <div>
              <ErrorBoundary t-if="state.flag"><ErrorComponent /></ErrorBoundary>
          </div>`;
      state = proxy({ flag: false });
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
      props = props();
      state = proxy({ error: false });

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
      props = props();
      state = proxy({ error: false });

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
      props = props();
      state = proxy({ error: false });

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
      props = props();
      state = proxy({ error: false });

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
      props = props();
      state = proxy({ error: false });

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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Root:setup",
        "Root:willStart",
        "ErrorBoundary:setup",
        "ErrorBoundary:willStart",
        "ErrorComponent:setup",
        "ErrorComponent:willStart",
        "ErrorComponent:mounted",
        "boom",
        "ErrorBoundary:mounted",
        "Root:mounted",
      ]
    `);
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
      state = proxy({ error: false });

      setup() {
        useLogLifecycle();
        onError(() => (this.state.error = true));
      }
    }
    await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("<div>Error handled</div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Root:setup",
        "Root:willStart",
        "ErrorComponent:setup",
        "ErrorComponent:willStart",
        "ErrorComponent:mounted",
        "boom",
        "Root:mounted",
      ]
    `);
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
      state = proxy({ error: false });

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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "A:setup",
        "A:willStart",
        "B:setup",
        "B:willStart",
        "C:setup",
        "C:willStart",
        "Boom:setup",
        "Boom:willStart",
        "Boom:mounted",
        "boom",
        "C:mounted",
        "B:mounted",
        "A:mounted",
      ]
    `);
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
      props = props();
      state = proxy({ error: false });

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
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Root:setup",
        "Root:willStart",
        "OK:setup",
        "OK:willStart",
        "ErrorBoundary:setup",
        "ErrorBoundary:willStart",
        "ErrorComponent:setup",
        "ErrorComponent:willStart",
        "ErrorComponent:mounted",
        "boom",
        "ErrorBoundary:mounted",
        "OK:mounted",
        "Root:mounted",
      ]
    `);
    expect(mockConsoleError).toBeCalledTimes(0);
    expect(mockConsoleWarn).toBeCalledTimes(0);
  });

  test("can catch an error in the willPatch call", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div><t t-esc="this.props.message"/></div>`;
      props = props();
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
      props = props();
      state = proxy({ error: false });

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
      state = proxy({ message: "abc" });
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
        this.state = proxy({});
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
        this.state = proxy({});
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
      props = props();
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
      state: any = proxy({
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
      static template = xml`<div t-esc="'Child ' + this.props.id" />`;
      props = props();
    }

    class ErrorComp extends Component {
      static template = xml`<div />`;
      setup() {
        throw new Error("Error Component");
      }
    }

    class Catch extends Component {
      static template = xml`<t t-slot="default" />`;
      props = props();
      setup() {
        onError((e) => {
          this.props.onError(e);
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

  test("an error in onWillDestroy", async () => {
    class Child extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        useLogLifecycle();
        onWillDestroy(() => {
          throw new Error("boom");
        });
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-esc="state.value"/>
        <t t-if="state.hasChild"><Child/></t>`;
      static components = { Child };

      state = proxy({ value: 1, hasChild: true });
      setup() {
        useLogLifecycle();
        onError(() => {
          this.state.value++;
        });
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("1<div>abc</div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);
    parent.state.hasChild = false;
    await nextTick();
    await nextTick();
    await nextTick();
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Child:willUnmount",
        "Child:willDestroy",
        "Parent:patched",
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
    expect(fixture.innerHTML).toBe("2");
  });

  test("an error in onWillDestroy, variation", async () => {
    class Child extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        useLogLifecycle();
        onWillDestroy(() => {
          throw new Error("boom");
        });
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-esc="state.value"/>
        <t t-if="state.hasChild"><Child/></t>`;
      static components = { Child };

      state = proxy({ value: 1, hasChild: false });
      setup() {
        useLogLifecycle();
        onError(() => {
          this.state.value++;
        });
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("1");

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Parent:mounted",
      ]
    `);

    parent.state.hasChild = true;
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    await nextMicroTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:setup",
        "Child:willStart",
      ]
    `);
    parent.state.hasChild = false;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:willDestroy",
      ]
    `);
    expect(fixture.innerHTML).toBe("1");
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
    expect(fixture.innerHTML).toBe("2");
  });

  test("error in onMounted, graceful recovery", async () => {
    class Child extends Component {
      static template = xml`abc`;
      setup() {
        useLogLifecycle();
      }
    }

    class OtherChild extends Component {
      static template = xml`def`;
      setup() {
        useLogLifecycle();
      }
    }

    class Boom extends Component {
      static template = xml`boom`;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    class Parent extends Component {
      static template = xml`parent<Child/><Boom/>`;
      static components = { Child, Boom };
      setup() {
        useLogLifecycle();
      }
    }

    class Root extends Component {
      static template = xml`<t t-component="component"/>`;

      component: any = Parent;
      setup() {
        useLogLifecycle();
        onError(() => {
          logStep("error");
          this.component = OtherChild;
          this.render();
        });
      }
    }

    await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("def");

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Root:setup",
        "Root:willStart",
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Boom:setup",
        "Boom:willStart",
        "Boom:mounted",
        "error",
        "OtherChild:setup",
        "OtherChild:willStart",
        "OtherChild:mounted",
        "Root:mounted",
      ]
    `);
  });

  test("error in onMounted, graceful recovery, variation", async () => {
    class Child extends Component {
      static template = xml`abc`;
      setup() {
        useLogLifecycle();
      }
    }

    class OtherChild extends Component {
      static template = xml`def`;
      setup() {
        useLogLifecycle();
      }
    }

    class Boom extends Component {
      static template = xml`boom`;
      setup() {
        useLogLifecycle();
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    class Parent extends Component {
      static template = xml`parent<Child/><Boom/>`;
      static components = { Child, Boom };
      setup() {
        useLogLifecycle();
      }
    }

    class Root extends Component {
      static template = xml`R<t t-if="state.gogogo" t-component="component"/>`;

      component: any = Parent;
      state = proxy({ gogogo: false });

      setup() {
        useLogLifecycle();
        onError(() => {
          logStep("error");
          this.component = OtherChild;
          this.render();
        });
      }
    }

    const root = await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("R");

    // standard mounting process
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Root:setup",
        "Root:willStart",
        "Root:mounted",
      ]
    `);

    root.state.gogogo = true;
    await nextTick();

    expect(fixture.innerHTML).toBe("Rparentabcboom");
    // rerender, root creates sub components, it crashes, tries to recover
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Boom:setup",
        "Boom:willStart",
        "Root:willPatch",
        "Boom:mounted",
        "error",
        "OtherChild:setup",
        "OtherChild:willStart",
      ]
    `);

    await nextTick();
    expect(fixture.innerHTML).toBe("Rdef");

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Root:willPatch",
        "Child:willDestroy",
        "Boom:willUnmount",
        "Boom:willDestroy",
        "Parent:willDestroy",
        "OtherChild:mounted",
        "Root:patched",
      ]
    `);
  });
});
