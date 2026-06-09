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
import { props, types as t } from "@odoo/owl";

props = props({ count: t.signal(t.number()) });
```

See [Types Validation](types_validation.md) for the complete list of validators.

## Collection Signals

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
