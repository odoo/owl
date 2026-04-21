# ErrorBoundary

`<ErrorBoundary>` is a built-in component that catches errors thrown by
its descendants during render, lifecycle hooks (including `onWillStart`),
or event handlers, and renders a `fallback` slot in their place. It's the
declarative counterpart of the [`onError`](error_handling.md) hook.

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

## Accessing the error: the `error` prop

ErrorBoundary accepts an optional `error` prop — a
[`Signal`](reactivity.md#signals) that the boundary writes to when a
descendant throws. The parent owns the signal, so it can read the error
from inside the fallback, react to changes with an `effect`, or clear
the error to retry:

```js
import { ErrorBoundary, signal, effect } from "@odoo/owl";

class Parent extends Component {
  static template = xml`
    <ErrorBoundary error="this.error">
      <t t-set-slot="fallback">
        <p>Error: <t t-out="this.error()?.message"/></p>
        <button t-on-click="() => this.error.set(null)">retry</button>
      </t>
      <UnstableWidget/>
    </ErrorBoundary>`;
  static components = { ErrorBoundary };

  error = signal(null);

  setup() {
    // React to errors without coupling the fallback template to it.
    effect(() => {
      const e = this.error();
      if (e) console.error("widget failed:", e);
    });
  }
}
```

Setting the signal back to `null` clears the error and re-renders the
default slot. The descendant subtree is reconstructed from scratch — if
the underlying cause hasn't been fixed, the error will fire again and
the fallback will reappear.

If you don't pass an `error` prop, ErrorBoundary creates its own internal
signal. The fallback still renders on errors, but your code has no handle
on the error value or on clearing it (short of grabbing a `t-ref` to the
component and reaching into `.error`).

## How it works

ErrorBoundary is a thin wrapper around `onError`: the handler writes to
the `error` signal; a `t-if` in the template switches between the
`default` and `fallback` slots. No sub-roots, no DOM overhead.

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

Props:

- `error?: Signal<any>` — optional external signal the boundary writes
  the caught error to. If omitted, ErrorBoundary creates its own.

Exposed fields, for code that needs programmatic access via
`t-ref`/`useRef`:

- `error: Signal<any>` — the signal holding the currently caught error
  (the prop if provided, otherwise the internal one). Read with
  `error()`, reset with `error.set(null)`.
