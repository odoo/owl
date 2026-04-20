# Suspense

`<Suspense>` is a built-in component that renders a fallback while the
components in its default slot are still running their `onWillStart` hooks.
Once all descendant `onWillStart` callbacks resolve, the fallback is swapped
for the real content in a single DOM patch.

## Basic usage

```xml
<Suspense>
  <t t-set-slot="fallback">
    <div>Loading…</div>
  </t>

  <Dashboard/>
</Suspense>
```

- `default` slot: the subtree to load.
- `fallback` slot: what to show while the subtree is loading.

The component class:

```js
import { Suspense } from "@odoo/owl";

class Page extends Component {
  static components = { Suspense, Dashboard };
  static template = xml`
    <Suspense>
      <t t-set-slot="fallback">Loading…</t>
      <Dashboard/>
    </Suspense>
  `;
}
```

## How it works

Internally, `<Suspense>` uses a **sub-root** to render the `default` slot's
content independently of the enclosing tree. The sub-root is driven by
Owl's two-phase mount API (see
[`Root.prepare` / `Root.commit`](./app.md#two-phase-mounting-prepare-and-commit)).

1. `<Suspense>` renders the `fallback` slot into its visible position and
   calls `subroot.prepare()` straight away.
2. `prepare()` starts the sub-root's render phase: the `default` slot is
   evaluated, descendant components are constructed, and their
   `onWillStart` callbacks fire immediately. Descendants' fibers inflate
   the sub-root's counter, **not** the enclosing `MountFiber` — so they do
   not block the parent tree from mounting, and the fallback shows the
   moment the rest of the page does.
3. When all descendant `onWillStart` promises resolve, `prepare()` resolves.
4. Once `<Suspense>` is mounted _and_ the sub-root is prepared, it calls
   `subroot.commit(contentDiv)`. The already-built bdom is mounted
   directly into the content `<div>`, materializing the descendants' DOM
   for the first time **attached at its final position**. Descendant
   `onMounted` hooks fire immediately after, so any layout measurement
   sees the real DOM.

The key consequence: if a `<Suspense>`-wrapped subtree is rendered next to
an async sibling, both load in parallel — the ceiling is the slower of the
two, not their sum.

## Cancellation

Descendants inside `<Suspense>` share the component lifecycle: if
`<Suspense>` (or an ancestor) is destroyed while descendants' `onWillStart`
is pending, those callbacks' `abortSignal` is aborted. This works out of the
box as long as the descendant uses the `abortSignal` it receives from
`onWillStart`, e.g. `fetch(url, { signal: abortSignal })` or
`scope.until(...)`. See [Scope](./scope.md) for details.

## Nested Suspense

Nested `<Suspense>` boundaries work independently. Each has its own
re-render and its own RootFiber counter, so an inner boundary can still be
showing its fallback after the outer boundary has committed.

```xml
<Suspense>
  <t t-set-slot="fallback">Loading page…</t>
  <PageShell>
    <Suspense>
      <t t-set-slot="fallback">Loading widget…</t>
      <AsyncWidget/>
    </Suspense>
  </PageShell>
</Suspense>
```

## Error handling

Errors thrown from a descendant's `onWillStart` follow the usual Owl error
propagation: they walk up the parent chain to the nearest `onError` handler.
`<Suspense>` does not catch or recover from errors itself.

## Limitations

- The fallback briefly shows for a fully synchronous `default` subtree too:
  the shadow host still needs to render, and the commit waits for
  `<Suspense>` itself to mount. In practice, wrap in `<Suspense>` only when
  the subtree actually loads asynchronously.
- An already-committed subtree whose props change and trigger an async
  `onWillUpdateProps` does **not** revert to the fallback. Owl keeps the
  previous DOM mounted until the new render completes — the same "transitions
  off by default" behavior as React.
- Descendants of `<Suspense>` live under an internal shadow node rather
  than directly under the component that used `<Suspense>`. Scope, plugin
  lookups, and error propagation are wired to behave the same as if they
  were direct descendants, but code that walks `ComponentNode.parent`
  directly will find the internal host.
