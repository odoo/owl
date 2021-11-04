import { Component, mount } from "../../src";
import { status } from "../../src/component/status";
import { xml } from "../../src/tags";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";
import {
  onMounted,
  onPatched,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  useState,
} from "../../src/index";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
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

    let error;
    try {
      await parent.render();
    } catch (e) {
      error = e;
    }
    expect(fixture.innerHTML).toBe("");
    expect(status(parent)).toBe("destroyed");
    expect(error).toBeDefined();
    const regexp = /Cannot read properties of undefined \(reading 'this'\)|Cannot read property 'this' of undefined/g;
    expect(error.message).toMatch(regexp);
  });

  test.skip("display a nice error if it cannot find component", async () => {
    const consoleError = console.error;
    console.error = jest.fn();

    class SomeComponent extends Component {}
    class Parent extends Component {
      static template = xml`<SomeMispelledComponent />`;
      static components = { SomeComponent };
    }
    let error;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe('Cannot find the definition of component "SomeMispelledWidget"');
    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test.skip("simple catchError", async () => {
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

      error = false;

      // catchError(error) {
      //   this.error = error;
      //   this.render();
      // }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>Error</div>");
  });
});

describe.skip("errors and promises", () => {
  test("a rendering error will reject the mount promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});
    // we do not catch error in willPatch anymore
    class App extends Component {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }

    let error;
    try {
      await mount(App, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    const regexp = /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error.message).toMatch(regexp);

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("an error in mounted call will reject the mount promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class App extends Component {
      static template = xml`<div>abc</div>`;
      setup() {
        onMounted(() => {
          throw new Error("boom");
        });
      }
    }

    let error;
    try {
      await mount(App, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("boom");
    expect(fixture.innerHTML).toBe("");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("an error in willPatch call will reject the render promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class App extends Component {
      static template = xml`<div><t t-esc="val"/></div>`;
      val = 3;
      setup() {
        onWillPatch(() => {
          throw new Error("boom");
        });
      }
    }

    const app = await mount(App, fixture);
    app.val = 4;
    let error;
    try {
      await app.render();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("boom");
    expect(fixture.innerHTML).toBe("");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("an error in patched call will reject the render promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class App extends Component {
      static template = xml`<div><t t-esc="val"/></div>`;
      val = 3;
      setup() {
        onPatched(() => {
          throw new Error("boom");
        });
      }
    }

    const app = await mount(App, fixture);
    app.val = 4;
    let error;
    try {
      await app.render();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("boom");
    expect(fixture.innerHTML).toBe("");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("a rendering error in a sub component will reject the mount promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});
    // we do not catch error in willPatch anymore
    class Child extends Component {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }
    class App extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
    }

    let error;
    try {
      await mount(App, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    const regexp = /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error.message).toMatch(regexp);

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("a rendering error will reject the render promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});
    // we do not catch error in willPatch anymore
    class App extends Component {
      static template = xml`<div><t t-if="flag" t-esc="this.will.crash"/></div>`;
      flag = false;
    }

    const app = await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    app.flag = true;
    let error;
    try {
      await app.render();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    const regexp = /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error.message).toMatch(regexp);

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("a rendering error will reject the render promise (with sub components)", async () => {
    class Child extends Component {
      static template = xml`<span></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child/><t t-esc="x.y"/></div>`;
      static components = { Child };
    }

    let error;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    const regexp = /Cannot read properties of undefined \(reading 'y'\)|Cannot read property 'y' of undefined/g;
    expect(error.message).toMatch(regexp);
  });

  // LPE: relevant: dead code....?
  test("errors in mounted and in willUnmount", async () => {
    expect.assertions(1);
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
      await mount(Example, fixture);
    } catch (e) {
      expect(e.message).toBe("Error in mounted");
    }
  });
});

describe.skip("can catch errors", () => {
  test("can catch an error in a component render function", async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    const handler = jest.fn();
    //env.qweb.on("error", null, handler);
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

      catchError() {
        this.state.error = true;
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

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the initial call of a component render function (parent mounted)", async () => {
    const handler = jest.fn();
    //env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();
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

      catchError() {
        this.state.error = true;
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

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the initial call of a component render function (parent updated)", async () => {
    const handler = jest.fn();
    //env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();
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

      catchError() {
        this.state.error = true;
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

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the constructor call of a component render function", async () => {
    const handler = jest.fn();
    //env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();

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

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Component {
      static template = xml`<div">
              <ErrorBoundary><ErrorComponent /></ErrorBoundary>
          </div>`;
      static components = { ErrorBoundary, ErrorComponent };
    }
    await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the willStart call", async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    class ErrorComponent extends Component {
      static template = xml`<div t-name="ErrorComponent">Some text</div>`;
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

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Component {
      static template = xml`<div><ErrorBoundary><ErrorComponent /></ErrorBoundary></div>`;
      static components = { ErrorBoundary, ErrorComponent };
    }
    await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test.skip("can catch an error in the mounted call", async () => {
    // we do not catch error in mounted anymore
    console.error = jest.fn();
    // env.qweb.addTemplates(`
    //     <templates>
    //       <div t-name="ErrorBoundary">
    //           <t t-if="state.error">Error handled</t>
    //           <t t-else=""><t t-slot="default" /></t>
    //       </div>
    //       <div t-name="ErrorComponent">Some text</div>
    //       <div t-name="App">
    //           <ErrorBoundary><ErrorComponent /></ErrorBoundary>
    //       </div>
    //     </templates>`);
    class ErrorComponent extends Component {
      mounted() {
        throw new Error("NOOOOO");
      }
    }
    class ErrorBoundary extends Component {
      state = useState({ error: false });

      catchError() {
        this.state.error = true;
      }
    }
    class App extends Component {
      static components = { ErrorBoundary, ErrorComponent };
    }
    await mount(App, fixture);
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");
  });

  test.skip("can catch an error in the willPatch call", async () => {
    // we do not catch error in willPatch anymore
    const consoleError = console.error;
    console.error = jest.fn();
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

      catchError() {
        this.state.error = true;
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
    expect(console.error).toHaveBeenCalledTimes(1);
    console.error = consoleError;
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

      // catchError(error) {
      //   throw error;
      // }
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

      error = false;

      // catchError(error) {
      //   this.error = error;
      //   this.render();
      // }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>Error</div>");
  });
});
