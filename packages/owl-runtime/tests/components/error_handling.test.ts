import { App, Component, mount, onWillDestroy, props, types } from "../../src";
import {
  onError,
  onMounted,
  onPatched,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  proxy,
  xml,
} from "../../src";
import { getCurrentComputation, useScope } from "@odoo/owl-core";
import {
  logStep,
  makeTestFixture,
  nextAppError,
  nextMicroTick,
  nextTick,
  render,
  snapshotEverything,
  steps,
  useLogLifecycle,
  getConsoleOutput,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("no component catching error lead to full app destruction", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-out="this.props.flag and this.state.this.will.crash"/></div>`;
      props = props();
    }

    class Parent extends Component {
      static template = xml`<div><ErrorComponent flag="this.state.flag"/></div>`;
      static components = { ErrorComponent };
      state = { flag: false };
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><div>heyfalse</div></div>");
    parent.state.flag = true;

    render(parent);
    const error = await nextAppError(parent.__owl__.app);
    expect(error).toBeInstanceOf(TypeError);
    expect(fixture.innerHTML).toBe("");
    expect(getConsoleOutput()).toEqual([]);
  });

  test("display a nice error if it cannot find component", async () => {
    class SomeComponent extends Component {}
    class Parent extends Component {
      static template = xml`<SomeMispelledComponent />`;
      static components = { SomeComponent };
    }
    const app = new App();
    let error: any;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe('Cannot find the definition of component "SomeMispelledComponent"');
    expect(getConsoleOutput()).toEqual([]);
  });

  test("display a nice error if it cannot find component (in dev mode)", async () => {
    class SomeComponent extends Component {}
    class Parent extends Component {
      static template = xml`<SomeMispelledComponent />`;
      static components = { SomeComponent };
    }
    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.message).toBe('Cannot find the definition of component "SomeMispelledComponent"');
    expect(getConsoleOutput()).toEqual([]);
  });

  test("display a nice error if a component is not a component", async () => {
    function notAComponentConstructor() {}
    class Parent extends Component {
      static template = xml`<SomeComponent />`;
      static components = { SomeComponent: notAComponentConstructor };
    }
    let error: any;
    try {
      await mount(Parent as any, fixture);
    } catch (e) {
      error = e;
    }
    expect(error!.message).toBe(
      '"SomeComponent" is not a Component. It must inherit from the Component class'
    );
  });

  test("display a nice error if the components key is missing with subcomponents", async () => {
    class Parent extends Component {
      static template = xml`<div><MissingChild /></div>`;
    }
    let error: any;
    try {
      await mount(Parent as any, fixture);
    } catch (e) {
      error = e;
    }
    expect(error!.message).toBe(
      'Cannot find the definition of component "MissingChild", missing static components key in parent'
    );
  });

  test("a sync re-render error deep in the tree is only wrapped once", async () => {
    class Child extends Component {
      static template = xml`<div><t t-out="this.props.flag and this.state.this.will.crash"/></div>`;
      props = props();
    }
    class Parent extends Component {
      static template = xml`<Child flag="this.props.flag"/>`;
      static components = { Child };
      props = props();
    }
    class GrandParent extends Component {
      static template = xml`<Parent flag="this.state.flag"/>`;
      static components = { Parent };
      state = { flag: false };
    }
    const gp = await mount(GrandParent, fixture);
    gp.state.flag = true;

    // Re-renders now run inside the scheduler tick rather than synchronously
    // from node.render(), so the unhandled error never makes it back to the
    // render() caller. Capture it at the App boundary instead. We don't
    // re-throw — the test only inspects the error, and rethrowing would
    // surface as an unhandled rejection at the scheduler callback boundary.
    const app = (gp as any).__owl__.app;
    let error: any;
    app._handleError = (e: any) => {
      error = e;
    };
    render(gp);
    await nextTick();
    expect(error!.message).toMatch(/Cannot read propert/);
    // As the throw unwinds through Parent and GrandParent renders, their
    // handleError frames must not re-process (and wrap) the error: once the
    // app is destroyed it is rethrown as-is, so it carries no nested cause.
    expect(error!.cause).toBeUndefined();
  });

  test("currentComputation does not leak when an uncaught render error propagates", async () => {
    class Child extends Component {
      static template = xml`<div><t t-out="this.props.flag and this.state.this.will.crash"/></div>`;
      props = props();
    }
    class Parent extends Component {
      static template = xml`<Child flag="this.state.flag"/>`;
      static components = { Child };
      state = { flag: false };
    }

    const parent = await mount(Parent, fixture);
    expect(getCurrentComputation()).toBeUndefined();

    // The re-render of Child throws. Re-renders now run inside the scheduler
    // tick rather than synchronously from render(), so the unhandled error
    // surfaces at the App boundary rather than rejecting the render() caller;
    // capture it there. Fiber.render() must still restore currentComputation;
    // otherwise it stays pinned to Child's dead signalComputation and every
    // subsequent atom read attaches to it.
    const app = (parent as any).__owl__.app;
    let error: any;
    app._handleError = (e: any) => {
      error = e;
    };
    parent.state.flag = true;
    render(parent);
    await nextTick();
    expect(error).toBeDefined();
    expect(getCurrentComputation()).toBeUndefined();
  });

  test("currentComputation does not leak when a willStart promise rejects after await", async () => {
    // initiateRender captures the parent's signalComputation as `prev` before
    // running willStart. If the willStart promise rejects post-await, the
    // catch must NOT restore currentComputation to `prev` — by then we are in
    // a fresh microtask and `prev` is stale; pinning currentComputation to it
    // leaks the parent signalComputation forever.
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        onWillStart(async () => {
          await Promise.resolve();
          throw new Error("boom");
        });
      }
    }
    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }

    let error: any;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(getCurrentComputation()).toBeUndefined();
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
  let { text, createBlock, list, multi, html, toggler } = bdom;
  
  let block1 = createBlock(\`<div block-attribute-0="class">test</div>\`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['a']ctx['b'];
    return block1([attr1]);
  }
}`;
    expect(error!).toBeDefined();
    expect((error! as any).message).toBe(expectedErrorMessage);
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
  let { text, createBlock, list, multi, html, toggler } = bdom;
  
  let block1 = createBlock(\`<div block-attribute-0="class">test</div>\`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['a']ctx['b'];
    return block1([attr1]);
  }
}`;
    let error: any;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(expectedErrorMessage);
  });

  test("simple catchError", async () => {
    class Boom extends Component {
      static template = xml`<div t-out="a.b.c"/>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-if="this.error">Error</t>
          <t t-else="">
            <Boom />
          </t>
        </div>`;
      static components = { Boom };

      error: any = false;

      setup() {
        onError((err) => {
          this.error = err;
          render(this);
        });
      }
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>Error</div>");
    expect(getConsoleOutput()).toEqual([]);
  });

  test("render from above on error -- handler is not a Root or MountFiber", async () => {
    class Boom extends Component {
      static template = xml`<div t-out="a.b.c"/>`;
      props = props({ onError: types.function() });
      setup() {
        onError((err) => {
          this.props.onError(err);
        });
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-if="this.error">Error</t>
          <t t-else="">
            <Boom onError.bind="this.handleError"/>
          </t>
        </div>`;
      static components = { Boom };

      error: any = false;

      handleError(err: Error) {
        this.error = err;
        render(this);
      }
    }

    class GrandParent extends Component {
      static template: string = xml`<Parent />`;
      static components = { Parent };
    }
    await mount(GrandParent, fixture);
    expect(fixture.innerHTML).toBe("<div>Error</div>");
    expect(getConsoleOutput()).toEqual([]);
  });
});

describe("errors and promises", () => {
  test("a rendering error will reject the mount promise", async () => {
    // we do not catch error in willPatch anymore
    class Root extends Component {
      static template = xml`<div><t t-out="this.will.crash"/></div>`;
    }

    let error: any;
    try {
      await mount(Root, fixture);
    } catch (e) {
      error = e as Error;
    }

    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(getConsoleOutput()).toEqual([]);
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

    let error: any;
    try {
      await mount(Root, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("boom");
    expect(fixture.innerHTML).toBe("");
    expect(getConsoleOutput()).toEqual([]);
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

    let error: any;
    try {
      await mount(Root, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.stack).toContain("error_handling.test.ts");
    expect(fixture.innerHTML).toBe("");
    expect(getConsoleOutput()).toEqual([]);
  });

  test("errors thrown from async hooks propagate through the mount rejection", async () => {
    class Root extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onWillStart(async () => {
          await Promise.resolve();
          throw new Error("boom in onWillStart");
        });
      }
    }

    let error: any;
    try {
      await mount(Root, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("boom in onWillStart");
  });

  test("an error in willPatch call will reject the render promise", async () => {
    class Root extends Component {
      static template = xml`<div><t t-out="this.val"/></div>`;
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
    render(root);
    await nextTick();
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`boom`);
    expect(getConsoleOutput()).toEqual([]);
  });

  test("an error in patched call will reject the render promise", async () => {
    class Root extends Component {
      static template = xml`<div><t t-out="this.val"/></div>`;
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
    render(root);
    await nextTick();
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`boom`);
    expect(getConsoleOutput()).toEqual([]);
  });

  test("a rendering error in a sub component will reject the mount promise", async () => {
    // we do not catch error in willPatch anymore
    class Child extends Component {
      static template = xml`<div><t t-out="this.will.crash"/></div>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
    }

    let error: any;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(getConsoleOutput()).toEqual([]);
  });

  test("a rendering error will reject the render promise", async () => {
    class Root extends Component {
      static template = xml`<div><t t-if="this.flag" t-out="this.will.crash"/></div>`;
      flag = false;
      setup() {
        onError((cause) => (error = cause));
      }
    }

    const root = await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    root.flag = true;
    let error: Error;
    render(root);
    await nextTick();
    expect(error!).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(getConsoleOutput()).toEqual([]);
  });

  test("a rendering error will reject the render promise (with sub components)", async () => {
    class Child extends Component {
      static template = xml`<span></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child/><t t-out="x.y"/></div>`;
      static components = { Child };
    }

    let error: any;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }

    const regexp =
      /Cannot read properties of undefined \(reading 'y'\)|Cannot read property 'y' of undefined/g;
    expect(error!.message).toMatch(regexp);
    expect(getConsoleOutput()).toEqual([]);
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
    let error: any;
    try {
      await mount(Example, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.message).toBe(`Error in mounted`);
    expect(getConsoleOutput()).toEqual([]);
  });

  test("errors in rerender", async () => {
    class Example extends Component {
      static template = xml`<div t-out="this.state.a.b"/>`;
      state: any = { a: { b: 1 } };
    }
    const root = await mount(Example, fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");

    root.state = "boom";
    render(root);
    const error: any = await nextAppError(root.__owl__.app)!;
    expect(error.message).toBe("Cannot read properties of undefined (reading 'b')");
    expect(fixture.innerHTML).toBe("");
    expect(getConsoleOutput()).toEqual([]);
  });
});

describe("can catch errors", () => {
  test("can catch an error in a component render function", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-out="this.props.flag and this.state.this.will.crash"/></div>`;
      props = props();
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="this.state.error">Error handled</t>
            <t t-else=""><t t-call-slot="default" /></t>
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
            <ErrorBoundary><ErrorComponent flag="this.state.flag"/></ErrorBoundary>
          </div>`;
      state = proxy({ flag: false });
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div><div>heyfalse</div></div></div>");
    app.state.flag = true;
    // First rAF surfaces the render error and runs onError (state.error=true);
    // ErrorBoundary's recovery render+commit happens at the next rAF.
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(getConsoleOutput()).toEqual([]);
  });

  test("can catch an error in onmounted", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Error!!!</div>`;
      setup() {
        useLogLifecycle(this);
        onMounted(() => {
          throw new Error("error");
        });
      }
    }
    class PerfectComponent extends Component {
      static template = xml`<div>perfect</div>`;
      setup() {
        useLogLifecycle(this);
      }
    }
    class Main extends Component {
      static template = xml`Main<t t-if="this.state.ok" t-component="this.component"/>`;
      component: any;
      state: any;
      setup() {
        this.state = proxy({ ok: false });
        useLogLifecycle(this);
        this.component = ErrorComponent;
        onError(() => {
          this.component = PerfectComponent;
          render(this);
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
    // Microtask scheduling: the error→recovery cascade (mount ErrorComponent,
    // throw in mounted, onError swaps in PerfectComponent, re-render) all
    // collapses into one nextTick.
    await nextTick();
    expect(fixture.innerHTML).toBe("Main<div>perfect</div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "ErrorComponent:setup",
        "ErrorComponent:willStart",
        "Main:willPatch",
        "ErrorComponent:mounted",
        "PerfectComponent:setup",
        "PerfectComponent:willStart",
        "Main:willPatch",
        "ErrorComponent:willUnmount",
        "ErrorComponent:willDestroy",
        "PerfectComponent:mounted",
        "Main:patched",
      ]
    `);
  });

  test("calling a hook outside setup should crash", async () => {
    class Root extends Component {
      static template = xml`<t t-out="this.state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onWillStart(() => {
          useScope();
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture, { test: true });
    } catch (e: any) {
      error = e;
    }
    expect(error!.message).toBe(`No active scope`);
  });

  test("Errors thrown from user hooks surface as-is (sync)", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-out="this.state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw err;
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBe(err);
  });

  test("Errors thrown from user hooks surface as-is (async)", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-out="this.state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onWillStart(async () => {
          await nextMicroTick();
          throw err;
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBe(err);
  });

  test("Errors thrown outside dev mode also surface as-is (sync)", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-out="this.state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw err;
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBe(err);
  });

  test("Errors thrown outside dev mode also surface as-is (async)", async () => {
    const err = new Error("test error");
    class Root extends Component {
      static template = xml`<t t-out="this.state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onWillStart(async () => {
          await nextMicroTick();
          throw err;
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBe(err);
  });

  test("Thrown non-error values surface as-is (dev mode)", async () => {
    class Root extends Component {
      static template = xml`<t t-out="this.state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw "This is not an error";
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBe(`This is not an error`);
  });

  test("Thrown non-error values surface as-is (outside dev mode)", async () => {
    class Root extends Component {
      static template = xml`<t t-out="this.state.value"/>`;
      state = proxy({ value: 1 });

      setup() {
        onMounted(() => {
          throw "This is not an error";
        });
      }
    }
    let error: any;
    try {
      await mount(Root, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBe(`This is not an error`);
  });

  test("can catch an error in the initial call of a component render function (parent mounted)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-out="this.state.this.will.crash"/></div>`;
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="this.state.error">Error handled</t>
            <t t-else=""><t t-call-slot="default" /></t>
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("can catch an error in the initial call of a component render function (parent updated)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-out="this.state.this.will.crash"/></div>`;
    }
    class ErrorBoundary extends Component {
      static template = xml`
          <div>
            <t t-if="this.state.error">Error handled</t>
            <t t-else=""><t t-call-slot="default" /></t>
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
              <ErrorBoundary t-if="this.state.flag"><ErrorComponent /></ErrorBoundary>
          </div>`;
      state = proxy({ flag: false });
      static components = { ErrorBoundary, ErrorComponent };
    }
    const app = await mount(App, fixture);
    app.state.flag = true;
    // The throw fires during the first rAF's commit (onMounted-equivalent
    // for an initial render); the recovery render commits at the next one.
    await nextTick(2);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
    expect(getConsoleOutput()).toEqual([]);
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
              <t t-if="this.state.error">Error handled</t>
              <t t-else=""><t t-call-slot="default" /></t>
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
    expect(getConsoleOutput()).toEqual([]);
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
              <t t-if="this.state.error">Error handled</t>
              <t t-else=""><t t-call-slot="default" /></t>
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
    expect(getConsoleOutput()).toEqual([]);
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
            <t t-if="this.state.error">Error handled</t>
            <t t-else=""><t t-call-slot="default" /></t>
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
    expect(getConsoleOutput()).toEqual([]);
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
              <t t-if="this.state.error">Error handled</t>
              <t t-else=""><t t-call-slot="default" /></t>
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("can catch an error in the mounted call", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle(this);
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`<div>
       <t t-if="this.state.error">Error handled</t>
       <t t-else=""><t t-call-slot="default" /></t>
      </div>`;
      props = props();
      state = proxy({ error: false });

      setup() {
        useLogLifecycle(this);
        onError(() => (this.state.error = true));
      }
    }
    class Root extends Component {
      static template = xml`<div>
        <ErrorBoundary><ErrorComponent /></ErrorBoundary>
      </div>`;
      static components = { ErrorBoundary, ErrorComponent };
      setup() {
        useLogLifecycle(this);
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("can catch an error in the mounted call (in root component)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle(this);
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }
    class Root extends Component {
      static template = xml`<div>
       <t t-if="this.state.error">Error handled</t>
       <t t-else=""><ErrorComponent /></t>
      </div>`;
      static components = { ErrorComponent };
      state = proxy({ error: false });

      setup() {
        useLogLifecycle(this);
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("can catch an error in the mounted call (in child of child)", async () => {
    class Boom extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle(this);
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }

    class C extends Component {
      static template = xml`<div>
       <t t-if="this.state.error">Error handled</t>
       <t t-else=""><Boom/></t>
      </div>`;
      static components = { Boom };
      state = proxy({ error: false });

      setup() {
        useLogLifecycle(this);
        onError(() => (this.state.error = true));
      }
    }

    class B extends Component {
      static template = xml`<div><C/></div>`;
      static components = { C };
      setup() {
        useLogLifecycle(this);
      }
    }
    class A extends Component {
      static template = xml`<B/>`;
      static components = { B };
      setup() {
        useLogLifecycle(this);
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("error in mounted on a component with a sibling (properly mounted)", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>Some text</div>`;
      setup() {
        useLogLifecycle(this);
        onMounted(() => {
          logStep("boom");
          throw new Error("NOOOOO");
        });
      }
    }
    class ErrorBoundary extends Component {
      static template = xml`<div>
       <t t-if="this.state.error">Error handled</t>
       <t t-else=""><t t-call-slot="default" /></t>
      </div>`;
      props = props();
      state = proxy({ error: false });

      setup() {
        useLogLifecycle(this);
        onError(() => (this.state.error = true));
      }
    }
    class OK extends Component {
      static template = xml`OK`;
      setup() {
        useLogLifecycle(this);
      }
    }

    class Root extends Component {
      static template = xml`<div>
        <OK/>
        <ErrorBoundary><ErrorComponent /></ErrorBoundary>
      </div>`;
      static components = { ErrorBoundary, ErrorComponent, OK };
      setup() {
        useLogLifecycle(this);
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("can catch an error in the willPatch call", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div><t t-out="this.props.message"/></div>`;
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
            <t t-if="this.state.error">Error handled</t>
            <t t-else=""><t t-call-slot="default" /></t>
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
              <span><t t-out="this.state.message"/></span>
            <ErrorBoundary><ErrorComponent message="this.state.message" /></ErrorBoundary>
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("catchError in catchError", async () => {
    class Boom extends Component {
      static template = xml`<div t-out="a.b.c"/>`;
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
          <t t-if="this.error">Error</t>
          <t t-else="">
            <Child />
          </t>
        </div>`;
      static components = { Child };

      error: any = false;

      setup() {
        onError((error) => {
          this.error = error;
          render(this);
        });
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>Error</div>");
    expect(getConsoleOutput()).toEqual([]);
  });

  test("onError in class inheritance is not called if no rethrown", async () => {
    const steps: string[] = [];

    class Abstract extends Component {
      static template = xml`<div>
          <t t-if="!this.state.error">
            <t t-out="this.will.crash" />
          </t>
          <t t-else="">
            <t t-out="this.state.error"/>
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
    expect(getConsoleOutput()).toEqual([]);
  });

  test("onError in class inheritance is called if rethrown", async () => {
    const steps: string[] = [];

    class Abstract extends Component {
      static template = xml`<div>
          <t t-if="!this.state.error">
            <t t-out="this.will.crash" />
          </t>
          <t t-else="">
            <t t-out="this.state.error"/>
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
    expect(getConsoleOutput()).toEqual([]);
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
      static template = xml`<t t-call-slot="default" />`;
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
        <t t-foreach="Object.values(this.state.cps)" t-as="cp" t-key="cp.id">
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
    // onError → cleanup state → re-render lands one frame after the throw.
    await nextTick(2);
    expect(fixture.innerHTML).toBe("<div>Sibling</div>");
  });

  test("catching in child makes parent render", async () => {
    class Child extends Component {
      static template = xml`<div t-out="'Child ' + this.props.id" />`;
      props = props();
    }

    class ErrorComp extends Component {
      static template = xml`<div />`;
      setup() {
        throw new Error("Error Component");
      }
    }

    class Catch extends Component {
      static template = xml`<t t-call-slot="default" />`;
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
        render(this);
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("");

    parent.elements[1] = ErrorComp;
    render(parent);
    // Recovery from a render-time throw: rAF1 runs the failing render and
    // fires onError (which schedules another render); rAF2 commits it.
    await nextTick(2);
    expect(fixture.innerHTML).toBe("<div>Child 2</div>");
    expect(steps).toEqual(["Error Component"]);
  });

  test("an error in onWillDestroy", async () => {
    class Child extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onWillDestroy(() => {
          throw new Error("boom");
        });
        useLogLifecycle(this);
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-out="this.state.value"/>
        <t t-if="this.state.hasChild"><Child/></t>`;
      static components = { Child };

      state = proxy({ value: 1, hasChild: true });
      setup() {
        useLogLifecycle(this);
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
        onWillDestroy(() => {
          throw new Error("boom");
        });
        useLogLifecycle(this);
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-out="this.state.value"/>
        <t t-if="this.state.hasChild"><Child/></t>`;
      static components = { Child };

      state = proxy({ value: 1, hasChild: false });
      setup() {
        useLogLifecycle(this);
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
    await nextTick();
    // The Child has been created and mounted at the next rAF.
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:setup",
        "Child:willStart",
        "Parent:willPatch",
        "Child:mounted",
        "Parent:patched",
      ]
    `);
    parent.state.hasChild = false;
    // Re-render without the Child commits with value=1; willDestroy throws
    // during that same rAF and onError increments value to 2; the recovery
    // render commits at the next rAF.
    await nextTick(2);
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

  test("error in onMounted, graceful recovery", async () => {
    class Child extends Component {
      static template = xml`abc`;
      setup() {
        useLogLifecycle(this);
      }
    }

    class OtherChild extends Component {
      static template = xml`def`;
      setup() {
        useLogLifecycle(this);
      }
    }

    class Boom extends Component {
      static template = xml`boom`;
      setup() {
        useLogLifecycle(this);
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    class Parent extends Component {
      static template = xml`parent<Child/><Boom/>`;
      static components = { Child, Boom };
      setup() {
        useLogLifecycle(this);
      }
    }

    class Root extends Component {
      static template = xml`<t t-component="this.component"/>`;

      component: any = Parent;
      setup() {
        useLogLifecycle(this);
        onError(() => {
          logStep("error");
          this.component = OtherChild;
          render(this);
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
        useLogLifecycle(this);
      }
    }

    class OtherChild extends Component {
      static template = xml`def`;
      setup() {
        useLogLifecycle(this);
      }
    }

    class Boom extends Component {
      static template = xml`boom`;
      setup() {
        useLogLifecycle(this);
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    class Parent extends Component {
      static template = xml`parent<Child/><Boom/>`;
      static components = { Child, Boom };
      setup() {
        useLogLifecycle(this);
      }
    }

    class Root extends Component {
      static template = xml`R<t t-if="this.state.gogogo" t-component="this.component"/>`;

      component: any = Parent;
      state = proxy({ gogogo: false });

      setup() {
        useLogLifecycle(this);
        onError(() => {
          logStep("error");
          this.component = OtherChild;
          render(this);
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
    // Microtask scheduling: error→recovery cascade collapses into one drain.
    await nextTick();
    expect(fixture.innerHTML).toBe("Rdef");
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
