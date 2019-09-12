import { Component } from "../../src/component/component";
import { RouterEnv } from "../../src/router/Router";
import { RouteComponent, ROUTE_COMPONENT_TEMPLATE_NAME } from "../../src/router/RouteComponent";
import { makeTestEnv, makeTestFixture, nextTick } from "../helpers";
import { TestRouter } from "./TestRouter";

describe("RouteComponent", () => {
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
                <RouteComponent />
            </div>
            <span t-name="About">About</span>
            <span t-name="Users">Users</span>
        </templates>
    `);
    class About extends Component<any, any, any> {}
    class Users extends Component<any, any, any> {}
    class App extends Component<any, any, any> {
      static components = { RouteComponent };
    }

    const routes = [
      { name: "about", path: "/about", component: About },
      { name: "users", path: "/users", component: Users }
    ];

    router = new TestRouter(env, routes, { mode: "history" });
    await router.navigate({ to: "about" });
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>About</span></div>");

    await router.navigate({ to: "users" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>Users</span></div>");
    expect(env.qweb.templates[ROUTE_COMPONENT_TEMPLATE_NAME].fn.toString()).toMatchSnapshot();
  });

  test("can render parameterized route", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <RouteComponent />
            </div>
            <span t-name="Book">Book <t t-esc="props.title"/></span>
        </templates>
    `);
    class Book extends Component<any, any, any> {}
    class App extends Component<any, any, any> {
      static components = { RouteComponent };
    }

    const routes = [{ name: "book", path: "/book/{{title}}", component: Book }];
    router = new TestRouter(env, routes, { mode: "history" });
    await router.navigate({ to: "book", params: { title: "1984" } });
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>Book 1984</span></div>");
  });

  test("can render parameterized route with suffixes", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <RouteComponent />
            </div>
            <span t-name="Book">Book <t t-esc="props.title"/>|<t t-esc="incVal"/></span>
        </templates>
    `);
    class Book extends Component<any, any, any> {
      get incVal() {
        return this.props.val + 1;
      }
    }
    class App extends Component<any, any, any> {
      static components = { RouteComponent };
    }

    const routes = [{ name: "book", path: "/book/{{title}}/{{val.number}}", component: Book }];
    router = new TestRouter(env, routes, { mode: "history" });
    await router.navigate({ to: "book", params: { title: "1984", val: "123" } });
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>Book 1984|124</span></div>");
  });
});
