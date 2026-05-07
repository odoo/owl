import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Component, mount, providePlugins, xml, type App } from "@odoo/owl-runtime";
import { Link, RouteSwitch } from "../src/components";
import { RouterPlugin } from "../src/plugin";
import { MemoryHistoryAdapter } from "../src/history";
import { RouterCodec } from "../src/codec";

interface State {
  page: string;
  id?: number;
}

const codec: RouterCodec<State> = {
  encode(state) {
    return state.id !== undefined ? `/${state.page}/${state.id}` : `/${state.page}`;
  },
  decode(url) {
    const [page, id] = url.pathname.split("/").filter(Boolean);
    return id !== undefined ? { page, id: +id } : { page: page ?? "" };
  },
};

let fixture: HTMLElement;
let mountedApp: App | null = null;

beforeEach(() => {
  fixture = document.createElement("div");
  document.body.appendChild(fixture);
  window.history.replaceState(null, "", "/start");
});

afterEach(() => {
  mountedApp?.destroy();
  mountedApp = null;
  fixture.remove();
});

function nextTick() {
  return new Promise((res) => setTimeout(res));
}

async function mountWithRouter<T extends typeof Component>(
  Inner: T,
  options: { initialUrl?: string } = {}
) {
  const history = new MemoryHistoryAdapter({
    initialUrl: options.initialUrl ?? "http://localhost/home",
  });
  class Wrapper extends Component {
    static template = xml`<t t-component="this.constructor.Inner"/>`;
    static Inner = Inner;
    static components: any;
    setup() {
      providePlugins([RouterPlugin], { codec, history });
    }
  }
  (Wrapper as any).components = { [Inner.name]: Inner };
  const component = await mount(Wrapper as any, fixture);
  mountedApp = (component as any).__owl__.app;
  // Pull the router out of the wrapper's plugin manager.
  const manager = (component as any).__owl__.pluginManager;
  const router = manager.getPlugin(RouterPlugin)!.router;
  return { component, history, router };
}

describe("Link", () => {
  test("renders an <a> with the given href", async () => {
    class Page extends Component {
      static template = xml`<Link href="'/users/42'">User 42</Link>`;
      static components = { Link };
    }
    const { router } = await mountWithRouter(Page);
    const a = fixture.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/users/42");
    expect(a.textContent).toBe("User 42");
    expect(router.state()).toEqual({ page: "home" });
  });

  test("intercepts clicks and soft-navigates", async () => {
    class Page extends Component {
      static template = xml`<Link href="'/users/42'">User 42</Link>`;
      static components = { Link };
    }
    const { router } = await mountWithRouter(Page);
    const a = fixture.querySelector("a")!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    a.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(router.state()).toEqual({ page: "users", id: 42 });
  });

  test("modifier keys allow default browser behavior", async () => {
    class Page extends Component {
      static template = xml`<Link href="'/users/42'">User 42</Link>`;
      static components = { Link };
    }
    const { router } = await mountWithRouter(Page);
    const a = fixture.querySelector("a")!;
    const ev = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    a.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(router.state()).toEqual({ page: "home" });
  });

  test("replace prop calls navigate with replace:true", async () => {
    class Page extends Component {
      static template = xml`<Link href="'/users/1'" replace="true">User</Link>`;
      static components = { Link };
    }
    const { router, history } = await mountWithRouter(Page);
    const a = fixture.querySelector("a")!;
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    expect(router.state()).toEqual({ page: "users", id: 1 });
    history.back();
    expect(router.url().pathname).toBe("/users/1");
  });
});

describe("RouteSwitch", () => {
  class Home extends Component {
    static template = xml`<div>home page</div>`;
  }
  class Users extends Component {
    static template = xml`<div>users page</div>`;
  }
  class NotFound extends Component {
    static template = xml`<div>not found</div>`;
  }

  test("renders the slot picked by `select`", async () => {
    class Page extends Component {
      static template = xml`
        <RouteSwitch select="(s) => s.page">
          <t t-set-slot="home"><Home/></t>
          <t t-set-slot="users"><Users/></t>
          <t t-set-slot="default"><NotFound/></t>
        </RouteSwitch>`;
      static components = { RouteSwitch, Home, Users, NotFound };
    }
    await mountWithRouter(Page);
    expect(fixture.textContent).toContain("home page");
  });

  test("falls back to the default slot for unknown names", async () => {
    class Page extends Component {
      static template = xml`
        <RouteSwitch select="(s) => s.page">
          <t t-set-slot="home"><Home/></t>
          <t t-set-slot="default"><NotFound/></t>
        </RouteSwitch>`;
      static components = { RouteSwitch, Home, NotFound };
    }
    await mountWithRouter(Page, { initialUrl: "http://localhost/elsewhere" });
    expect(fixture.textContent).toContain("not found");
  });

  test("re-renders when router state changes", async () => {
    class Page extends Component {
      static template = xml`
        <RouteSwitch select="(s) => s.page">
          <t t-set-slot="home"><Home/></t>
          <t t-set-slot="users"><Users/></t>
          <t t-set-slot="default"><NotFound/></t>
        </RouteSwitch>`;
      static components = { RouteSwitch, Home, Users, NotFound };
    }
    const { router } = await mountWithRouter(Page);
    expect(fixture.textContent).toContain("home page");
    router.navigate("/users");
    await nextTick();
    expect(fixture.textContent).toContain("users page");
  });
});
