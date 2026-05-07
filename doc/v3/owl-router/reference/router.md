# Router

The `Router` class is the heart of the package. It owns two signals — the
current state and the current URL — and exposes imperative methods to mutate
them while keeping browser history in sync.

You rarely instantiate `Router` directly. Instead, register
[`RouterPlugin`](plugin.md) and read the router with `useRouter()`. The class
is documented here because the instance you receive is shaped exactly like
this.

## Reactive reads

```ts
class Router<TState> {
  state(): TState;
  url(): URL;
}
```

Both methods are signals — calling them inside a `computed`, `effect`, or
component template registers the caller as a subscriber. Subscribers re-run
on the next microtask whenever the state or URL changes.

```js
import { effect } from "@odoo/owl";

effect(() => {
  console.log("now at", router.state());
});
```

```js
class Title extends Component {
  static template = xml`<h1 t-out="this.heading()"/>`;

  router = useRouter();
  heading = computed(() => `Welcome to ${this.router.state().name}`);
}
```

## Navigation methods

```ts
class Router<TState> {
  push(state: Partial<TState>, options?: NavOptions): void;
  replace(state: Partial<TState>, options?: NavOptions): void;
  navigate(url: string | URL, options?: NavOptions & { replace?: boolean }): void;
  back(): void;
  forward(): void;
  go(n: number): void;
}
```

- **`push(state)`** — adds a new history entry. The partial `state` is
  merged onto the previous state; previous keys not in the partial survive.
- **`replace(state)`** — replaces the current history entry. The partial is
  merged onto a base of [locked keys](codec.md#lockedkeys) from the previous
  state; non-locked previous keys are discarded.
- **`navigate(url)`** — fully replaces the state with what the codec decodes
  from `url`. Does **not** merge with the previous state. Useful for internal
  link clicks (the URL is the canonical truth). Pass `{ replace: true }` to
  use `replaceState` instead of `pushState`.
- **`back()`, `forward()`, `go(n)`** — call through to the underlying
  `HistoryAdapter`.

### Coalescing

Multiple `push` and `replace` calls in the same tick coalesce into a single
history entry, matching the existing odoo router's behavior. The merged
state is the partials applied left-to-right; once any caller in the batch
asks for `replace`, the flush is a replace.

```js
router.push({ tab: "details" });
router.push({ scrollY: 320 });
// → one history entry, state = { ...previous, tab: "details", scrollY: 320 }
```

To opt out for a single call, pass `{ sync: true }`:

```js
router.push({ debug: 1 }, { sync: true }); // flushes immediately
```

`navigate()` is always synchronous and cancels any pending coalesced flush.

### Other utilities

```ts
class Router<TState> {
  cancelPending(): void; // drop the buffered push without applying it
  dispose(): void; // unsubscribe from history events, stop accepting writes
}
```

`dispose()` is called automatically by `RouterPlugin` on destroy. After
disposal, all writes become no-ops and the popstate / pageshow listeners
are removed.

## NavOptions

```ts
interface NavOptions {
  sync?: boolean; // bypass coalescing for this call
  reload?: boolean; // call the configured reload callback after pushing
  skipNotify?: boolean; // update history but don't fire reactive subscribers
  title?: string; // title for the resulting history entry
}
```

`skipNotify` is useful for "trap" history entries — patterns where you want
to push to the browser's history without triggering app-level navigation
logic. The state and URL signals stay at their previous values; only
`history.state` advances.

`title` is best-effort: most browsers ignore the title argument of
`pushState` but display the document title that was active at push time.
The browser adapter sets the document title transiently while pushing, then
restores it.

## RouterOptions

```ts
interface RouterOptions<TState> {
  codec: RouterCodec<TState>;
  history?: HistoryAdapter; // defaults to BrowserHistoryAdapter
  reload?: () => void; // defaults to window.location.reload()
}
```

When using `RouterPlugin`, these are read from the plugin manager's config:

```js
providePlugins([RouterPlugin], {
  codec: myCodec,
  history: new MemoryHistoryAdapter(),
  reload: () => myCustomReload(),
});
```
