# Scope

## Overview

Every component and every [plugin](plugins.md) owns a `Scope`: an object that
represents its lifetime. The scope is created when the component or plugin is
instantiated and destroyed when it dies. You never construct a scope yourself
— Owl does it for you — but you often want to _read_ from it, mostly to cancel
asynchronous work when its owner is destroyed:

```js
import { Component, onWillStart, xml } from "@odoo/owl";

class UserProfile extends Component {
  static template = xml`<div t-out="this.user?.name"/>`;

  setup() {
    // lifecycle hooks receive the component's scope as their argument
    onWillStart(async ({ abortSignal }) => {
      const response = await fetch("/api/user", { signal: abortSignal });
      this.user = await response.json();
    });
  }
}
```

If the component is destroyed while the `fetch` is in flight, the scope's
abort signal fires, the browser cancels the request, and the hook stops with
an `AbortError` (caught silently by Owl). Nothing is written to a dead
component, and there is nothing to clean up manually.

More generally, scopes serve three purposes:

- **Attachment point for hooks.** When you call `onWillStart`,
  `onWillDestroy`, `plugin()`, etc., they find their owner by looking at the
  currently active scope (the scope on top of the scope stack).
- **Single source of truth for liveness.** `scope.status` is the
  authoritative answer to "is this component/plugin still alive?"
- **Async cancellation.** Every scope exposes an `AbortSignal` that is
  automatically aborted when the scope dies, so async work keyed to it stops
  naturally.

The complete API is described in the [API Reference](#api-reference) below.

> **Note on terminology.** Owl uses the word _signal_ elsewhere for the
> reactive primitive (`signal(0)`, `Signal<T>`). To avoid shadowing, the
> cancellation handle on a scope is always called `abortSignal` in Owl's
> API — the accessor is `scope.abortSignal` and the hook argument is
> `{ abortSignal }`. The underlying type is still the standard
> [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).

## Lifetime and Status

A scope's `status` transitions through four values:

| Status      | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| `NEW`       | just created, not yet mounted                                       |
| `MOUNTED`   | fully alive (for a component: attached to the DOM)                  |
| `CANCELLED` | abandoned before being mounted (e.g. replaced by a newer rendering) |
| `DESTROYED` | fully destroyed, all cleanup has run                                |

A scope is considered **dead** once it is `CANCELLED` or `DESTROYED`; both
transitions abort its abort signal. There is no way back: a dead scope never
becomes alive again.

In application code, the most convenient way to check liveness is the
[`status()`](#statusentity) helper, which takes a `Component` or `Plugin`
instance directly and returns a human-readable string:

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

## Accessing the Current Scope

Owl maintains a stack of active scopes. During a component's or a plugin's
`setup()`, the active scope is that component's or plugin's scope, and the
[`useScope()`](#usescope) hook returns it:

```js
import { Component, useScope, xml } from "@odoo/owl";

class MyComponent extends Component {
  static template = xml`<div/>`;

  setup() {
    const scope = useScope();
  }
}
```

Outside of any setup, `useScope()` throws `"No active scope"`. Use
[`getScope()`](#getscope) if you need to tolerate that case — it returns
`Scope | null`.

Every lifecycle hook (`onWillStart`, `onMounted`, ...) also receives the scope
it was registered in as its argument, so hook callbacks don't need to capture
it beforehand.

## Async Cancellation

The most practical use of a scope is to cancel async work when a component or
plugin is destroyed. Every scope exposes an `AbortSignal` via
[`scope.abortSignal`](#scopeabortsignal) that is tied to the scope's
lifetime.

### The scope argument in lifecycle hooks

`onWillStart` receives the current scope as its argument. In most cases you
only want the scope's `abortSignal`, and you can destructure it directly off
the scope — forwarding it to any async API that accepts an `AbortSignal`,
most notably `fetch`:

```js
onWillStart(async ({ abortSignal }) => {
  const response = await fetch("/api/user", { signal: abortSignal });
  this.user = await response.json();
});
```

If the component is destroyed while the `fetch` is in flight, the abort signal
fires, the `fetch` is cancelled by the browser, and the `await` throws an
`AbortError`. The hook runner catches it silently — there's no need to handle
it yourself.

You can also name the parameter to access the full scope — e.g. to call
`scope.until(p)`, covered below. The same pattern applies to any async work
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

**Option 2 — [`scope.until(promise)`](#scopeuntilpromise)**, a method on the
scope that wraps a promise so it rejects with `AbortError` if the scope is
dead before or after the await:

```js
onWillStart(async (scope) => {
  const rec = await scope.until(loadRecord(id));
  const extra = await scope.until(loadExtras(rec.id));
  this.data = { ...rec, ...extra };
});
```

`scope.until` uses status checks and does **not** allocate an
`AbortController`, so using it never forces a controller to exist if nothing
else has asked for the abort signal.

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
[`scope.run(fn)`](#scoperuncallback) later:

```js
class Form extends Component {
  static template = xml`<div/>`;

  setup() {
    const scope = useScope();
    window.debugAttach = () => {
      scope.run(() => {
        // code executed here can call hooks, plugin(), etc.,
        // just like during the original setup
      });
    };
  }
}
```

`scope.run` pushes the scope on the stack for the duration of the synchronous
callback, then pops it on return (even if the callback throws). It does _not_
keep the scope "live" across `await` — once the synchronous body returns, the
scope is popped again. If you need to run async code with a live scope, make
each synchronous chunk its own `scope.run` call.

## Cleanup Callbacks

Use `onWillDestroy` (or [`scope.onDestroy`](#scopeondestroycallback) on a
captured scope) to register cleanup code:

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

Callbacks run in reverse registration order, _before_ the scope transitions
to `DESTROYED`, so they can still observe the pre-destroyed state. Errors
thrown from a callback are routed to the component's error handling (for a
component scope) or logged to the console (for a plugin manager's scope);
they don't interrupt the destruction of sibling callbacks or the scope
itself.

## API Reference

| API                                              | Description                                            |
| ------------------------------------------------ | ------------------------------------------------------ |
| [`useScope()`](#usescope)                        | return the active scope, throw if there is none        |
| [`getScope()`](#getscope)                        | return the active scope, or `null`                     |
| [`status(entity)`](#statusentity)               | human-readable status of a component or plugin         |
| [`scope.status`](#scopestatus)                  | the scope's lifecycle status                           |
| [`scope.app`](#scopeapp)                        | the owning `App` instance                              |
| [`scope.abortSignal`](#scopeabortsignal)        | an `AbortSignal` aborted when the scope dies           |
| [`scope.until(promise)`](#scopeuntilpromise)   | await a promise, throw `AbortError` if the scope dies  |
| [`scope.onDestroy(callback)`](#scopeondestroycallback) | register a cleanup callback                    |
| [`scope.run(callback)`](#scoperuncallback)     | run code with this scope active                        |
| [`scope.cancel()`](#scopecancel)                | cancel the scope (mostly internal)                     |

### `useScope()`

```ts
function useScope(): Scope;
```

Returns the scope currently on top of the scope stack. Throws an `OwlError`
(`"No active scope"`) if there is none — this is the intended form for code
that must be called inside a component's or plugin's `setup()` (or inside
`scope.run`).

```js
import { Component, useScope, xml } from "@odoo/owl";

class MyComponent extends Component {
  static template = xml`<div/>`;

  setup() {
    const scope = useScope(); // this component's scope
  }
}
```

### `getScope()`

```ts
function getScope(): Scope | null;
```

Returns the scope currently on top of the scope stack, or `null` if no scope
is active. Reach for this only when the absence of a scope is meaningful —
e.g. a helper that behaves differently inside and outside of a setup:

```js
import { getScope } from "@odoo/owl";

function currentAbortSignal() {
  return getScope()?.abortSignal ?? null;
}
```

### `status(entity)`

```ts
function status(
  entity: Component | Plugin
): "new" | "mounted" | "started" | "cancelled" | "destroyed";
```

Returns the status of a component or plugin as a human-readable string. This
is the recommended way to check liveness in application code. Note that a
fully-alive plugin reports `"started"` where a component reports `"mounted"`.

```js
import { Component, status } from "@odoo/owl";

class MyComponent extends Component {
  // ...
  async someMethod() {
    await this.doSomething();
    if (status(this) === "destroyed") {
      return; // the component died during the await
    }
    // ...
  }
}
```

### `scope.status`

```ts
scope.status: STATUS; // NEW | MOUNTED | CANCELLED | DESTROYED
```

The scope's current lifecycle status (see
[Lifetime and Status](#lifetime-and-status)). The four values are ordered
(`NEW` < `MOUNTED` < `CANCELLED` < `DESTROYED`), so "is this scope dead?" is
"is `status` greater than `MOUNTED`?". For readable checks on a component or
plugin instance, prefer the [`status()`](#statusentity) helper.

### `scope.app`

```ts
scope.app: App;
```

The [`App`](app.md) instance that owns this scope's component or plugin tree.

### `scope.abortSignal`

```ts
scope.abortSignal: AbortSignal;
```

A standard `AbortSignal` tied to the scope's lifetime: it aborts when the
scope is cancelled or destroyed, and reading it on an already-dead scope
returns an already-aborted signal. The underlying `AbortController` is
allocated lazily, on first access.

Forward it to any async API that accepts an `AbortSignal`:

```js
onWillStart(async ({ abortSignal }) => {
  const response = await fetch("/api/data", { signal: abortSignal });
  this.data = await response.json();
});
```

### `scope.until(promise)`

```ts
scope.until<T>(promise: Promise<T>): Promise<T>;
```

Awaits `promise` and returns its result, but throws an `AbortError` if the
scope is dead **before or after** the await. Use it to guard each step of an
async chain whose individual operations don't accept an `AbortSignal`:

```js
onWillStart(async (scope) => {
  const rec = await scope.until(loadRecord(id));
  const extra = await scope.until(loadExtras(rec.id)); // not reached if dead
  this.data = { ...rec, ...extra };
});
```

`until` only performs status checks: it never allocates an `AbortController`,
and it does not cancel the wrapped promise itself — it only stops _your_
chain from continuing.

### `scope.onDestroy(callback)`

```ts
scope.onDestroy(callback: () => void): void;
```

Registers `callback` to run when the scope is destroyed. Callbacks run in
reverse registration order, before the scope transitions to `DESTROYED`. If
the scope is already destroyed, `callback` is invoked immediately. Errors
thrown by a callback are reported (component error handling, or the console
for plugin managers) without interrupting the other callbacks.

Inside `setup()`, the `onWillDestroy` hook is the usual spelling; use
`scope.onDestroy` when all you have is a captured scope:

```js
const scope = useScope();
scope.onDestroy(() => subscription.unsubscribe());
```

### `scope.run(callback)`

```ts
scope.run<T>(callback: () => T): T;
```

Pushes the scope on the scope stack, runs the synchronous `callback`, pops
the scope (even if `callback` throws), and returns the callback's result.
Inside the callback, `useScope()` returns this scope, so hooks and `plugin()`
attach to it — as if the code ran during the original `setup()`:

```js
const scope = useScope(); // captured during setup

// ... later, outside of setup:
scope.run(() => {
  onWillDestroy(() => cleanup()); // attaches to the captured scope
});
```

The scope is only active for the synchronous duration of the callback — it is
**not** kept active across `await`. To run async code, wrap each synchronous
chunk in its own `scope.run` call.

### `scope.cancel()`

```ts
scope.cancel(): void;
```

Marks the scope as `CANCELLED` and aborts its abort signal. Does nothing if
the scope is already dead. This is used internally when a component is
abandoned before being mounted (e.g. replaced by a newer rendering);
application code should rarely, if ever, call it.
