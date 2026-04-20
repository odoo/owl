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
[`Root.prepare` / `Root.mount`](./app.md#two-phase-mounting-prepare-and-mount)).

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
   `subroot.mount(parent, { afterNode })`, where `parent` and `afterNode`
   are read off the fallback's first DOM node (via `bdom.firstNode()`).
   The sub-root's content is inserted immediately before the fallback.
   `<Suspense>` then flips `committed` to true, Owl's diff replaces the
   fallback with an anchor text node, and the final DOM order is
   `[sub-root content, anchor]` — right at `<Suspense>`'s position, with
   no wrapper element. Descendant `onMounted` hooks fire immediately
   after, so any layout measurement sees the real DOM.

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

- A fully synchronous `default` subtree no longer flashes the fallback:
  Suspense detects that the sub-root finished its render phase during
  `setup()` and skips the fallback on the very first render. Wrapping a
  sync subtree in `<Suspense>` is therefore harmless, just unnecessary.
- An already-committed subtree whose props change and trigger an async
  `onWillUpdateProps` does **not** revert to the fallback. Owl keeps the
  previous DOM mounted until the new render completes — the same "transitions
  off by default" behavior as React.
- Descendants of `<Suspense>` live under the internal sub-root rather
  than directly under the component that used `<Suspense>`. Scope, plugin
  lookups, and error propagation are wired to behave the same as if they
  were direct descendants, but code that walks `ComponentNode.parent`
  directly will find the internal sub-root.
