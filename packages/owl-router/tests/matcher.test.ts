import { describe, expect, test } from "vitest";
import { createMatcher } from "../src/matcher";

describe("createMatcher", () => {
  test("matches a static route", () => {
    const m = createMatcher({ home: "/home" });
    expect(m.decode(new URL("http://localhost/home"))).toEqual({
      name: "home",
      params: {},
    });
  });

  test("encodes a static route", () => {
    const m = createMatcher({ home: "/home" });
    expect(m.encode({ name: "home", params: {} })).toBe("/home");
  });

  test("decodes int params", () => {
    const m = createMatcher({ user: "/users/{id:int}" });
    expect(m.decode(new URL("http://localhost/users/42"))).toEqual({
      name: "user",
      params: { id: 42 },
    });
  });

  test("decodes string params", () => {
    const m = createMatcher({ tag: "/tags/{slug:string}" });
    expect(m.decode(new URL("http://localhost/tags/owl-rocks"))).toEqual({
      name: "tag",
      params: { slug: "owl-rocks" },
    });
  });

  test("encodes a route with multiple params", () => {
    const m = createMatcher({
      order: "/pos/{configId:int}/orders/{orderId:int}",
    });
    expect(m.encode({ name: "order", params: { configId: 7, orderId: 102 } })).toBe(
      "/pos/7/orders/102"
    );
  });

  test("encode throws for unknown route", () => {
    const m = createMatcher({ a: "/a" });
    expect(() => m.encode({ name: "missing" as any, params: {} })).toThrow(/Unknown route/);
  });

  test("encode throws when a required param is missing", () => {
    const m = createMatcher({ user: "/users/{id:int}" });
    expect(() => m.encode({ name: "user", params: {} })).toThrow(/Missing param/);
  });

  test("decode falls back to default route when nothing matches", () => {
    const m = createMatcher({ home: "/home", login: "/login" });
    expect(m.decode(new URL("http://localhost/elsewhere"))).toEqual({
      name: "home",
      params: {},
    });
  });

  test("explicit defaultName overrides the first-registered fallback", () => {
    const m = createMatcher({ home: "/home", notFound: "/_404" }, { defaultName: "notFound" });
    expect(m.decode(new URL("http://localhost/elsewhere"))).toEqual({
      name: "notFound",
      params: {},
    });
  });

  test("decoders try routes in registration order", () => {
    // Static routes should win over a more general pattern when both match.
    const m = createMatcher({
      static: "/users/me",
      dynamic: "/users/{id:string}",
    });
    expect(m.decode(new URL("http://localhost/users/me"))).toEqual({
      name: "static",
      params: {},
    });
    expect(m.decode(new URL("http://localhost/users/42"))).toEqual({
      name: "dynamic",
      params: { id: "42" },
    });
  });

  test("locale prefix exposes captured group as a param", () => {
    const m = createMatcher(
      { home: "/home" },
      { prefix: { regex: /(?:\/([a-z]{2}(?:_[a-z]{2})?))?/, name: "lang" } }
    );
    expect(m.decode(new URL("http://localhost/fr_be/home"))).toEqual({
      name: "home",
      params: { lang: "fr_be" },
    });
    expect(m.decode(new URL("http://localhost/home"))).toEqual({
      name: "home",
      params: {},
    });
  });

  test("rejects unknown param types eagerly", () => {
    expect(() => createMatcher({ x: "/{id:date}" })).toThrow(/Unknown param type/);
  });

  test("exposes the compiled route list", () => {
    const m = createMatcher({
      a: "/a",
      b: "/b/{id:int}",
    });
    expect(m.routes).toEqual([
      { name: "a", pattern: "/a" },
      { name: "b", pattern: "/b/{id:int}" },
    ]);
  });

  test("round-trips through encode/decode", () => {
    const m = createMatcher({
      product: "/products/{slug:string}/v/{version:int}",
    });
    const state = { name: "product" as const, params: { slug: "abc", version: 3 } };
    const url = m.encode(state);
    expect(m.decode(new URL(url, "http://localhost/"))).toEqual(state);
  });
});
