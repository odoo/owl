import { describe, expect, test } from "vitest";
import { composeCodec, getLockedKeys, hiddenKeys, lockedKeys, RouterCodec } from "../src/codec";

interface State {
  page: string;
  id?: number;
  debug?: string;
  cache?: any;
}

const base: RouterCodec<State> = {
  encode(state) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (k === "page" || v === undefined) continue;
      search.set(k, String(v));
    }
    const qs = search.toString();
    return `/${state.page}${qs ? `?${qs}` : ""}`;
  },
  decode(url) {
    const segments = url.pathname.split("/").filter(Boolean);
    const state: State = { page: segments[0] ?? "" };
    for (const [k, v] of url.searchParams) {
      (state as any)[k] = isNaN(+v) ? v : +v;
    }
    return state;
  },
};

describe("base codec round-trip", () => {
  test("encode then decode returns the same state", () => {
    const state: State = { page: "users", id: 42 };
    const encoded = base.encode(state);
    const decoded = base.decode(new URL(encoded, "http://localhost/"));
    expect(decoded).toEqual(state);
  });
});

describe("composeCodec", () => {
  test("no middlewares returns the base codec untouched", () => {
    const codec = composeCodec(base, []);
    expect(codec.encode({ page: "x" })).toBe("/x");
  });

  test("middlewares apply left to right", () => {
    const order: string[] = [];
    const tag =
      (name: string) =>
      (inner: RouterCodec<State>): RouterCodec<State> => ({
        encode(s) {
          order.push(`${name}:encode`);
          return inner.encode(s);
        },
        decode(u) {
          order.push(`${name}:decode`);
          return inner.decode(u);
        },
      });
    const codec = composeCodec(base, [tag("a"), tag("b")]);
    codec.encode({ page: "x" });
    expect(order).toEqual(["b:encode", "a:encode"]);
    order.length = 0;
    codec.decode(new URL("http://localhost/x"));
    expect(order).toEqual(["b:decode", "a:decode"]);
  });
});

describe("hiddenKeys middleware", () => {
  test("removes the listed keys from the URL", () => {
    const codec = composeCodec(base, [hiddenKeys<State>(["cache"])]);
    const url = codec.encode({ page: "u", id: 1, cache: { huge: "blob" } });
    expect(url).toBe("/u?id=1");
  });

  test("decode is unchanged", () => {
    const codec = composeCodec(base, [hiddenKeys<State>(["cache"])]);
    expect(codec.decode(new URL("http://localhost/u?id=1"))).toEqual({ page: "u", id: 1 });
  });
});

describe("lockedKeys middleware", () => {
  test("advertises the locked keys via getLockedKeys", () => {
    const codec = composeCodec(base, [lockedKeys<State>(["debug"])]);
    expect(getLockedKeys(codec)).toEqual(["debug"]);
  });

  test("base codec has no locked keys", () => {
    expect(getLockedKeys(base)).toEqual([]);
  });

  test("multiple lockedKeys layers concatenate", () => {
    const codec = composeCodec(base, [lockedKeys<State>(["debug"]), lockedKeys<State>(["page"])]);
    expect(getLockedKeys(codec)).toEqual(["debug", "page"]);
  });

  test("does not change encode/decode behavior on its own", () => {
    const plain = base.encode({ page: "u", id: 7 });
    const codec = composeCodec(base, [lockedKeys<State>(["debug"])]);
    expect(codec.encode({ page: "u", id: 7 })).toBe(plain);
  });
});
