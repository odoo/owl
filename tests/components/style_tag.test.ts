import { Component, css, mount, xml } from "../../src";
import { makeTestFixture } from "../helpers";

let fixture: HTMLElement;
beforeEach(() => {
  fixture = makeTestFixture();
  document.head.innerHTML = "";
});

describe("styles and component", () => {
  test("can define an inline stylesheet", async () => {
    class App extends Component {
      static template = xml`<div class="app">text</div>`;
      static style = css`
        .app {
          color: red;
        }
      `;
    }
    expect(document.head.innerHTML).toBe("");
    const app = await mount(App, fixture);
    expect(document.head.innerHTML).toBe(`<style data-component=\"App\">.app {
  color: red;
}</style>`);
    const style = getComputedStyle(app.el as HTMLElement);
    expect(style.color).toBe("red");
    expect(fixture.innerHTML).toBe('<div class="app">text</div>');
  });

  test("inherited components properly apply css", async () => {
    class App extends Component {
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
    const app = await mount(SubApp, fixture);
    expect(document.head.innerHTML).toBe(`<style data-component=\"App\">.app {
  color: red;
}</style><style data-component=\"SubApp\">.app {
  font-weight: bold;
}</style>`);
    const style = getComputedStyle(app.el as HTMLElement);
    expect(style.color).toBe("red");
    expect(style.fontWeight).toBe("bold");
    expect(fixture.innerHTML).toBe('<div class="app">text</div>');
  });

  test("inherited components properly apply css, part 2", async () => {
    class App extends Component {
      static template = xml`<div class="app"/>`;
      static style = css`
        .app {
          color: tomato;
        }
      `;
    }
    class BetterApp extends App {}
    class EvenBetterApp extends BetterApp {
      static style = css`
        .app {
          background-color: papayawhip;
        }
      `;
    }
    expect(document.head.innerHTML).toBe("");
    await mount(EvenBetterApp, fixture);
    expect(document.head.innerHTML).toBe(`<style data-component=\"App\">.app {
  color: tomato;
}</style><style data-component=\"EvenBetterApp\">.app {
  background-color: papayawhip;
}</style>`);
  });

  test("get a meaningful error message if css helper is missing", async () => {
    class App extends Component {
      static template = xml`<div class="app">text</div>`;
      static style = `.app {color: red;}`;
    }
    let error;
    try {
      await mount(App, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(
      "Invalid css stylesheet for component 'App'. Did you forget to use the 'css' tag helper?"
    );
  });

  test("inline stylesheets are processed", async () => {
    class App extends Component {
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
    await mount(App, fixture);
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
    class App extends Component {
      static template = xml`<div/>`;
      static style = css`
        .parent-a,
        .parent-b {
          .child-a,
          .child-b {
            color: red;
          }
        }
      `;
    }
    await mount(App, fixture);
    expect(document.head.querySelector("style")!.innerHTML)
      .toBe(`.parent-a .child-a, .parent-a .child-b, .parent-b .child-a, .parent-b .child-b {
  color: red;
}`);
  });

  test("handle & selector", async () => {
    class App extends Component {
      static template = xml`<div/>`;
      static style = css`
        .btn {
          &.danger {
            color: red;
          }
        }
        .some-class {
          &.btn {
            .other-class ~ & {
              color: red;
            }
          }
        }
      `;
    }
    await mount(App, fixture);
    expect(document.head.querySelector("style")!.innerHTML).toBe(`.btn.danger {
  color: red;
}
.other-class ~ .some-class.btn {
  color: red;
}`);
  });
});
