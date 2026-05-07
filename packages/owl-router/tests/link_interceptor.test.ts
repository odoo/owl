import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { App } from "@odoo/owl-runtime";
import { PluginManager } from "@odoo/owl-core";
import { Router } from "../src/router";
import { MemoryHistoryAdapter } from "../src/history";
import { useLinkInterceptor } from "../src/hooks";
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

const liveManagers: PluginManager[] = [];

function attach(router: Router, options: Parameters<typeof useLinkInterceptor>[1]) {
  const manager = new PluginManager(new App());
  manager.run(() => useLinkInterceptor(router, options));
  liveManagers.push(manager);
  return manager;
}

function clickAnchor(href: string, opts: { target?: string } = {}) {
  const a = document.createElement("a");
  a.setAttribute("href", href);
  if (opts.target) a.target = opts.target;
  document.body.appendChild(a);
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  a.dispatchEvent(ev);
  return { anchor: a, event: ev };
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/start");
});

afterEach(() => {
  while (liveManagers.length) {
    liveManagers.pop()!.destroy();
  }
  document.body.innerHTML = "";
});

describe("useLinkInterceptor", () => {
  test("intercepts a matching internal link", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    attach(router, { match: () => true });
    const { event } = clickAnchor("/users/42");
    expect(event.defaultPrevented).toBe(true);
    expect(router.state()).toEqual({ page: "users", id: 42 });
  });

  test("does not intercept when match returns false", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    attach(router, { match: () => false });
    const { event } = clickAnchor("/users/42");
    expect(event.defaultPrevented).toBe(false);
    expect(router.state()).toEqual({ page: "home" });
  });

  test("ignores anchor links (#fragment)", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    attach(router, { match: () => true });
    const { event } = clickAnchor("#section");
    expect(event.defaultPrevented).toBe(false);
    expect(router.state()).toEqual({ page: "home" });
  });

  test("ignores target=_blank", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    attach(router, { match: () => true });
    const { event } = clickAnchor("/users/42", { target: "_blank" });
    expect(event.defaultPrevented).toBe(false);
    expect(router.state()).toEqual({ page: "home" });
  });

  test("ignores clicks where defaultPrevented was already set", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    attach(router, { match: () => true });
    const a = document.createElement("a");
    a.setAttribute("href", "/users/42");
    document.body.appendChild(a);
    a.addEventListener("click", (ev) => ev.preventDefault());
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    a.dispatchEvent(ev);
    expect(router.state()).toEqual({ page: "home" });
  });

  test("ignores clicks inside contenteditable", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    attach(router, { match: () => true });
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const a = document.createElement("a");
    a.setAttribute("href", "/users/42");
    editor.appendChild(a);
    document.body.appendChild(editor);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    a.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(router.state()).toEqual({ page: "home" });
  });

  test("ignores middle-click and modified clicks", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    attach(router, { match: () => true });
    const a = document.createElement("a");
    a.setAttribute("href", "/users/42");
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }));
    expect(router.state()).toEqual({ page: "home" });
    a.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true })
    );
    expect(router.state()).toEqual({ page: "home" });
  });

  test("releases the listener when the scope is destroyed", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    const manager = attach(router, { match: () => true });
    manager.destroy();
    const { event } = clickAnchor("/users/42");
    expect(event.defaultPrevented).toBe(false);
    expect(router.state()).toEqual({ page: "home" });
  });

  test("replace option uses replaceState semantics", () => {
    const history = new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" });
    const router = new Router<State>({ codec, history });
    attach(router, { match: () => true, replace: true });
    clickAnchor("/users/42");
    expect(router.state()).toEqual({ page: "users", id: 42 });
    history.back();
    expect(router.url().pathname).toBe("/users/42");
  });

  test("custom target restricts where clicks are intercepted", () => {
    const router = new Router<State>({
      codec,
      history: new MemoryHistoryAdapter({ initialUrl: "http://localhost/home" }),
    });
    const insideShell = document.createElement("section");
    document.body.appendChild(insideShell);
    attach(router, { match: () => true, target: insideShell });

    // Click inside the shell — intercepted.
    const a1 = document.createElement("a");
    a1.setAttribute("href", "/users/1");
    insideShell.appendChild(a1);
    const ev1 = new MouseEvent("click", { bubbles: true, cancelable: true });
    a1.dispatchEvent(ev1);
    expect(ev1.defaultPrevented).toBe(true);
    expect(router.state()).toEqual({ page: "users", id: 1 });

    // Click outside the shell — not intercepted.
    const a2 = document.createElement("a");
    a2.setAttribute("href", "/users/2");
    document.body.appendChild(a2);
    const ev2 = new MouseEvent("click", { bubbles: true, cancelable: true });
    a2.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(false);
    expect(router.state()).toEqual({ page: "users", id: 1 });
  });
});
