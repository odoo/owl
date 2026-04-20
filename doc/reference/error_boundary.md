# ErrorBoundary

`<ErrorBoundary>` is a built-in component that catches errors thrown by
its descendants during render, lifecycle hooks (including `onWillStart`),
or event handlers, and renders a `fallback` slot in their place. It's the
declarative counterpart of the [`onError`](hooks.md#onerror) hook.

## Basic usage

```xml
<ErrorBoundary>
  <t t-set-slot="fallback">Something went wrong.</t>
  <UnstableWidget/>
</ErrorBoundary>
```

- `default` slot: the subtree to guard.
- `fallback` slot: what to render when the subtree throws.

When a descendant throws, the `fallback` replaces the default slot in
the same DOM position.

## Fallback slot scope

The fallback slot receives the caught `error` and a `retry` function as
slot-scope values:

```xml
<ErrorBoundary>
  <t t-set-slot="fallback" t-slot-scope="ctx">
    <p>Error: <t t-out="ctx.error.message"/></p>
    <button t-on-click="ctx.retry">retry</button>
  </t>
  <UnstableWidget/>
</ErrorBoundary>
```

Calling `retry()` clears the error and re-renders the default slot. The
descendant subtree is reconstructed from scratch — if the underlying
cause hasn't been fixed, the error will fire again and the fallback will
reappear.

## How it works

ErrorBoundary is a thin wrapper around `onError`: the handler sets an
`error` signal; a `t-if` in the template switches between the `default`
and `fallback` slots. No sub-roots, no DOM overhead.

## Propagation

Nested `ErrorBoundary` instances form a chain. The nearest ancestor
catches — an `onError` hook higher up the tree only fires if every
intervening `ErrorBoundary` handler throws or is absent. Errors thrown
during the fallback's own render are outside the handling boundary and
propagate past; a second outer boundary can catch them.

## Class

```js
import { ErrorBoundary } from "@odoo/owl";
```

Exposed fields, for code that needs programmatic access via
`t-ref`/`useRef`:

- `error(): any` — the currently caught error, or `null` if none.
- `retry(): void` — clear the error and re-render the default slot.
