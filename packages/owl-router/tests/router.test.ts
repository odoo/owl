import { describe, expect, test, vi } from "vitest";
import { effect } from "@odoo/owl-core";
import { Router } from "../src/router";
import { composeCodec, lockedKeys, RouterCodec } from "../src/codec";
import { MemoryHistoryAdapter } from "../src/history";

interface TestState {
  page: string;
  id?: number;
  debug?: number;
}

const codec: RouterCodec<TestState> = {
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
    const state: TestState = { page: segments[0] ?? "" };
    for (const [k, v] of url.searchParams) {
      (state as any)[k] = isNaN(+v) ? v : +v;
    }
    return state;
  },
};

function makeRouter(initialUrl = "http://localhost/home") {
  const history = new MemoryHistoryAdapter({ initialUrl });
  const reload = vi.fn();
  const router = new Router<TestState>({ codec, history, reload });
  return { router, history, reload };
}

async function tick() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("initial state", () => {
  test("decodes the initial URL into state", () => {
    const { router } = makeRouter("http://localhost/users?id=42");
    expect(router.state()).toEqual({ page: "users", id: 42 });
    expect(router.url().pathname).toBe("/users");
  });
});

describe("push / replace", () => {
  test("push updates state and history (after a tick)", async () => {
    const { router, history } = makeRouter();
    router.push({ page: "users", id: 7 });
    await tick();
    expect(router.state()).toEqual({ page: "users", id: 7 });
    expect(history.url().pathname).toBe("/users");
  });

  test("replace updates without adding a history entry", async () => {
    const { router, history } = makeRouter();
    router.push({ page: "a" });
    await tick();
    router.replace({ page: "b" });
    await tick();
    expect(history.url().pathname).toBe("/b");
    history.back();
    expect(router.url().pathname).toBe("/home");
  });

  test("multiple pushes in the same tick coalesce into one entry", async () => {
    const { router, history } = makeRouter();
    router.push({ page: "a" });
    router.push({ page: "b", id: 1 });
    router.push({ id: 2 });
    await tick();
    expect(router.state()).toEqual({ page: "b", id: 2 });
    history.back();
    expect(router.url().pathname).toBe("/home");
  });

  test("sync option flushes immediately", () => {
    const { router } = makeRouter();
    router.push({ page: "now" }, { sync: true });
    expect(router.state()).toEqual({ page: "now" });
  });

  test("replace is sticky within a coalesced batch", async () => {
    const { router, history } = makeRouter();
    router.push({ page: "a" });
    router.replace({ id: 5 });
    await tick();
    // Replace wins: the initial /home entry was overwritten with /a?id=5,
    // so history.back() is a no-op (the stack only has one entry).
    expect(history.url().pathname + history.url().search).toBe("/a?id=5");
    history.back();
    expect(router.url().pathname).toBe("/a");
  });

  test("reload option triggers the reload callback once", async () => {
    const { router, reload } = makeRouter();
    router.push({ page: "x" }, { reload: true });
    await tick();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("locked keys via codec middleware", () => {
  test("replace preserves locked keys from previous state", async () => {
    const lockedCodec = composeCodec(codec, [lockedKeys<TestState>(["debug"])]);
    const history = new MemoryHistoryAdapter({ initialUrl: "http://localhost/home?debug=1" });
    const router = new Router<TestState>({ codec: lockedCodec, history });
    expect(router.state()).toEqual({ page: "home", debug: 1 });

    router.replace({ page: "settings" });
    await tick();
    expect(router.state()).toEqual({ page: "settings", debug: 1 });
  });

  test("push does not preserve previous keys not in the partial", async () => {
    // push merges with the previous state, so previous keys naturally persist
    // unless overwritten. lockedKeys is only relevant to replace.
    const { router } = makeRouter("http://localhost/home?debug=1");
    router.push({ page: "settings" });
    await tick();
    expect(router.state()).toEqual({ page: "settings", debug: 1 });
  });
});

describe("popstate", () => {
  test("history.back updates state from history.state if present", async () => {
    const { router, history } = makeRouter();
    router.push({ page: "a", id: 1 }, { sync: true });
    router.push({ page: "b", id: 2 }, { sync: true });
    history.back();
    expect(router.state()).toEqual({ page: "a", id: 1 });
    expect(router.url().pathname).toBe("/a");
  });

  test("popstate without entry state falls back to decoding the URL", () => {
    const { router, history } = makeRouter();
    history.push(new URL("http://localhost/manual"), null);
    history.push(new URL("http://localhost/home"), null);
    history.back();
    expect(router.state()).toEqual({ page: "manual" });
  });

  test("popstate cancels any pending coalesced push", async () => {
    const { router, history } = makeRouter();
    router.push({ page: "a" }, { sync: true });
    router.push({ page: "b" }); // queued
    history.back();
    await tick();
    // The pending push should have been cancelled by popstate.
    expect(router.state()).toEqual({ page: "home" });
  });
});

describe("reactivity", () => {
  test("state signal triggers an effect on push", async () => {
    const { router } = makeRouter();
    const seen: string[] = [];
    effect(() => {
      seen.push(router.state().page);
    });
    expect(seen).toEqual(["home"]);
    router.push({ page: "a" }, { sync: true });
    await tick();
    expect(seen).toEqual(["home", "a"]);
  });

  test("skipNotify suppresses reactive update for that flush", async () => {
    const { router, history } = makeRouter();
    const seen: string[] = [];
    effect(() => {
      seen.push(router.state().page);
    });
    expect(seen).toEqual(["home"]);
    router.push({ page: "trap" }, { sync: true, skipNotify: true });
    await tick();
    expect(seen).toEqual(["home"]); // no notification
    expect(history.url().pathname).toBe("/trap"); // history did update
  });
});

describe("bfcache (pageshow.persisted)", () => {
  test("re-decodes the URL into state", async () => {
    const { router, history } = makeRouter();
    history.push(new URL("http://localhost/restored"), null);
    history.emitPageShow(true);
    expect(router.state()).toEqual({ page: "restored" });
  });

  test("non-persisted pageshow is a no-op", async () => {
    const { router, history } = makeRouter();
    history.push(new URL("http://localhost/restored"), null);
    history.emitPageShow(false);
    // state was not refreshed
    expect(router.state()).toEqual({ page: "home" });
  });
});

describe("navigate", () => {
  test("decodes a URL into state and pushes", () => {
    const { router, history } = makeRouter();
    router.navigate("/users?id=42");
    expect(router.state()).toEqual({ page: "users", id: 42 });
    expect(history.url().pathname).toBe("/users");
    history.back();
    expect(router.url().pathname).toBe("/home");
  });

  test("does not merge with previous state", () => {
    const { router } = makeRouter("http://localhost/home?id=5");
    expect(router.state()).toEqual({ page: "home", id: 5 });
    router.navigate("/users");
    expect(router.state()).toEqual({ page: "users" });
  });

  test("replace option uses replaceState", () => {
    const { router, history } = makeRouter();
    router.navigate("/users", { replace: true });
    history.back();
    // Original /home was replaced by /users, so back is a no-op.
    expect(router.url().pathname).toBe("/users");
  });

  test("absolute URL works", () => {
    const { router } = makeRouter();
    router.navigate(new URL("http://localhost/users?id=9"));
    expect(router.state()).toEqual({ page: "users", id: 9 });
  });
});

describe("dispose", () => {
  test("unsubscribes from history events", async () => {
    const { router, history } = makeRouter();
    router.dispose();
    history.push(new URL("http://localhost/x"), null);
    history.back();
    expect(router.state()).toEqual({ page: "home" });
  });

  test("subsequent push is a no-op", async () => {
    const { router, history } = makeRouter();
    router.dispose();
    router.push({ page: "x" }, { sync: true });
    expect(router.state()).toEqual({ page: "home" });
    expect(history.url().pathname).toBe("/home");
  });
});
