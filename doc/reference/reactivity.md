# 🦉 Reactivity 🦉

## Content

- [Overview](#overview)
- [`useState`](#usestate)
- [`reactive`](#reactive)
- [`markRaw`](#markraw)
- [`toRaw`](#toraw)

## Overview

Reactivity is a big topic in javascript frameworks. The goal is to provide a
simple way to manipulate state, in such a way that the interface automatically
update accordingly to state changes. Also, we obviously want this to happen in
a performant way.

To solve this issue, Owl provides two reactivity primitives:

- `reactive`, which returns a proxy to its first argument, and tracks all read/update
  operation going through it,
- `useState`: a hook, that internally uses `reactive`, and is linked to its
  owner component: any read operation will be tracked (key by key), and any
  updates to these tracked values will cause the component to be rerendered.

Most of the time, the `useState` hook is the best solution.

## `useState`

Let us start by an example of how `useState` could be used:

```js
class Counter extends Component {
  static template = xml`
    <div t-on-click="increment">
      <t t-esc="state.value"/>
    </div>`;

  setup() {
    this.state = useState({ value: 0 });
  }

  increment() {
    this.state.value++;
  }
}
```

If one were to use a simple state object, Owl would not be aware that the value
was changed and that the component should be rerendered. With the `useState`
hook, `this.state` is now a reactive object, so this component works as expected.

## `reactive`

The `reactive` function is the basic reactivity primitive. It takes an object
or an array as first argument, and optionally, a function as the second argument.
The function will be called whenever any tracked value is updated.

```js
const obj = reactive({ a: 1 }, () => console.log("changed"));

obj.a = 2; // does not log anything: the 'a' key was not read
console.log(obj.a); // log 2, and reads the 'a' key => it is now tracked
obj.a = 3; // log 'changed' because we updated a tracked value
```

An important property of reactive objects is that they can be reobserved: this
will create an independant proxy that tracks another set of keys:

```js
const obj1 = reactive({ a: 1, b: 2 }, () => console.log("observer 1"));
const obj2 = reactive(obj1, () => console.log("observer 2"));

console.log(obj1.a); // log 1, and reads the 'a' key => it is now tracked by observer 1
console.log(obj1.b); // log 2, and 'b' is now tracked by observer 1
console.log(obj2.b); // log 2, and 'b' is now tracked by observer 1
obj2.a = 3; // log 'observer1', because observer2 does not track a
obj2.b = 3; // log 'observer1' and 'observer2'
```

Obviously, one can use `reactive` on the result of a `useState` if wanted, this
is the proper way to watch for some state changes.

## `markRaw`

Marks an object so that it is ignored by the reactivity system. This function returns its argument.

```js
const someObject = markRaw(...);
const state = useState({
  a: 1,
  obj: someObject
});
// here, state.obj === someObject
```

This is useful in some rare cases. For example, some complex and large object such
that going through the reactivity system may cause a non trivial performance slowdown.

However, use this function with caution: this is an escape hatch from the reactivity
system, and as such, using it may cause subtle and unintended issues!

## `toRaw`

Given a reactive object, this function returns the underlying, non-reactive,
corresponding object.

```js
// in setup
const state = useState({ value: 1 });

// later:
const rawState = toRaw(this.state);
rawState.value = 3; // will NOT be picked up by the reactivity system!!!
```

Here again, this is useful in some situations where we want to explicitely bypass
Owl, but using this function means that the responsability of coordinating
state update is given to the user code, instead of Owl. Subtle bugs may arise!

Also, normal (non-reactive objects) will be directly returned by `toRaw`:

```js
const obj = { a: 1 };
console.log(toRaw(obj) === obj); // true
```
