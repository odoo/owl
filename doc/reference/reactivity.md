# Reactivity

## Introduction

Reactivity is the mechanism by which the framework automatically updates the
interface in response to state changes. Owl 3 provides a fine-grained reactivity
system built on four primitives: **signals**, **computed values**, **proxies**,
and **effects**.

A key design principle is that reactive values are **not tied to components**.
They can be created anywhere — in a component, a plugin, or a plain JavaScript
module — and shared freely across the application. Dependency tracking happens
at read time: when a reactive value is read inside an effect or a component
render, a subscription is created. When the value changes, all subscribers are
notified and updates are batched via microtasks.

```js
const count = signal(0);
const state = proxy({ color: "red", value: 15 });
const total = computed(() => count() + state.value);

console.log(total()); // 15
```

## Signals

A signal is the most basic reactive primitive. It holds a value that can be
read and updated:

```js
const s = signal(3);

s(); // read: returns 3
s.set(4); // write: updates the value to 4
s(); // returns 4
```

Setting a signal to an identical value is a no-op — it
does not trigger any update.

In a component, signals can be used directly as class properties:

```js
class Counter extends Component {
  static template = xml`
    <div t-on-click="increment">
      <t t-out="this.count()"/>
    </div>`;

  count = signal(0);

  increment() {
    this.count.set(this.count() + 1);
  }
}
```

### Collection Signals

Manipulating collections (arrays, objects, maps, sets) is a very common need.
Plain signals hold a reference, so mutating the contents (e.g. `push`) does not
change the reference and won't trigger updates. To solve this, Owl provides
four collection signal variants that wrap the value in a shallow proxy, so
mutations are automatically detected:

```js
const list = signal.Array([1, 2, 3]);
list().push(4); // detected — subscribers are notified

const obj = signal.Object({ a: 1 });
obj().a = 2; // detected

const set = signal.Set(new Set());
set().add("hello"); // detected

const map = signal.Map(new Map());
map().set("key", "value"); // detected
```

**Caveat:** the proxy is shallow. Deeply nested mutations are **not** detected:

```js
const list = signal.Array([{ nested: { value: 1 } }]);

// This is detected (direct mutation on the proxied array element):
list().push({ nested: { value: 2 } });

// This is NOT detected (deep nested mutation):
list()[0].nested.value = 42;
```

## Computed Values

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

A computed value has a no-op `.set()` method by default, making it read-only.

### Writable Computed

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

## Proxy

The `proxy` function creates a reactive proxy for an object. Reading a property
subscribes to it, and writing a property notifies subscribers. Nested objects
are recursively wrapped in proxies:

```js
const p = proxy({ a: { b: 3 }, c: 2 });

p.a; // returns a proxy for { b: 3 }
p.a.b; // returns 3, subscribes to both "a" and "b"
p.c; // returns 2, subscribes to "c"
```

`proxy` is **not** a hook — it can be called anywhere, at any time. It works
with objects, arrays, Maps, Sets, and WeakMaps.

### Using proxy in components

```js
class TodoList extends Component {
  static template = xml`
    <div>
      <input t-model.proxy="this.state.text"/>
      <button t-on-click="add">Add</button>
      <ul>
        <li t-foreach="this.state.items" t-as="item" t-key="item">
          <t t-out="item"/>
        </li>
      </ul>
    </div>`;

  state = proxy({ text: "", items: [] });

  add() {
    this.state.items.push(this.state.text);
    this.state.text = "";
  }
}
```

Note the use of `t-model.proxy` to bind an input to a proxy property (see
[Form Bindings](form_bindings.md) for details).

## Effects

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

### Cleanup within effects

If the effect function itself returns a function, that function is called before
each re-run, allowing resource cleanup:

```js
effect(() => {
  const handler = () => console.log(someSignal());
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
});
```

### useEffect

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

## Manual Invalidation

When using a plain `signal` (not a collection variant) that holds a mutable
value, mutating the value in-place does not trigger updates because the
reference hasn't changed. In that case, you can manually invalidate the signal:

```js
const list = signal([1, 2, 3]);

list().push(4); // mutates in-place — no update triggered
signal.invalidate(list); // manually notify subscribers
```

In general, prefer collection signals (`signal.Array`, `signal.Object`, etc.)
which handle this automatically. Use `signal.invalidate` only when collection
signals are not appropriate for your use case.

## Escape Hatches

### markRaw

Marks an object so that it is never wrapped in a reactive proxy. This is useful
to avoid the overhead of proxy creation for large, immutable data:

```js
const raw = markRaw({ label: "text", value: 42 });
const state = proxy({ items: [raw] });

state.items[0] === raw; // true — not proxified
```

**Caveat:** mutations to marked-raw objects will **not** trigger updates. Only
use `markRaw` when you know the object won't change, or when profiling reveals
that proxy creation is a performance bottleneck.

### toRaw

Given a proxy, returns the underlying non-proxy object. Useful for identity
comparison and debugging:

```js
const target = { a: 1 };
const p = proxy(target);

p === target; // false (p is a proxy)
toRaw(p) === target; // true
```

### untrack

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

## Batching

All reactive updates are batched in microtasks. Multiple signal writes in the
same synchronous block trigger only a single effect re-run:

```js
const a = signal(1);
const b = signal(2);

effect(() => {
  console.log(a() + b()); // logs 3
});

a.set(10);
b.set(20);
// only one re-run after the microtask — logs 30, not 12 then 30
```
