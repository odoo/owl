import { Destination, Router, RouterEnv, Route } from "../../src/router/Router";
import { makeTestEnv } from "../helpers";
import { TestRouter } from "./TestRouter";

let env: RouterEnv;
let router: TestRouter | null = null;

beforeEach(() => {
  env = <RouterEnv>makeTestEnv();
  window.history.pushState({}, "/", "/");
});

afterEach(() => {
  if (router) {
    router.destroy();
  }
  router = null;
});

describe("router miscellaneous", () => {
  test("validate routes shape", () => {
    expect(() => {
      router = new TestRouter(env, [
        { name: "someroute", path: "/some/path", redirect: { abc: "hey" } as Destination }
      ]);
    }).toThrow(`Invalid destination: {"abc":"hey"}`);
  });
});

describe("routeToPath", () => {
  const routeToPath = Router.prototype["routeToPath"];
  test("simple non parameterized path", () => {
    expect(routeToPath({path: "/abc"} as Route, {})).toBe("/abc");
    expect(routeToPath({path: "/abc/def"} as Route, {})).toBe("/abc/def");
    expect(routeToPath({path: "/abc"} as Route, { val: 12 })).toBe("/abc");
  });

  test("simple parameterized path", () => {
    expect(routeToPath({path: "/abc/{{def}}"} as Route, { def: 34 })).toBe("/abc/34");
  });
});

describe("destToPath", () => {
  test("validate destination shape", () => {
    router = new TestRouter(env, [{ name: "someroute", path: "/some/path" }]);
    expect(() => {
      router!.destToPath({ abc: 123 } as Destination);
    }).toThrow('Invalid destination: {"abc":123}');

    expect(() => {
      router!.destToPath({ to: "someroute" } as Destination);
    }).not.toThrow();

    expect(() => {
      router!.destToPath({ path: "/someroute", to: "otherroute" } as Destination);
    }).toThrow();
  });
});

describe("getRouteParams", () => {
  const getRouteParams = Router.prototype["getRouteParams"];
  test("properly match simple routes", () => {
    // simple route
    expect(getRouteParams({path: "/home"} as Route, "/home")).toEqual({});

    // no match
    expect(getRouteParams({path: "/home"} as Route, "/otherpath")).toEqual(false);

    // fallback route
    expect(getRouteParams({path: "*"} as Route, "somepath")).toEqual({});
  });

  test("match some parameterized routes", () => {
    expect(getRouteParams({path: "/invoices/{{id}}"} as Route, "/invoices/3")).toEqual({
      id: "3"
    });
  });

  test("can convert to number if needed", () => {
    expect(getRouteParams({path: "/invoices/{{id.number}}"} as Route, "/invoices/3")).toEqual({
      id: 3
    });
  });
});

describe("redirect", () => {
  test("can redirect to other route", async () => {
    router = new TestRouter(env, [
      { name: "routea", path: "/some/path" },
      { name: "routeb", path: "/some/other/path", redirect: { to: "routea" } }
    ]);

    await router.start();
    expect(window.location.pathname).toBe("/");
    await router.navigate({ to: "routeb" });
    expect(window.location.pathname).toBe("/some/path");
    expect(router.currentRouteName).toBe("routea");
  });

  test("can redirect to other path", async () => {
    router = new TestRouter(env, [
      { name: "routea", path: "/some/path" },
      { name: "routeb", path: "/some/other/path", redirect: { path: "/some/path" } }
    ]);
    router.navigate = jest.fn(router.navigate);

    await router.start();
    await router.navigate({ to: "routeb" });

    // once because we ask for it, once because it is redirected
    // expect(router.navigate).toBeCalledTimes(2);
    expect(window.location.pathname).toBe("/some/path");
    expect(router.currentRouteName).toBe("routea");
  });
});

describe("beforeRouteEnter", () => {
  test("navigation guard is called and properly handle return true", async () => {
    expect(window.location.pathname).not.toBe("/some/path");
    const guard = jest.fn(() => true);
    router = new TestRouter(env, [{ name: "route", path: "/some/path", beforeRouteEnter: guard }]);

    await router.start();
    await router.navigate({ to: "route" });
    expect(guard).toBeCalledTimes(1);
    expect(window.location.pathname).toBe("/some/path");
    expect(router.currentRouteName).toBe("route");
  });

  test("navigation is cancelled if guard return false", async () => {
    expect(window.location.pathname).toBe("/");
    const guard = jest.fn(() => false);
    router = new TestRouter(env, [
        { name: "routea", path: "/some/patha"},
        { name: "routeb", path: "/some/pathb", beforeRouteEnter: guard }
        ]);

    await router.start();
    await router.navigate({ to: "routea" });
    expect(window.location.pathname).toBe("/some/patha");
    await router.navigate({ to: "routeb" });
    expect(guard).toBeCalledTimes(1);
    expect(window.location.pathname).toBe("/some/patha");
    expect(router.currentRouteName).toBe("routea");
  });

  test("navigation is redirected if guard decides so", async () => {
    expect(window.location.pathname).toBe("/");
    const guard = jest.fn(() => {return {to: "routec"}});
    router = new TestRouter(env, [
        { name: "routea", path: "/some/patha"},
        { name: "routeb", path: "/some/pathb", beforeRouteEnter: guard },
        { name: "routec", path: "/some/pathc"},
        ]);

    await router.start();
    await router.navigate({ to: "routea" });
    expect(window.location.pathname).toBe("/some/patha");
    await router.navigate({ to: "routeb" });
    expect(guard).toBeCalledTimes(1);
    expect(window.location.pathname).toBe("/some/pathc");
    expect(router.currentRouteName).toBe("routec");
  });

  test("navigation is initially redirected if guard decides so", async () => {
    expect(window.location.pathname).toBe("/");
    const guard = jest.fn(() => {return {to: "otherroute"}});
    router = new TestRouter(env, [
        { name: "landing", path: "/", beforeRouteEnter: guard},
        { name: "otherroute", path: "/some/other/route"}
        ]);

    expect(window.location.pathname).toBe("/");

    await router.start();
    expect(window.location.pathname).toBe("/some/other/route");
  });
});
