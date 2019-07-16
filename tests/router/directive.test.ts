import { Component } from "../../src/component/component";
import { QWeb } from "../../src/qweb/index";
import { activate, RouterEnv } from "../../src/router/plugin";
import { makeTestEnv, makeTestFixture, nextTick } from "../helpers";

describe("router directive t-routecomponent", () => {
  let fixture: HTMLElement;
  let env: RouterEnv;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = <RouterEnv>makeTestEnv();
    delete QWeb.DIRECTIVE_NAMES.routecomponent;
    QWeb.DIRECTIVES = QWeb.DIRECTIVES.filter(d => d.name !== "routecomponent");
    for (let key in QWeb.components) {
        delete QWeb.components[key];
    }
  });

  afterEach(() => {
    fixture.remove();
  });

  test("can render simple cases", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <t t-routecomponent="1" />
            </div>
            <span t-name="About">About</span>
            <span t-name="Users">Users</span>
        </templates>
    `);
    class About extends Component<any, any, any> {}
    class Users extends Component<any, any, any> {}
    class App extends Component<any, any, any> {
      components = { About, Users };
    }

    const routes = [
      { name: "about", path: "/about", component: About },
      { name: "users", path: "/users", component: Users }
    ];
    activate(env, routes, {mode: 'history'});
    const router = env.router;
    router.navigate({ route: "about" });
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>About</span></div>");

    router.navigate({ route: "users" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>Users</span></div>");
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();
  });

  test("can render parameterized route", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <t t-routecomponent="1" />
            </div>
            <span t-name="Book">Book <t t-esc="props.title"/></span>
        </templates>
    `);
    class Book extends Component<any, any, any> {}
    class App extends Component<any, any, any> {
      components = { Book };
    }

    const routes = [{ name: "book", path: "/book/{{title}}", component: Book }];
    activate(env, routes, {mode: 'history'});
    const router = env.router;
    router.navigate({ route: "book", params: { title: "1984" } });
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>Book 1984</span></div>");
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();
  });

  test("can render parameterized route with suffixes", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <t t-routecomponent="1" />
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
      components = { Book };
    }

    const routes = [{ name: "book", path: "/book/{{title}}/{{val.number}}", component: Book }];
    activate(env, routes, {mode: 'history'});
    const router = env.router;
    router.navigate({ route: "book", params: { title: "1984", val: "123" } });
    const app = new App(env);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>Book 1984|124</span></div>");
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();
  });
});
