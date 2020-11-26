import { Component } from "../../src/component/component";
import { RouterEnv } from "../../src/router/router";
import { RouteComponent } from "../../src/router/route_component";
import { makeTestEnv, makeTestFixture, nextTick } from "../helpers";
import { TestRouter } from "./test_router";

describe("RouteComponent", () => {
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
                <RouteComponent />
            </div>
            <span t-name="About">About</span>
            <span t-name="Users">Users</span>
        </templates>
    `);
    class About extends Component {}
    class Users extends Component {}
    class App extends Component {
      static components = { RouteComponent };
    }

    const routes = [
      { name: "about", path: "/about", component: About },
      { name: "users", path: "/users", component: Users },
    ];

    router = new TestRouter(env, routes, { mode: "history" });
    await router.navigate({ to: "about" });
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>About</span></div>");

    await router.navigate({ to: "users" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>Users</span></div>");
    expect(env.qweb.templates[RouteComponent.template].fn.toString()).toMatchSnapshot();
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
    class Book extends Component {}
    class App extends Component {
      static components = { RouteComponent };
    }

    const routes = [{ name: "book", path: "/book/{{title}}", component: Book }];
    router = new TestRouter(env, routes, { mode: "history" });
    await router.navigate({ to: "book", params: { title: "1984" } });
    const app = new App();
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
    class Book extends Component {
      get incVal() {
        return this.props.val + 1;
      }
    }
    class App extends Component {
      static components = { RouteComponent };
    }

    const routes = [{ name: "book", path: "/book/{{title}}/{{val.number}}", component: Book }];
    router = new TestRouter(env, routes, { mode: "history" });
    await router.navigate({ to: "book", params: { title: "1984", val: "123" } });
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>Book 1984|124</span></div>");
  });
});
