import { Destination, Router, RouterEnv } from "../../src/router/Router";
import { makeTestEnv } from "../helpers";
import { TestRouter } from "./TestRouter";

let env: RouterEnv;
let router: TestRouter | null = null;

beforeEach(() => {
  env = <RouterEnv>makeTestEnv();
});

afterEach(() => {
  if (router) {
    router.destroy();
  }
  router = null;
});

describe("routeToURL", () => {
  const routeToURL = Router.prototype["routeToURL"];
  test("simple non parameterized path", () => {
    expect(routeToURL("/abc", {})).toBe("/abc");
    expect(routeToURL("/abc/def", {})).toBe("/abc/def");
    expect(routeToURL("/abc", { val: 12 })).toBe("/abc");
  });

  test("simple parameterized path", () => {
    expect(routeToURL("/abc/{{def}}", { def: 34 })).toBe("/abc/34");
  });
});

describe("destToURL", () => {
  test("validate destination shape", () => {
    router = new TestRouter(env, [{ name: "someroute", path: "/some/path" }]);
    expect(() => {
      router!.destToUrl({ abc: 123 } as Destination);
    }).toThrow('Invalid destination: {"abc":123}');

    expect(() => {
      router!.destToUrl({ name: "someroute" } as Destination);
    }).not.toThrow();

    expect(() => {
      router!.destToUrl({ path: "/someroute", name: "otherroute" } as Destination);
    }).toThrow();
  });
});

describe("match routes", () => {
  const matchRoute = Router.prototype["matchRoute"];
  test("properly match simple routes", () => {
    // simple route
    expect(matchRoute("/home", "/home")).toEqual({});

    // no match
    expect(matchRoute("/home", "/otherpath")).toEqual(false);

    // fallback route
    expect(matchRoute("*", "somepath")).toEqual({});
  });

  test("match some parameterized routes", () => {
    expect(matchRoute("/invoices/{{id}}", "/invoices/3")).toEqual({
      id: "3"
    });
  });

  test("can convert to number if needed", () => {
    expect(matchRoute("/invoices/{{id.number}}", "/invoices/3")).toEqual({
      id: 3
    });
  });
});

describe("redirect", () => {
  test("can redirect to other route", () => {
    router = new TestRouter(env, [
      { name: "routea", path: "/some/path" },
      { name: "routeb", path: "/some/other/path", redirect: { name: "routea" } }
    ]);

    router.navigate({ name: "routeb" });
    expect(window.location.pathname).toBe("/some/path");
    expect(router.currentRouteName).toBe("routea");
  });

  test("can redirect to other path", () => {
    router = new TestRouter(env, [
      { name: "routea", path: "/some/path" },
      { name: "routeb", path: "/some/other/path", redirect: { path: "/some/path" } }
    ]);

    router.navigate({ name: "routeb" });
    expect(window.location.pathname).toBe("/some/path");
    expect(router.currentRouteName).toBe("routea");
  });
});
