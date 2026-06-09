# Computed Values

A computed value is a lazily-evaluated derived value. It tracks its dependencies
automatically and only recomputes when accessed and at least one dependency has
changed:

```js
const s1 = signal(3);
const s2 = signal(5);
const d1 = computed(() => 2 * s1());
const d2 = computed(() => d1() + s2());

d1(); // evaluates the function, returns 6
d2(); // evaluates d2, does not reevaluate d1, returns 11
d2(); // returns cached result immediately
s2.set(6);
d2(); // evaluates d2, does not reevaluate d1, returns 12
```

Dependency tracking is dynamic: only the values read during the **last**
evaluation are tracked. If a branch is not taken, the values it would have
read are not subscribed to.

A computed value is read-only by default: calling `.set()` throws an
`OwlError`. To make it writable, provide a `set` option (see below).

Computed values build on [signals](signals.md) and other reactive reads. See
[Reactivity](reactivity.md) for the bigger picture.

## Writable Computed

It is possible to provide a custom `set` function to make a computed value
writable:

```js
const s = signal(3);
const triple = computed(() => 3 * s(), {
  set: (value) => s.set(value / 3),
});

triple(); // returns 9
triple.set(6); // sets s to 2
s(); // returns 2
triple(); // returns 6
```

## Async Computed Values

> **Experimental.** `asyncComputed` is still shaking out; the exact API
> (option names, method surface, cancellation semantics) is subject to
> change in future versions. Use with that caveat in mind.

An `asyncComputed` is the asynchronous counterpart to `computed`. It runs a
fetcher that returns a `Promise`, exposes the resolved value as a reactive
read, and re-runs the fetcher whenever any of its tracked dependencies change:

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

user(); // current value (initial → resolved → next resolved)
user.loading(); // reactive boolean: true while a run is in flight
user.error(); // reactive Error | null
user.refresh(); // re-run the fetcher even if nothing changed
user.dispose(); // tear down (auto-called when the surrounding scope dies)
```

The `abortSignal` argument follows the same convention as
[`onWillStart`](scope.md#async-cancellation): it fires when the run is
superseded (deps changed, or `refresh()` called), or when the surrounding
[scope](scope.md) is destroyed. Any `fetch` keyed to it is cancelled
automatically; the resulting `AbortError` is silently dropped.

While a fetch is in flight, the previous resolved value remains visible via
`user()` — branch on `user.loading()` if you want a different visual.

When created inside a component or a plugin's `setup`, `asyncComputed` cleans
up automatically on destroy. Outside any scope, you must call `.dispose()`
yourself.

### Tracking only happens before the first `await`

Like every reactive system that supports async derivations, dependency
tracking captures only the reads that happen on the **synchronous** path of
the fetcher — that is, before the first `await`. Reads after an `await` are
not tracked, because by the time the continuation runs, the reactive context
is no longer active:

```js
// `filter` is read after `await` — changes to it will not re-run the fetcher
const results = asyncComputed(async ({ abortSignal }) => {
  const id = userId();
  const res = await fetch(`/api/users/${id}`, { signal: abortSignal });
  const filter = search();
  return (await res.json()).filter((u) => u.name.includes(filter));
});
```

The idiomatic fix is to split fetching from deriving: use `asyncComputed` for
the fetch, and a regular `computed` for any further transformation that
depends on synchronous reactive state:

```js
// asyncComputed for fetching, computed for deriving
const data = asyncComputed(async ({ abortSignal }) => {
  const id = userId();
  const res = await fetch(`/api/users/${id}`, { signal: abortSignal });
  return res.json();
});

const results = computed(() => {
  const filter = search();
  return (data() ?? []).filter((u) => u.name.includes(filter));
});
```

This split is also a free performance win: changing `search` re-runs the
filter without triggering a network request.

### Errors

Errors thrown by the fetcher (sync or async) populate `error()` and clear
`loading()`. The next successful run clears the error. `AbortError` is treated
as a cancellation, not a real error — it never reaches `error()`.

### No `.set` (read-only)

Unlike `computed`, `asyncComputed` has no `set` option. Asynchronous writes
(PUT/POST against an API) are conceptually a different operation and are best
modelled with a plain async function rather than wrapped behind a reactive
read.
