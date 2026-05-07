import { describe, expect, test, vi } from "vitest";
import { BrowserHistoryAdapter, MemoryHistoryAdapter } from "../src/history";

describe("MemoryHistoryAdapter", () => {
  test("starts at the initial URL with the initial state", () => {
    const h = new MemoryHistoryAdapter({ initialUrl: "http://x/y", initialState: { a: 1 } });
    expect(h.url().href).toBe("http://x/y");
    expect(h.currentState()).toEqual({ a: 1 });
  });

  test("default initial URL when none is given", () => {
    const h = new MemoryHistoryAdapter();
    expect(h.url().href).toBe("http://localhost/");
    expect(h.currentState()).toBe(null);
  });

  test("push records a new entry without firing popstate", () => {
    const h = new MemoryHistoryAdapter();
    const popSpy = vi.fn();
    h.onPopState(popSpy);
    h.push(new URL("http://localhost/a"), { v: 1 });
    expect(h.url().href).toBe("http://localhost/a");
    expect(h.currentState()).toEqual({ v: 1 });
    expect(popSpy).not.toHaveBeenCalled();
  });

  test("replace overwrites the current entry", () => {
    const h = new MemoryHistoryAdapter();
    h.push(new URL("http://localhost/a"), { v: 1 });
    h.replace(new URL("http://localhost/a2"), { v: 2 });
    expect(h.url().href).toBe("http://localhost/a2");
    expect(h.currentState()).toEqual({ v: 2 });
    h.back();
    expect(h.url().href).toBe("http://localhost/");
  });

  test("back/forward fire popstate with the entry's state", () => {
    const h = new MemoryHistoryAdapter();
    h.push(new URL("http://localhost/a"), { v: 1 });
    h.push(new URL("http://localhost/b"), { v: 2 });
    const popSpy = vi.fn();
    h.onPopState(popSpy);
    h.back();
    expect(h.url().href).toBe("http://localhost/a");
    expect(popSpy).toHaveBeenCalledWith({ v: 1 });
    h.forward();
    expect(h.url().href).toBe("http://localhost/b");
    expect(popSpy).toHaveBeenLastCalledWith({ v: 2 });
  });

  test("push after back drops the forward stack", () => {
    const h = new MemoryHistoryAdapter();
    h.push(new URL("http://localhost/a"), null);
    h.push(new URL("http://localhost/b"), null);
    h.back();
    h.push(new URL("http://localhost/c"), null);
    h.forward(); // would have been /b — now nothing past /c
    expect(h.url().href).toBe("http://localhost/c");
  });

  test("go(0) is a no-op", () => {
    const h = new MemoryHistoryAdapter();
    h.push(new URL("http://localhost/a"), null);
    const popSpy = vi.fn();
    h.onPopState(popSpy);
    h.go(0);
    expect(popSpy).not.toHaveBeenCalled();
  });

  test("popstate unsubscribe stops the handler", () => {
    const h = new MemoryHistoryAdapter();
    h.push(new URL("http://localhost/a"), null);
    const popSpy = vi.fn();
    const unsubscribe = h.onPopState(popSpy);
    unsubscribe();
    h.back();
    expect(popSpy).not.toHaveBeenCalled();
  });

  test("emitPageShow notifies subscribers", () => {
    const h = new MemoryHistoryAdapter();
    const showSpy = vi.fn();
    h.onPageShow(showSpy);
    h.emitPageShow(true);
    expect(showSpy).toHaveBeenCalledWith(true);
  });
});

describe("BrowserHistoryAdapter", () => {
  test("reads window.location", () => {
    const h = new BrowserHistoryAdapter();
    window.history.replaceState(null, "", "/start");
    expect(h.url().pathname).toBe("/start");
  });

  test("push and replace go through window.history", () => {
    const h = new BrowserHistoryAdapter();
    window.history.replaceState(null, "", "/start");
    h.push(new URL("http://localhost/pushed"), { p: 1 });
    expect(window.location.pathname).toBe("/pushed");
    expect(window.history.state).toEqual({ p: 1 });
    h.replace(new URL("http://localhost/replaced"), { r: 1 });
    expect(window.location.pathname).toBe("/replaced");
    expect(window.history.state).toEqual({ r: 1 });
  });

  test("title argument is restored after push", () => {
    const h = new BrowserHistoryAdapter();
    document.title = "Outside";
    h.push(new URL("http://localhost/p"), null, "Inside");
    expect(document.title).toBe("Outside");
  });

  test("popstate subscription receives state", async () => {
    const h = new BrowserHistoryAdapter();
    const spy = vi.fn();
    const unsubscribe = h.onPopState(spy);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { x: 42 } }));
    expect(spy).toHaveBeenCalledWith({ x: 42 });
    unsubscribe();
    window.dispatchEvent(new PopStateEvent("popstate", { state: { x: 99 } }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("pageshow subscription forwards persisted flag", () => {
    const h = new BrowserHistoryAdapter();
    const spy = vi.fn();
    const unsubscribe = h.onPageShow(spy);
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    expect(spy).toHaveBeenCalledWith(true);
    unsubscribe();
  });
});
