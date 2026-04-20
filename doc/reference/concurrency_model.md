# Concurrency Model

This page explains how Owl schedules renders and integrates asynchronous work.
For a higher-level decision guide on **which async tool to reach for**
(`onWillStart`, `<Suspense>`, or `asyncComputed`), see
[Asynchronous Patterns](async_patterns.md).

## Reactive, Component-Granular Updates

Owl 3's reactivity is fine-grained: when a component's template reads a
[signal](reactivity.md#signals), [computed](reactivity.md#computed-values),
or [proxy](reactivity.md#proxy) property, that read creates a subscription on
the component's _render computation_. When the underlying reactive value
changes, only the components that subscribed to it are invalidated — not the
whole subtree, and not their parents.

```js
const count = signal(0);

class Counter extends Component {
  static template = xml`<button t-on-click="() => this.count.set(this.count() + 1)">
    <t t-out="count()"/>
  </button>`;
  count = count;
}

class App extends Component {
  static template = xml`<div><Counter/><ExpensiveSibling/></div>`;
}
```

When the button is clicked, `count` changes. Only `Counter` re-renders.
`ExpensiveSibling` and `App` do not — their templates never read `count`.

This is the main difference from Owl 2 (and from React's default model), where
a state change re-runs the parent's render and walks the tree to diff.

## The Scheduler

When an invalidation marks a component as needing a re-render, the scheduler
queues a fiber for that component. **All queued fibers are flushed once per
animation frame**, via `requestAnimationFrame`. Multiple synchronous writes
to multiple
signals therefore produce a single render per affected component:

```js
count.set(1);
count.set(2);
unrelatedSignal.set("x");
// — one rAF later: Counter renders once, the component reading
//   unrelatedSignal renders once.
```

Within a single frame, work happens in two phases:

1. **Virtual rendering** — each scheduled component renders its template into
   a virtual DOM ("bdom"). New child components are created and their own
   templates rendered, recursively. This phase may be _asynchronous_ if any
   newly created child has an `onWillStart` (see below).
2. **Patching** — once all virtual rendering for a frame is complete, the
   resulting bdom is applied to the real DOM in a single synchronous pass,
   bottom-up.

The split keeps the DOM in a consistent state: callers never see a partially
updated tree.

## Asynchrony: `onWillStart`

A component that needs data before it can render declares it with
[`onWillStart`](component.md#willstart):

```js
setup() {
  onWillStart(async ({ abortSignal }) => {
    this.user = await fetch(`/api/users/${this.props.id}`, { signal: abortSignal });
  });
}
```

`onWillStart` runs once, before the component's first render. **Until it
resolves, the parent's patch is held back** — the user keeps seeing the
previous DOM and the new tree appears all at once when ready. This is what
"concurrent" means in Owl: the previous UI stays interactive while a new
subtree is being prepared.

The trade-off is that a slow `onWillStart` deep in a tree delays the entire
patch above it. For non-blocking alternatives, see
[Asynchronous Patterns](async_patterns.md#options-at-a-glance).

## Render Cancellation

If a new render is scheduled for a component while a previous render of that
component is still in flight (for example, props change again before
`onWillStart` resolves), the older render is cancelled:

- Its fiber is dropped from the scheduler.
- Its scope's `abortSignal` fires, so any `fetch` keyed to it is aborted by
  the browser.
- `await scope.until(...)` calls reject with `AbortError`.
- The newer render takes over from scratch.

This makes it safe to drive renders from rapidly-changing input (search
boxes, sliders, etc.) without worrying about stale results clobbering fresh
ones.

## Two Sources of Re-render

For any given component, two independent things can trigger a re-render:

1. **A reactive read it made changed** (signal, computed, proxy property).
2. **Its props changed** because the parent re-rendered.

Both flow through the same scheduler and end up in the same per-frame batch,
so multiple causes of "this component needs to update" collapse to one render.

## Practical Tips

- Prefer reactivity (`signal`, `computed`) over manually calling `render()`.
  The framework already deduplicates and batches.
- Use `onWillStart` only when you cannot render anything meaningful without
  the data. For "render now, fill in later," use
  [`asyncComputed`](reactivity.md#async-computed-values) or
  [`<Suspense>`](suspense.md) — they don't gate the parent's patch.
- An expensive `onWillStart` near the root delays first paint of the whole
  app. Push it down to the smallest possible subtree, or wrap it in
  `<Suspense>` with a fallback.
- Reactive reads inside `untrack(() => ...)` do not subscribe — useful for
  reads that should not trigger re-renders.
