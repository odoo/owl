import { Router } from "../../src/router/Router";

describe("routeToURL", () => {
  const routeToURL = Router.prototype.routeToURL;
  test("simple non parameterized path", () => {
    expect(routeToURL("/abc", {})).toBe("/abc");
    expect(routeToURL("/abc/def", {})).toBe("/abc/def");
    expect(routeToURL("/abc", { val: 12 })).toBe("/abc");
  });

  test("simple parameterized path", () => {
    expect(routeToURL("/abc/{{def}}", { def: 34 })).toBe("/abc/34");
  });
});

describe("match routes", () => {
  const matchRoute = Router.prototype.matchRoute;
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
