# Effects

An effect is a function that subscribes to reactive values and re-runs whenever
its dependencies change. It is executed immediately on creation, and subsequent
re-runs are batched after a microtask:

```js
const s = signal(3);
const d = computed(() => 2 * s());

const cleanup = effect(() => {
  console.log(d()); // logs 6
});

s.set(4);
// nothing happens immediately
await Promise.resolve();
// now 8 is logged — the effect was re-executed

cleanup();
// the effect is now inactive
s.set(5);
await Promise.resolve();
// nothing happens
```

The return value of `effect()` is a cleanup function that stops the effect.

Effects react to [signals](signals.md), [computed values](computed_values.md),
and [proxy](proxies.md) properties alike. See [Reactivity](reactivity.md) for
the overall model.

## Cleanup within effects

If the effect function itself returns a function, that function is called before
each re-run, allowing resource cleanup:

```js
effect(() => {
  const handler = () => console.log(someSignal());
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
});
```

## Nested effects

When `effect()` is called while another effect is running, the new effect
becomes a **child** of the running one. The child's lifetime is tied to the
parent: whenever the parent re-runs or is disposed, the child is disposed
first — its cleanup function runs and all its subscriptions are released.

```js
effect(() => {
  // parent
  console.log("parent");
  effect(() => {
    // child, owned by parent
    console.log(someSignal());
    return () => console.log("child cleanup");
  });
});
```

Each time the parent re-runs, the previous child is disposed and a fresh one
is created (logging `"child cleanup"` before every re-run). When the parent
itself is disposed, the child is disposed too.

This ownership is **implicit** — any `effect()` call made while another effect
is on the call stack is attached to that effect, even if it happens inside a
helper called from the parent's body. Be especially careful with conditional
creation:

```js
let created = false;
effect(() => {
  // B
  someSignal();
  if (!created) {
    created = true;
    effect(() => {
      // A, created only once — but owned by B
      otherSignal();
    });
  }
});
```

Here A is created on B's first run and becomes B's child. The next time B
re-runs (e.g. because `someSignal` changed), B's previous children are
disposed — A is silently shut down. Since the `created` flag prevents A from
being recreated, A is now dead and no longer reacts to `otherSignal` changes.

If you need an inner effect with an independent lifetime, create it inside
[`untrack`](#untrack) so it is not attached to the currently running effect.

## useEffect

In components, use the `useEffect` hook instead of raw `effect()`. It is
automatically cleaned up when the component is destroyed:

```js
class MyComponent extends Component {
  static template = xml`<div/>`;

  setup() {
    const value = signal(0);
    // equivalent to: onWillDestroy(effect(() => { ... }))
    useEffect(() => {
      console.log(value());
    });
  }
}
```

`useEffect` can also be called inside a [plugin](plugins.md)'s `setup`, where it
is bound to the plugin's lifetime and disposed when the plugin is destroyed.

## untrack

Executes a function without tracking any reactive dependencies. Reads inside
the function do not create subscriptions:

```js
const s = signal(1);
const c = computed(() => {
  const tracked = s();
  const notTracked = untrack(() => s());
  return tracked + notTracked;
});
// c depends on s only once (the tracked read)
```

`untrack` also breaks effect [ownership](#nested-effects): an `effect()`
created inside `untrack` is not attached to the surrounding effect, so it
survives when the outer effect re-runs or is disposed. In that case the caller
becomes responsible for disposing it:

```js
let disposeInner;
effect(() => {
  outerSignal();
  if (!disposeInner) {
    disposeInner = untrack(() =>
      effect(() => {
        innerSignal();
      })
    );
  }
});
// disposeInner() must be called explicitly when the inner effect is no longer needed
```
