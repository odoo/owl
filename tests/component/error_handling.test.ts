import { Component, Env, STATUS } from "../../src/component/component";
import { useState } from "../../src/hooks";
import { xml } from "../../src/tags";
import { makeTestEnv, makeTestFixture, nextTick } from "../helpers";

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

describe("component error handling (catchError)", () => {
  /**
   * This test suite requires often to wait for 3 ticks. Here is why:
   * - First tick is to let the app render and crash.
   * - When we crash, we call the catchError handler in a setTimeout (because we
   *   need to wait for the previous rendering to be completely stopped). So, we
   *   need to wait for the second tick.
   * - Then, when the handler changes the state, we need to wait for the interface
   *   to be rerendered.
   *  */

  test("can catch an error in a component render function", async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
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
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><div>heyfalse</div></div></div>");
    app.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("no component catching error lead to full app destruction", async () => {
    expect.assertions(6);
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();

    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-esc="props.flag and state.this.will.crash"/></div>`;
    }

    class App extends Component {
      static template = xml`<div><ErrorComponent flag="state.flag"/></div>`;
      static components = { ErrorComponent };
      state = useState({ flag: false });
      async render() {
        try {
          await super.render();
        } catch (e) {
          expect(e.message).toBe("Cannot read property 'this' of undefined");
        }
      }
    }
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>heyfalse</div></div>");
    app.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(app.__owl__.status).toBe(STATUS.DESTROYED);
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the initial call of a component render function (parent mounted)", async () => {
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
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
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the initial call of a component render function (parent updated)", async () => {
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
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
    const app = new App();
    await app.mount(fixture);
    app.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
    expect(handler).toBeCalledTimes(1);
  });

  test("can catch an error in the constructor call of a component render function", async () => {
    const handler = jest.fn();
    env.qweb.on("error", null, handler);
    const consoleError = console.error;
    console.error = jest.fn();
    env.qweb.addTemplates(`
        <templates>
          <div t-name="ErrorBoundary">
              <t t-if="state.error">Error handled</t>
              <t t-else=""><t t-slot="default" /></t>
          </div>
          <div t-name="ErrorComponent">Some text</div>
          <div t-name="App">
              <ErrorBoundary><ErrorComponent /></ErrorBoundary>
          </div>
        </templates>`);
    class ErrorComponent extends Component {
      constructor(parent) {
        super(parent);
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
    const app = new App();
    await app.mount(fixture);
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
      async willStart() {
        // we wait a little bit to be in a different stack frame
        await nextTick();
        throw new Error("NOOOOO");
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
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>Error handled</div></div>");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test.skip("can catch an error in the mounted call", async () => {
    // we do not catch error in mounted anymore
    console.error = jest.fn();
    env.qweb.addTemplates(`
        <templates>
          <div t-name="ErrorBoundary">
              <t t-if="state.error">Error handled</t>
              <t t-else=""><t t-slot="default" /></t>
          </div>
          <div t-name="ErrorComponent">Some text</div>
          <div t-name="App">
              <ErrorBoundary><ErrorComponent /></ErrorBoundary>
          </div>
        </templates>`);
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
    const app = new App();
    await app.mount(fixture);
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
      willPatch() {
        throw new Error("NOOOOO");
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
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>abc</span><div><div>abc</div></div></div>");
    app.state.message = "def";
    await nextTick();
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>def</span><div>Error handled</div></div>");
    expect(console.error).toHaveBeenCalledTimes(1);
    console.error = consoleError;
  });

  test("a rendering error will reject the mount promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});
    // we do not catch error in willPatch anymore
    class App extends Component {
      static template = xml`<div><t t-esc="this.will.crash"/></div>`;
    }

    const app = new App();
    let error;
    try {
      await app.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");

    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });

  test("an error in mounted call will reject the mount promise", async () => {
    const consoleError = console.error;
    console.error = jest.fn(() => {});

    class App extends Component {
      static template = xml`<div>abc</div>`;
      mounted() {
        throw new Error("boom");
      }
    }

    const app = new App();
    let error;
    try {
      await app.mount(fixture);
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
      willPatch() {
        throw new Error("boom");
      }
    }

    const app = new App();
    await app.mount(fixture);
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
      patched() {
        throw new Error("boom");
      }
    }

    const app = new App();
    await app.mount(fixture);
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

    const app = new App();
    let error;
    try {
      await app.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");

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

    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    app.flag = true;
    let error;
    try {
      await app.render();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'crash' of undefined");

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
      const parent = new Parent();
      await parent.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'y' of undefined");
  });
});
