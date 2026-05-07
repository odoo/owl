# Reference

Everything exported by `@odoo/owl-router`, grouped by responsibility.

## Router core

- [`Router`](router.md): the class holding state and history. Reactive reads
  via `state()` / `url()`, imperative writes via `push` / `replace` /
  `navigate` / `back` / `forward` / `go`.
- [`NavOptions`](router.md#navoptions): per-call options (`sync`, `reload`,
  `skipNotify`, `title`).
- [`RouterOptions`](router.md#routeroptions): constructor options (codec,
  history adapter, reload callback).

## Codec

- [`RouterCodec`](codec.md): state ↔ URL contract.
- [`composeCodec`](codec.md#composecodec): chain a base codec with
  middlewares.
- [`hiddenKeys`](codec.md#hiddenkeys): keep state keys in memory but strip
  them from the URL.
- [`lockedKeys`](codec.md#lockedkeys): preserve state keys across `replace()`
  calls.
- [`getLockedKeys`](codec.md#getlockedkeys): read the locked-key list a
  codec advertises.

## Pattern matching

- [`createMatcher`](matcher.md): compile route patterns like
  `/users/{id:int}` into a `RouterCodec<MatchedRoute>`.
- [`MatchedRoute`](matcher.md#matchedroute): `{ name, params }` shape produced
  by the matcher.

## Plugin

- [`RouterPlugin`](plugin.md): plugin that constructs and owns a `Router`.
- [`useRouter`](plugin.md#userouter): hook returning the router from the
  current plugin manager.

## Components & hooks

- [`Link`](components.md#link): `<a>` that intercepts clicks and
  soft-navigates.
- [`RouteSwitch`](components.md#routeswitch): render one named slot picked by
  a `select` callback.
- [`useLinkInterceptor`](components.md#uselinkinterceptor): listen for clicks
  on internal links anywhere on the page and soft-navigate.

## History adapters

- [`HistoryAdapter`](history.md): the abstraction the router speaks to.
- [`BrowserHistoryAdapter`](history.md#browserhistoryadapter): wraps
  `window.history` plus `popstate` and `pageshow`.
- [`MemoryHistoryAdapter`](history.md#memoryhistoryadapter): in-memory
  history stack for tests and SSR.
