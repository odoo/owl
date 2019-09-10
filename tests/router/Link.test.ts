import { Component } from "../../src/component/component";
import { Link, LINK_TEMPLATE_NAME } from "../../src/router/Link";
import { RouterEnv } from "../../src/router/Router";
import { makeTestEnv, makeTestFixture, nextTick } from "../helpers";
import { TestRouter } from "./TestRouter";

describe("Link component", () => {
  let fixture: HTMLElement;
  let env: RouterEnv;
  let router: TestRouter | null = null;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = <RouterEnv>makeTestEnv();
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
    class App extends Component<any, any, any> {
      static components = { Link: Link };
    }

    const routes = [{ name: "about", path: "/about" }, { name: "users", path: "/users" }];

    router = new TestRouter(env, routes, { mode: "history" });
    router.navigate({ to: "users" });
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe('<div><a href="/about">About</a></div>');

    expect(window.location.pathname).toBe("/users");
    fixture.querySelector("a")!.click();
    await nextTick();
    expect(window.location.pathname).toBe("/about");
    expect(fixture.innerHTML).toBe(
      '<div><a href="/about" class="router-link-active">About</a></div>'
    );

    expect(env.qweb.templates[LINK_TEMPLATE_NAME].fn.toString()).toMatchSnapshot();
  });

  test("do not redirect if right clicking", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <Link to="'about'">About</Link>
            </div>
        </templates>
    `);
    class App extends Component<any, any, any> {
      static components = { Link: Link };
    }

    const routes = [{ name: "about", path: "/about" }, { name: "users", path: "/users" }];

    router = new TestRouter(env, routes, { mode: "history" });
    router.navigate({ to: "users" });
    const app = new App(env);
    await app.mount(fixture);

    expect(window.location.pathname).toBe("/users");
    var evt = new MouseEvent("click", {
      button: 1
    });

    fixture.querySelector("a")!.dispatchEvent(evt);
    await nextTick();
    expect(window.location.pathname).toBe("/users");
  });
});
