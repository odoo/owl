import { matchRoute, routeToURL } from "../../src/router/plugin";

describe("routeToURL", () => {
    test("simple non parameterized path", () => {
        expect(routeToURL("/abc", {})).toBe("/abc");
        expect(routeToURL("/abc/def", {})).toBe("/abc/def");
        expect(routeToURL("/abc", {val: 12})).toBe("/abc");
    });

    test("simple parameterized path", () => {
        expect(routeToURL("/abc/{{def}}", {def: 34})).toBe("/abc/34");
    });

});

describe("match routes", () => {
  test("properly match simple routes", () => {
    // simple route
    expect(matchRoute({ path: "/home", name: "someroute" }, "/home")).toEqual({});

    // no match
    expect(matchRoute({ path: "/home", name: "someroute" }, "/otherpath")).toEqual(false);

    // fallback route
    expect(matchRoute({ path: "*", name: "someroute" }, "somepath")).toEqual({});
  });

  test("match some parameterized routes", () => {
    expect(matchRoute({ path: "/invoices/{{id}}", name: "someroute" }, "/invoices/3")).toEqual({
      id: "3"
    });
  });

  test("can convert to number if needed", () => {
    expect(matchRoute({ path: "/invoices/{{id.number}}", name: "someroute" }, "/invoices/3")).toEqual({
      id: 3
    });
  });
});
