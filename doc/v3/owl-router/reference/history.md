# History adapters

The router never talks to `window.history` directly. It speaks to a
`HistoryAdapter`, which is the only piece of the package that knows about
the browser. Two adapters ship out of the box; you can write your own for
SSR, custom hosts, or test scenarios that need precise control.

## HistoryAdapter

```ts
interface HistoryAdapter {
  url(): URL;
  push(url: URL, state: unknown, title?: string): void;
  replace(url: URL, state: unknown, title?: string): void;
  currentState(): unknown;
  back(): void;
  forward(): void;
  go(n: number): void;
  onPopState(handler: (state: unknown) => void): () => void;
  onPageShow(handler: (persisted: boolean) => void): () => void;
}
```

Both subscription methods return an unsubscribe function. The router calls
them at construction time and stores the disposers; on `dispose()` they're
all called.

`onPageShow` corresponds to the browser `pageshow` event. The router uses
`persisted: true` (a bfcache restore) to re-decode the URL into state — the
old odoo router did the same thing because Odoo's web client was not
designed for bfcache and needed a forced state refresh. Other implementations
can ignore the event.

## BrowserHistoryAdapter

```ts
class BrowserHistoryAdapter implements HistoryAdapter {}
```

The default. Wraps `window.history.pushState`, `replaceState`, `back`,
`forward`, `go`, and listens to `popstate` and `pageshow` on `window`.

`push()` and `replace()` accept a `title` argument: most browsers ignore the
title parameter of `pushState`, but they do display the document title
that was active _at push time_ as the entry's label. The adapter sets
`document.title` transiently while pushing, then restores it. This matches
the existing odoo router and makes the back/forward menu show the right
label per entry.

## MemoryHistoryAdapter

```ts
class MemoryHistoryAdapter implements HistoryAdapter {
  constructor(options?: { initialUrl?: string | URL; initialState?: unknown });
  emitPageShow(persisted: boolean): void; // test-only helper
}
```

In-memory history stack with the same surface area as the browser adapter.
Good for tests and SSR — nothing touches `window`.

```js
import { MemoryHistoryAdapter, RouterPlugin } from "@odoo/owl-router";

const history = new MemoryHistoryAdapter({
  initialUrl: "/users/42",
});

await mount(App, fixture, {
  plugins: [RouterPlugin],
  config: { codec, history },
});
```

`back()` / `forward()` / `go(n)` notify popstate listeners synchronously,
which makes assertions in tests straightforward:

```js
router.push({ name: "user", params: { id: 1 } }, { sync: true });
router.push({ name: "user", params: { id: 2 } }, { sync: true });
history.back();
expect(router.state().params.id).toBe(1);
```

`emitPageShow(persisted)` is a test-only helper: there is no real `pageshow`
event in a unit test, so the adapter exposes a way to trigger one. Useful
to assert bfcache restore behaviour.

## Writing a custom adapter

The interface is small enough that custom implementations are
straightforward. A minimal example wrapping a custom embedded environment
(e.g. an in-app webview):

```js
class WebviewHistoryAdapter {
  constructor(api) {
    this.api = api;
    this.popHandlers = [];
    this.showHandlers = [];
    api.on("navigate", (state) => this.popHandlers.forEach((h) => h(state)));
  }

  url() {
    return new URL(this.api.currentUrl());
  }
  push(url, state) {
    this.api.push(url.href, state);
  }
  replace(url, state) {
    this.api.replace(url.href, state);
  }
  currentState() {
    return this.api.currentState();
  }
  back() {
    this.api.back();
  }
  forward() {
    this.api.forward();
  }
  go(n) {
    this.api.go(n);
  }
  onPopState(h) {
    this.popHandlers.push(h);
    return () => this.popHandlers.splice(this.popHandlers.indexOf(h), 1);
  }
  onPageShow(h) {
    this.showHandlers.push(h);
    return () => this.showHandlers.splice(this.showHandlers.indexOf(h), 1);
  }
}
```

Pass it to the router via `RouterPlugin` config:

```js
providePlugins([RouterPlugin], { codec, history: new WebviewHistoryAdapter(webviewApi) });
```
