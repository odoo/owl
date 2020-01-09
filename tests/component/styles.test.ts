import { Component, Env } from "../../src/component/component";
import { processSheet } from "../../src/component/styles";
import { xml, css } from "../../src/tags";
import { makeTestFixture, makeTestEnv } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - env: an Env, necessary to create new components

let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  Component.env = env;
  document.head.innerHTML = "";
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("styles and component", () => {
  test("can define an inline stylesheet", async () => {
    class App extends Component<any, any> {
      static template = xml`<div class="app">text</div>`;
      static style = css`
        .app {
          color: red;
        }
      `;
    }
    expect(document.head.innerHTML).toBe("");
    const app = new App();

    expect(document.head.innerHTML).toBe(`<style component=\"App\">.app {
  color: red;
}</style>`);

    await app.mount(fixture);
    const style = getComputedStyle(app.el!);
    expect(style.color).toBe("red");
    expect(fixture.innerHTML).toBe('<div class="app">text</div>');
  });

  test("inherited components properly apply css", async () => {
    class App extends Component<any, any> {
      static template = xml`<div class="app">text</div>`;
      static style = css`
        .app {
          color: red;
        }
      `;
    }
    class SubApp extends App {
      static style = css`
        .app {
          font-weight: bold;
        }
      `;
    }
    expect(document.head.innerHTML).toBe("");
    const app = new SubApp();

    expect(document.head.innerHTML).toBe(`<style component=\"SubApp\">.app {
  font-weight: bold;
}</style><style component=\"App\">.app {
  color: red;
}</style>`);

    await app.mount(fixture);
    const style = getComputedStyle(app.el!);
    expect(style.color).toBe("red");
    expect(style.fontWeight).toBe("bold");
    expect(fixture.innerHTML).toBe('<div class="app">text</div>');
  });

  test("get a meaningful error message if css helper is missing", async () => {
    class App extends Component<any, any> {
      static template = xml`<div class="app">text</div>`;
      static style = `.app {color: red;}`;
    }
    let error;
    try {
      new App();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(
      "Invalid css stylesheet for component 'App'. Did you forget to use the 'css' tag helper?"
    );
  });

  test("inline stylesheets are processed", async () => {
    class App extends Component<any, any> {
      static template = xml`<div class="app">text</div>`;
      static style = css`
        .app {
          color: red;
          .some-class {
            font-weight: bold;
            width: 40px;
          }

          display: block;
        }
      `;
    }
    new App();

    expect(document.head.querySelector("style")!.innerHTML).toBe(`.app {
  color: red;
}
.app .some-class {
  font-weight: bold;
  width: 40px;
}
.app {
  display: block;
}`);
  });

  test("properly handle rules with commas", async () => {
    const sheet = processSheet(`.parent-a, .parent-b {
      .child-a, .child-b {
        color: red;
      }
    }`);
    
    expect(sheet).toBe(`.parent-a .child-a, .parent-a .child-b, .parent-b .child-a, .parent-b .child-b {
  color: red;
}`);
  });

  test("handle & selector", async () => {
    let sheet = processSheet(`.btn {
      &.danger {
        color: red;
      }
    }`);

    expect(sheet).toBe(`.btn.danger {
  color: red;
}`);

    sheet = processSheet(`.some-class {
      &.btn {
        .other-class ~ & {
          color: red;
        }
      }
    }`);

    expect(sheet).toBe(`.other-class ~ .some-class.btn {
  color: red;
}`);
  });
  
});
