import { Destination, RouterEnv, Route } from "../../src/router/router";
import { makeTestEnv, nextTick } from "../helpers";
import { TestRouter } from "./test_router";

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

  test("navigate to same route but with different params should trigger update", async () => {
    router = new TestRouter(env, [{ name: "users", path: "/users/{{id}}" }]);
    env.qweb.forceUpdate = jest.fn();
    await router.navigate({ to: "users", params: { id: 3 } });
    expect(window.location.pathname).toBe("/users/3");
    expect(env.qweb.forceUpdate).toHaveBeenCalledTimes(1);

    await router.navigate({ to: "users", params: { id: 5 } });
    expect(window.location.pathname).toBe("/users/5");
    expect(env.qweb.forceUpdate).toHaveBeenCalledTimes(2);
  });

  test("changing url to same route but with different params should trigger update (hash mode)", async () => {
    env.qweb.forceUpdate = jest.fn();
    router = new TestRouter(env, [{ name: "users", path: "/users/{{id}}" }], { mode: "hash" });
    await router.start();
    await router.navigate({ to: "users", params: { id: 3 } });
    expect(window.location.hash).toBe("#/users/3");
    expect(env.qweb.forceUpdate).toHaveBeenCalledTimes(1);

    window.location.hash = "/users/5";
    window.dispatchEvent(new Event("hashchange"));
    await nextTick();
    expect(window.location.hash).toBe("#/users/5");
    expect(env.qweb.forceUpdate).toHaveBeenCalledTimes(2);
  });

  test("navigate in hash mode preserve location", async () => {
    router = new TestRouter(env, [{ name: "users", path: "/users/{{id}}" }], {mode: "hash"});
    window.history.pushState({}, "title", window.location.origin + '/test.html');
    expect(window.location.href).toBe("http://localhost/test.html");
    await router.navigate({ to: "users", params: { id: 3 } });
    expect(window.location.href).toBe("http://localhost/test.html#/users/3");
  });

});

describe("routeToPath", () => {
  test("simple non parameterized path", () => {
    router = new TestRouter(env, []);
    expect(router["routeToPath"]({ path: "/abc" } as Route, {})).toBe("/abc");
    expect(router["routeToPath"]({ path: "/abc/def" } as Route, {})).toBe("/abc/def");
    expect(router["routeToPath"]({ path: "/abc" } as Route, { val: 12 })).toBe("/abc");
  });

  test("simple parameterized path", () => {
    router = new TestRouter(env, []);
    expect(router["routeToPath"]({ path: "/abc/{{def}}" } as Route, { def: 34 })).toBe("/abc/34");
  });

  test("simple non parameterized path, mode = hash", () => {
    router = new TestRouter(env, [], { mode: "hash" });
    expect(router["routeToPath"]({ path: "/abc" } as Route, {})).toBe("#/abc");
    expect(router["routeToPath"]({ path: "/abc/def" } as Route, {})).toBe("#/abc/def");
    expect(router["routeToPath"]({ path: "/abc" } as Route, { val: 12 })).toBe("#/abc");
  });

  test("simple parameterized path, mode=hash", () => {
    router = new TestRouter(env, [], { mode: "hash" });
    expect(router["routeToPath"]({ path: "/abc/{{def}}" } as Route, { def: 34 })).toBe("#/abc/34");
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
  test("properly match simple routes", () => {
    router = new TestRouter(env, []);
    // simple route
    expect(router["getRouteParams"]({ path: "/home" } as Route, "/home")).toEqual({});

    // no match
    expect(router["getRouteParams"]({ path: "/home" } as Route, "/otherpath")).toEqual(false);

    // fallback route
    expect(router["getRouteParams"]({ path: "*" } as Route, "somepath")).toEqual({});
  });

  test("properly match simple routes, mode hash", () => {
    router = new TestRouter(env, [], { mode: "hash" });
    // simple route
    expect(router["getRouteParams"]({ path: "/home" } as Route, "#/home")).toEqual({});

    // no match
    expect(router["getRouteParams"]({ path: "/home" } as Route, "#/otherpath")).toEqual(false);

    // fallback route
    expect(router["getRouteParams"]({ path: "*" } as Route, "#/somepath")).toEqual({});
  });

  test("match some parameterized routes", () => {
    router = new TestRouter(env, []);
    expect(router["getRouteParams"]({ path: "/invoices/{{id}}" } as Route, "/invoices/3")).toEqual({
      id: "3"
    });
  });

  test("match some parameterized routes, mode hash", () => {
    router = new TestRouter(env, [], { mode: "hash" });
    expect(router["getRouteParams"]({ path: "/invoices/{{id}}" } as Route, "#/invoices/3")).toEqual(
      {
        id: "3"
      }
    );
  });

  test("can convert to number if needed", () => {
    router = new TestRouter(env, []);
    expect(
      router["getRouteParams"]({ path: "/invoices/{{id.number}}" } as Route, "/invoices/3")
    ).toEqual({
      id: 3
    });
  });

  test("can convert to number if needed, mode: hash", () => {
    router = new TestRouter(env, [], { mode: "hash" });
    expect(
      router["getRouteParams"]({ path: "/invoices/{{id.number}}" } as Route, "#/invoices/3")
    ).toEqual({
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
      { name: "routea", path: "/some/patha" },
      { name: "routeb", path: "/some/pathb", beforeRouteEnter: guard }
    ]);

    await router.start();
    await router.navigate({ to: "routea" });
    expect(window.location.pathname).toBe("/some/patha");
    const result = await router.navigate({ to: "routeb" });
    expect(result).toBe(false);
    expect(guard).toBeCalledTimes(1);
    expect(window.location.pathname).toBe("/some/patha");
    expect(router.currentRouteName).toBe("routea");
  });

  test("navigation is redirected if guard decides so", async () => {
    expect(window.location.pathname).toBe("/");
    const guard = jest.fn(() => {
      return { to: "routec" };
    });
    router = new TestRouter(env, [
      { name: "routea", path: "/some/patha" },
      { name: "routeb", path: "/some/pathb", beforeRouteEnter: guard },
      { name: "routec", path: "/some/pathc" }
    ]);

    await router.start();
    const result = await router.navigate({ to: "routea" });
    expect(result).toBe(true);
    expect(window.location.pathname).toBe("/some/patha");
    await router.navigate({ to: "routeb" });
    expect(guard).toBeCalledTimes(1);
    expect(window.location.pathname).toBe("/some/pathc");
    expect(router.currentRouteName).toBe("routec");
  });

  test("navigation is initially redirected if guard decides so", async () => {
    expect(window.location.pathname).toBe("/");
    const guard = jest.fn(() => {
      return { to: "otherroute" };
    });
    router = new TestRouter(env, [
      { name: "landing", path: "/", beforeRouteEnter: guard },
      { name: "otherroute", path: "/some/other/route" }
    ]);

    expect(window.location.pathname).toBe("/");

    await router.start();
    expect(window.location.pathname).toBe("/some/other/route");
  });
});
