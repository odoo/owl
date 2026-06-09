# Proxies

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

A proxy is one of the four reactive primitives. See [Reactivity](reactivity.md)
for how it relates to [signals](signals.md),
[computed values](computed_values.md), and [effects](effects.md).

## Using proxy in components

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

## markRaw

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

## toRaw

Given a proxy, returns the underlying non-proxy object. Useful for identity
comparison and debugging:

```js
const target = { a: 1 };
const p = proxy(target);

p === target; // false (p is a proxy)
toRaw(p) === target; // true
```
