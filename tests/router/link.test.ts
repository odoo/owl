import { Component } from "../../src/component/component";
import { Link } from "../../src/router/link";
import { RouterEnv } from "../../src/router/router";
import { makeTestEnv, makeTestFixture, nextTick } from "../helpers";
import { TestRouter } from "./test_router";

describe("Link component", () => {
  let fixture: HTMLElement;
  let env: RouterEnv;
  let router: TestRouter | null = null;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = <RouterEnv>makeTestEnv();
    Component.env = env;
  });

  afterEach(() => {
    fixture.remove();
    if (router) {
      router.destroy();
    }
    router = null;
  });

  test("can render simple cases", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <Link to="'about'">About</Link>
            </div>
        </templates>
    `);
    class App extends Component {
      static components = { Link: Link };
    }

    const routes = [
      { name: "about", path: "/about" },
      { name: "users", path: "/users" },
    ];

    router = new TestRouter(env, routes, { mode: "history" });
    router.navigate({ to: "users" });
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe('<div><a href="/about">About</a></div>');

    expect(window.location.pathname).toBe("/users");
    fixture.querySelector("a")!.click();
    await nextTick();
    expect(window.location.pathname).toBe("/about");
    expect(fixture.innerHTML).toBe(
      '<div><a href="/about" class="router-link-active">About</a></div>'
    );

    expect(env.qweb.templates[Link.template].fn.toString()).toMatchSnapshot();
  });

  test("do not redirect if right clicking", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <Link to="'about'">About</Link>
            </div>
        </templates>
    `);
    class App extends Component {
      static components = { Link: Link };
    }

    const routes = [
      { name: "about", path: "/about" },
      { name: "users", path: "/users" },
    ];

    router = new TestRouter(env, routes, { mode: "history" });
    router.navigate({ to: "users" });
    const app = new App();
    await app.mount(fixture);

    expect(window.location.pathname).toBe("/users");
    var evt = new MouseEvent("click", {
      button: 1,
    });

    fixture.querySelector("a")!.dispatchEvent(evt);
    await nextTick();
    expect(window.location.pathname).toBe("/users");
  });
});
