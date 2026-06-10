# Signals

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

Signals are one of the four reactive primitives. See [Reactivity](reactivity.md)
for how they relate to [computed values](computed_values.md),
[proxies](proxies.md), and [effects](effects.md).

## Typing signals

The type of a signal is normally inferred from its initial value, so `signal(0)`
is a `Signal<number>`. When the initial value does not pin the type down — an
empty array, or `null` — `signal` accepts a second `options` argument whose
`type` describes the value with a [type validator](types_validation.md#validators):

```js
const ids = signal([], { type: t.array(t.number()) }); // Signal<number[]>, not Signal<never[]>
const selected = signal(null, { type: t.or([t.instanceOf(User), t.literal(null)]) }); // Signal<User | null>
```

The `type` option exists only to guide TypeScript inference: the validator is
used purely as a type descriptor (it is never run), and Owl performs no runtime
validation on the signal's value.

Signals can also be **validated** when received as component props: the
[`t.signal`](types_validation.md#tsignaltype) validator checks that a prop is a
signal, with an optional inner type for inference.

```js
import { useProps, types as t } from "@odoo/owl";

props = useProps({ count: t.signal(t.number()) });
```

See [Types Validation](types_validation.md) for the complete list of validators.

## Custom Equality

By default, `set` compares the new value to the current one with `Object.is`,
and does nothing when they are equal. The `equals` option replaces that
comparison:

```js
const point = signal({ x: 1, y: 2 }, { equals: shallowEqual });

point.set({ x: 1, y: 2 }); // considered equal: no update, the new object is discarded
point.set({ x: 3, y: 2 }); // different: subscribers are notified
```

When `equals` reports the values as equal, the write is discarded entirely:
the signal keeps the previous value (and its identity).

[`shallowEqual`](utils.md#shallowequal) compares arrays element by element and
plain objects key by key, which covers the common "fresh object with the same
contents" case. Any `(a, b) => boolean` function works.

Passing `equals: false` disables the comparison: every `set` notifies, even
with an identical value. This is occasionally useful for values that are
mutated in place — though [collection signals](#collection-signals) or
[`signal.trigger`](#manual-trigger) are usually a better fit.

Collection signals accept `equals` as well; it only gates explicit `set(...)`
calls. Mutations made through the proxy (`push`, property writes, ...) always
notify.

## Collection Signals

A plain signal holds a reference, so mutating the contents in place (e.g.
`push`, `add`, a property assignment) does not change the reference and won't
trigger updates. To solve this, Owl provides four collection signal variants —
`signal.Array`, `signal.Object`, `signal.Set`, `signal.Map` — that wrap the
underlying value in a reactive proxy and expose the usual signal API on top:

```js
const list = signal.Array([1, 2, 3]);
const obj = signal.Object({ a: 1 });
const set = signal.Set(new Set([1, 2]));
const map = signal.Map(new Map([["a", 1]]));
```

The initial value is optional — omit it to start with an empty collection.
A type parameter is usually helpful in that case:

```js
const list = signal.Array<number>();
const obj = signal.Object<{ count: number }>();
const set = signal.Set<string>();
const map = signal.Map<string, number>();
```

Reading the signal (`list()`) returns the proxy. Mutations on the proxy are
detected automatically; replacing the entire value with `.set(...)` also
notifies every subscriber:

```js
list().push(4); // in-place mutation, detected
obj().a = 2; // property write, detected
set().add("hello"); // detected
map().set("key", "value"); // detected

list.set([10, 20]); // whole-value replacement, detected
```

### Tracking granularity

`signal.Array` and `signal.Object` invalidate the **whole signal** on any
mutation. Reading the proxy — whether `obj()` itself or a single property like
`obj().a` — subscribes the caller to the entire collection, and _any_ write
re-runs every observer. This is the right model when the collection is small
or consumers usually look at all of it.

`signal.Set` and `signal.Map` track **per-key**, just like `proxy`.
Subscribing to `set().has(1)` only re-runs when key `1` is added or removed;
`set().add(2)` leaves observers of `has(1)` (or `map.get(otherKey)`) alone.
Iteration (`[...set()]`, `forEach`, `keys`, `values`, `entries`, `size`)
subscribes to every key, so an effect that iterates still re-runs on any
add/delete.

```js
const set = signal.Set(new Set());

effect(() => console.log("has(1) =", set().has(1)));
set().add(2); // logged once at setup, NOT re-run (key 2 is unrelated)
set().add(1); // re-run: has(1) flipped to true
set.set(new Set()); // re-run: whole signal was replaced
```

### Shallow wrapping

The proxy is shallow: only mutations on the collection itself are tracked.
Nested objects stored inside are returned raw, so deep mutations are **not**
detected:

```js
const list = signal.Array([{ nested: { value: 1 } }]);

list().push({ nested: { value: 2 } }); // detected (mutation on the array)
list()[0].nested.value = 42; // NOT detected (deep mutation)
```

If you need deep reactivity, use [`proxy`](proxies.md) instead — it wraps nested
objects recursively. Reach for a collection signal when shallow wrapping is
enough and you want the explicit `.set(newValue)` replacement API.

## Ref Signals

`signal.ref()` creates a signal meant to receive a DOM element through the
`t-ref` directive. It starts at `null` and is typed as
`Signal<HTMLElement | null>` (or narrower if a constructor is given):

```js
class SomeComponent extends Component {
  static template = xml`<input t-ref="this.inputRef"/>`;

  inputRef = signal.ref(HTMLInputElement);
}
```

See [References](refs.md) for more details.

## Manual Trigger

When using a plain `signal` (not a collection variant) that holds a mutable
value, mutating the value in-place does not trigger updates because the
reference hasn't changed. In that case, you can manually trigger the signal:

```js
const list = signal([1, 2, 3]);

list().push(4); // mutates in-place — no update triggered
signal.trigger(list); // manually notify subscribers
```

In general, prefer collection signals (`signal.Array`, `signal.Object`, etc.)
which handle this automatically. Use `signal.trigger` only when collection
signals are not appropriate for your use case.
