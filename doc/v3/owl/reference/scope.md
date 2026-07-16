# Scope

## Overview

A `Scope` is the lifetime handle of a component or a plugin. Every component
and every plugin manager owns exactly one scope, created when it is
instantiated and destroyed when it dies.

Scopes serve three purposes:

- **Attachment point for hooks.** When you call `onWillStart`, `onWillDestroy`,
  `usePlugin()`, etc., they find their owner by looking at the currently active
  scope on the scope stack.
- **Single source of truth for liveness.** `scope.status` is the authoritative
  answer to "is this component/plugin still alive?" (`NEW`, `MOUNTED`, or
  `DESTROYED`).
- **Async cancellation.** Every scope exposes an `AbortSignal` that is
  automatically aborted when the scope dies. Async work keyed to that signal
  stops naturally when the component is destroyed.

> **Note on terminology.** Owl uses the word _signal_ elsewhere for the
> reactive primitive (`signal(0)`, `Signal<T>`). To avoid shadowing, the
> cancellation handle on a scope is always called `abortSignal` in Owl's
> API — the accessor is `scope.abortSignal` and the hook argument is
> `{ abortSignal }`. The underlying type is still the standard
> [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).

You rarely need to construct a scope yourself — components and plugins do it
for you. You do, however, often want to _read_ from the active scope, either
to get its abort signal for async cancellation, or to capture it and run code
inside it later.

## Accessing the Current Scope

The `useScope()` hook returns the scope that is currently on top of the stack.
During a component's `setup()` method, or a plugin's `setup()`, the active
scope is that component's or plugin's scope:

```js
import { Component, useScope, xml } from "@odoo/owl";

class MyComponent extends Component {
  static template = xml`<div/>`;

  setup() {
    const scope = useScope();
    // scope.status === STATUS.NEW at this point
    // scope.abortSignal — lazily-allocated AbortSignal tied to this component
  }
}
```

Outside of any setup, `useScope()` throws `"No active scope"`. Use `getScope()`
if you need to tolerate that case — it returns `Scope | null`.

## Lifetime and Status

A scope's `status` transitions through three values, defined by the `STATUS`
enum:

| Status      | Meaning                                            |
| ----------- | -------------------------------------------------- |
| `NEW`       | just created, not yet mounted                      |
| `MOUNTED`   | fully alive (for a component: attached to the DOM) |
| `DESTROYED` | fully destroyed, all cleanup has run               |

A component that is abandoned before being mounted (e.g. replaced by a newer
rendering) transitions directly from `NEW` to `DESTROYED`. Any transition into
`DESTROYED` aborts the scope's abort signal (see below).

The `scope.isDestroyed()` method answers the question "is this scope dead?" —
it returns `true` once all cleanup (destroy callbacks, computation disposal)
has run.

The `status()` helper function (which takes a `Component` or `Plugin` instance
directly) is a more convenient frontend for reading a scope's status:

```js
import { Component, status } from "@odoo/owl";

class MyComponent extends Component {
  // ...
  someMethod() {
    if (status(this) === "mounted") {
      // do mounted-only work
    }
  }
}
```

## Async Cancellation

The most practical use of a scope is to cancel async work when a component or
plugin is destroyed. Every scope exposes an `AbortSignal` via
`scope.abortSignal` that is tied to the scope's lifetime.

### The scope argument in `onWillStart`

`onWillStart` receives the current scope as its argument. In most cases you
only want the scope's `abortSignal`, and you can destructure it directly off
the scope — forwarding it to any async API that accepts an `AbortSignal`,
most notably `fetch`:

```js
class UserProfile extends Component {
  static template = xml`<div t-out="this.user?.name"/>`;

  setup() {
    onWillStart(async ({ abortSignal }) => {
      const response = await fetch("/api/user", { signal: abortSignal });
      this.user = await response.json();
    });
  }
}
```

If the component is destroyed while the `fetch` is in flight, the abort signal
fires, the `fetch` is cancelled by the browser, and the `await` throws an
`AbortError`. The hook runner catches it silently — there's no need to handle
it yourself.

You can also name the parameter to access the full scope — e.g. to call
`scope.run(fn)`, covered below. The same pattern applies to any async work
attached to a scope, including the fetcher passed to
[`asyncComputed`](computed_values.md#async-computed-values).

### Cancelling between awaits

When an async operation doesn't accept an `AbortSignal`, you can still cancel
the chain between awaits. Two options:

**Option 1 — `abortSignal.throwIfAborted()`**, using the native `AbortSignal`
method:

```js
onWillStart(async ({ abortSignal }) => {
  const rec = await loadRecord(id);
  abortSignal.throwIfAborted();
  const extra = await loadExtras(rec.id);
  abortSignal.throwIfAborted();
  this.data = { ...rec, ...extra };
});
```

**Option 2 — `scope.run(fn)`**, a method on the scope that runs `fn` in the
scope and, when `fn` returns a promise, guards the await so it rejects with
`AbortError` if the scope dies while awaiting:

```js
onWillStart(async (scope) => {
  const rec = await scope.run(() => loadRecord(id));
  const extra = await scope.run(() => loadExtras(rec.id));
  this.data = { ...rec, ...extra };
});
```

The guard uses status checks and does **not** allocate an `AbortController`,
so using it never forces a controller to exist if nothing else has asked for
the abort signal. See [Running Code in a Captured Scope](#running-code-in-a-captured-scope)
for the full behavior of `scope.run` (argument forwarding, the up-front throw
on a dead scope, and synchronous callbacks).

If you need the same pattern against an `AbortSignal` that doesn't come from
a scope (e.g. `AbortSignal.timeout(5000)`), `signal.throwIfAborted()` between
awaits is the idiomatic way to do it — a few lines of plain code and no
imports.

### Why throwing, not hanging

Aborted promises reject with `AbortError` rather than hanging forever. This
matches the web platform (`fetch`, `AbortSignal.throwIfAborted`, etc.) and
means:

- `finally` blocks run, so resources you acquired are released;
- the promise chain settles and is garbage-collected normally;
- you see `AbortError` in DevTools rather than a silently-stopped coroutine.

The `onWillStart` hook runner catches `AbortError` silently when the scope
is dead — nothing reaches `onError`. If you want to handle the abort
explicitly, wrap the body in `try/catch` and check
`err.name === "AbortError"`.

## Running Code in a Captured Scope

Some patterns need to defer work and then run it "as if we were still in the
component's setup." Capture the scope with `useScope()`, then call
`scope.run(fn)` later:

```js
class Form extends Component {
  static template = xml`<div/>`;

  setup() {
    const scope = useScope();
    window.debugAttach = () => {
      scope.run(() => {
        // code executed here can call hooks, usePlugin(), etc.,
        // just like during the original setup
      });
    };
  }
}
```

`scope.run(fn, ...args)` pushes the scope on the stack, invokes `fn` with any
extra arguments you pass, then pops the scope on return (even if the callback
throws). It returns whatever `fn` returns.

**Extra arguments** are forwarded straight through, so you can reuse a single
function without wrapping it in a closure:

```js
scope.run(loadRecord, id); // same as scope.run(() => loadRecord(id))
```

**Dead-scope guard (up front).** If the scope is already dead
(`status > MOUNTED`) when you call `scope.run`, it throws an `OwlError`
_before_ invoking `fn` — scheduling work in a destroyed scope is a
programming error. This is deliberately **not** an `AbortError`: an
`AbortError` signals the normal async-cancellation workflow (see below),
whereas the `OwlError` flags a bug.

**Async guard (across the await).** If `fn` returns a promise, `scope.run`
wraps it so the returned promise rejects with an `AbortError` if the scope
dies while the promise is in flight. This is the [cancelling-between-awaits](#cancelling-between-awaits)
pattern above. For a synchronous callback there is no await to guard, so the
scope is only on the stack for the duration of the synchronous body — it is
_not_ kept "live" across a later `await`. If you need to run several async
chunks with a live scope, make each chunk its own `scope.run` call.

## Cleanup Callbacks

Use `onWillDestroy` (or `scope.onDestroy` on a captured scope) to register
cleanup code. Callbacks run in reverse registration order, _before_ the scope
transitions to `DESTROYED`, so they can still observe the pre-destroyed state:

```js
setup() {
  const socket = new WebSocket(url);
  onWillDestroy(() => socket.close());
}
```

For ad-hoc cleanup on a captured scope:

```js
const scope = useScope();
scope.onDestroy(() => {
  // cleanup
});
```

Errors thrown from an `onDestroy` callback are routed to the component's error
handler (for `ComponentScope`) or logged (for `PluginScope`); they don't
interrupt the destruction of sibling callbacks or the scope itself.

## API Summary

### `useScope(): Scope`

Returns the scope currently on top of the stack. Throws `"No active scope"`
if there is none — the intended form for hooks that must be called inside a
component's or plugin's `setup()`.

### `getScope(): Scope | null`

Returns the scope currently on top of the stack, or `null` if no scope is
active. Reach for this only when the absence of a scope is meaningful.

### `Scope`

- `status: STATUS` — current status (`NEW` / `MOUNTED` / `DESTROYED`).
- `app: App` — the owning application.
- `parent: Scope | null` — parent scope in the tree.
- `abortSignal: AbortSignal` — an `AbortSignal` aborted when the scope dies.
  Lazily allocates an `AbortController` on first access.
- `isDestroyed(): boolean` — true once the scope is destroyed (all cleanup
  has run).
- `onDestroy(cb: () => void): void` — registers a destroy callback. If the
  scope is already destroyed, calls the callback immediately.
- `run<Args, T>(fn: (...args: Args) => T, ...args: Args): T` — pushes the
  scope for the duration of `fn`, forwarding any extra arguments to it.
  Throws an `OwlError` up front if the scope is already dead. If `fn` returns
  a promise, guards the await so it rejects with `AbortError` should the scope
  die in flight. Does not allocate a controller.
