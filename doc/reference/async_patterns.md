# Asynchronous Patterns

Owl gives you three tools for talking to asynchronous data sources:
[`onWillStart`](component.md#willstart),
[`<Suspense>`](suspense.md), and
[`asyncComputed`](reactivity.md#async-computed-values). They overlap in scope
and the distinction is not always obvious. This page exists to make the
choice quick.

## Options at a glance

| Tool            | Blocks first paint?                | Re-runs on dep change?       | Granularity   | Best for                                                      |
| --------------- | ---------------------------------- | ---------------------------- | ------------- | ------------------------------------------------------------- |
| `onWillStart`   | **Yes**, blocks the parent's patch | No (use `onWillUpdateProps`) | Per component | Data the component cannot render without                      |
| `<Suspense>`    | No (renders fallback)              | No                           | Per boundary  | A subtree that should appear all at once                      |
| `asyncComputed` | No (renders with `initial` value)  | **Yes**                      | Per value     | Data that depends on reactive inputs and may change over time |

## When to reach for each

### `onWillStart` — gating

Use when the component **must not render** until some data is available, and
the parent prefers to keep the previous DOM visible until everything is
ready. The classic case: a "view record" page that is meaningless without the
record loaded.

```js
class RecordView extends Component {
  static template = xml`<div t-out="this.record.name"/>`;

  setup() {
    onWillStart(async ({ abortSignal }) => {
      this.record = await fetchRecord(this.props.id, { signal: abortSignal });
    });
  }
}
```

The downside: the **parent's patch is held back** until `onWillStart`
resolves. If the parent has many other things to render, they are all
delayed. Push `onWillStart` into the smallest possible subtree, or wrap it
in `<Suspense>` so the rest of the tree can mount.

For prop-driven re-loads, pair with `onWillUpdateProps`; for both initial
and prop-driven loads with race protection, prefer `asyncComputed`.

### `<Suspense>` — non-blocking gating

Use when the **subtree itself is a unit** ("the dashboard," "the widget")
and you want a single fallback while it loads, but you don't want the load
to hold back the rest of the page.

```xml
<Layout>
  <Suspense>
    <t t-set-slot="fallback">Loading dashboard…</t>
    <Dashboard/>
  </Suspense>
</Layout>
```

`Layout` mounts immediately; the fallback shows; `Dashboard` (and anything
inside it that uses `onWillStart`) loads in the background. When everything
is ready, the fallback is swapped for the real content in one DOM patch.

`<Suspense>` doesn't replace `onWillStart` — it shapes _where_ in the tree
the wait is observable. The descendants still use `onWillStart`. See
[Suspense](suspense.md) for full mechanics.

### `asyncComputed` — reactive fetching

Use when the data **depends on reactive inputs** that can change over time
and you want the fetch to re-run automatically when they do — without
gating any rendering at all.

```js
const userId = signal(1);

const user = asyncComputed(
  async ({ abortSignal }) => {
    const id = userId();
    const res = await fetch(`/api/users/${id}`, { signal: abortSignal });
    return res.json();
  },
  { initial: null }
);
```

Reading `user()` is synchronous. The component renders immediately with the
`initial` value (or the previous value, while a refetch is in flight),
toggles `user.loading()` while a request is pending, and updates when the
new value resolves. When `userId` changes, the in-flight fetch is aborted
and a new one starts.

This is the right tool whenever the data is conceptually a _derived value_:
"the user record, given the current id." Search-as-you-type, master/detail
views, anything with a `select` driving a fetch.

## Decision tree

```
Is the data derived from reactive inputs that change over time?
├─ yes → asyncComputed
└─ no  → Should the parent wait for it before patching?
         ├─ yes → onWillStart
         └─ no  → onWillStart inside <Suspense>
```

## They compose

These tools are not exclusive. A common combination is a `<Suspense>`
boundary containing a component whose first render is gated by
`onWillStart`, with downstream `asyncComputed` values for things that
change reactively:

```js
class UserPage extends Component {
  static template = xml`
    <h1 t-out="this.user.name"/>
    <PostList posts="this.posts()"/>
  `;

  setup() {
    // Block first render until we have the user (Suspense shows fallback).
    onWillStart(async ({ abortSignal }) => {
      this.user = await fetchUser(this.props.id, { signal: abortSignal });
    });

    // Reactive: re-fetches when the filter signal changes.
    this.posts = asyncComputed(
      async ({ abortSignal }) => {
        const filter = this.props.filter();
        return fetchPosts(this.user.id, filter, { signal: abortSignal });
      },
      { initial: [] }
    );
  }
}
```

## Tracking rule for `asyncComputed`

`asyncComputed` tracks reactive reads on the **synchronous prefix** of the
fetcher only — that is, before the first `await`. Reads after an `await` are
not tracked. The idiomatic fix is to split fetching from deriving with a
downstream `computed`. See
[Async Computed Values](reactivity.md#tracking-only-happens-before-the-first-await)
for details.

## Cancellation, errors, and AbortSignal

All three tools share the same cancellation contract:

- The fetcher receives `{ abortSignal }` (see [Scope](scope.md)).
- The signal aborts when the work becomes irrelevant: the component is
  destroyed (`onWillStart`, `asyncComputed`), the props change again
  (`onWillUpdateProps`), or a new run supersedes the old one
  (`asyncComputed` deps changed or `refresh()` called).
- `AbortError` from a deliberately-cancelled run is silently swallowed by
  the framework. Real errors propagate to `onError` (`onWillStart`) or
  `error()` (`asyncComputed`).

This consistency is intentional: any code that takes an `abortSignal` and
forwards it to `fetch` (or guards itself with `abortSignal.throwIfAborted()`
between awaits) works identically across all three.
