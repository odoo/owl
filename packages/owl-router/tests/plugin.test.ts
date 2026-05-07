import { describe, expect, test, vi } from "vitest";
import { App, plugin } from "@odoo/owl-runtime";
import { PluginManager } from "@odoo/owl-core";
import { RouterPlugin } from "../src/plugin";
import { useRouter } from "../src/hooks";
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

function makeManager(
  initialUrl = "http://localhost/home",
  overrides: Record<string, unknown> = {}
) {
  const history = new MemoryHistoryAdapter({ initialUrl });
  const reload = vi.fn();
  const manager = new PluginManager(new App(), {
    config: { codec, history, reload, ...overrides },
  });
  return { manager, history, reload };
}

describe("RouterPlugin", () => {
  test("reads codec from plugin config and starts a Router", () => {
    const { manager } = makeManager();
    manager.startPlugins([RouterPlugin]);
    const p = manager.getPlugin(RouterPlugin)!;
    expect(p).toBeInstanceOf(RouterPlugin);
    expect(p.router.state()).toEqual({ page: "home" });
  });

  test("router is disposed when the manager is destroyed", async () => {
    const { manager, history } = makeManager();
    manager.startPlugins([RouterPlugin]);
    const router = manager.getPlugin(RouterPlugin)!.router;
    manager.destroy();
    // Pushes are no-ops post-dispose; popstate is unsubscribed too.
    router.push({ page: "x" }, { sync: true });
    expect(router.state()).toEqual({ page: "home" });
    history.push(new URL("http://localhost/elsewhere"), null);
    history.back();
    expect(router.state()).toEqual({ page: "home" });
  });

  test("missing codec config throws", () => {
    const manager = new PluginManager(new App(), { config: {} });
    expect(() => manager.startPlugins([RouterPlugin])).toThrow();
  });
});

describe("useRouter", () => {
  test("returns the running router via plugin scope", () => {
    const { manager } = makeManager();
    manager.startPlugins([RouterPlugin]);
    const router = manager.run(() => useRouter<State>());
    expect(router).toBe(manager.getPlugin(RouterPlugin)!.router);
    expect(router.state().page).toBe("home");
  });

  test("starts the plugin lazily when called from a plugin manager scope", () => {
    // useRouter is implemented via plugin(), which auto-starts the plugin
    // when the active scope is the manager itself (matching plugin_hooks.ts
    // behaviour).
    const { manager } = makeManager();
    expect(manager.getPlugin(RouterPlugin)).toBeNull();
    manager.run(() => useRouter<State>());
    expect(manager.getPlugin(RouterPlugin)).toBeInstanceOf(RouterPlugin);
  });

  test("returns same instance on repeated calls", () => {
    const { manager } = makeManager();
    manager.startPlugins([RouterPlugin]);
    const a = manager.run(() => useRouter());
    const b = manager.run(() => useRouter());
    expect(a).toBe(b);
  });

  test("plugin() in a non-manager scope without prior start throws", () => {
    // Outside a plugin manager scope, useScope() throws — useRouter inherits
    // that behavior. Asserting it documents the contract.
    expect(() => useRouter()).toThrow();
  });

  test("plugin smoke test: plugin alias resolves", () => {
    // Sanity-check that the runtime helper is the one we re-import.
    expect(typeof plugin).toBe("function");
  });
});
