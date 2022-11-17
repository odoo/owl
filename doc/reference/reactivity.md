# 🦉 Reactivity 🦉

## Content

- [Introduction](#introduction)
- [`useState`](#usestate)
- [`reactive`](#reactive)
- [`Escape hatches`](#escape-hatches)
- [`Advanced usage`](#advanced-usage)

## Introduction

Reactivity is a big topic in javascript frameworks. The goal is to provide a
simple way to manipulate state, in such a way that the interface updates automatically
according to state changes, and to do so in a performant manner.

To this end, Owl provides a proxy-based reactivity system, based on the `reactive` primitive.
The `reactive` function takes an object as a first argument, and an optional callback as its second
argument, it will return a proxy of the object. This proxy will track what properties are read
through the proxy, and call the provided callback whenever one of these properties is changed
through any reactive version of the same object. It does so in depth, by returning reactive versions
of the subobjects when they are read.

## `useState`

While the `reactive` primitive is very powerful, its usage in components follow a very standard pattern:
components want to be rerendered when part of the state which they depend on for rendering changes. To
this end, owl provides a standard hook: `useState`. To put it simply, this hook simply calls reactive
with the provided object, and the current component's render function as its callback. This will cause
it to rerender whenever any part of the state object that has been read by this component is modified.

Here is a simple example of how `useState` can be used:

```js
class Counter extends Component {
  static template = xml`
    <div t-on-click="() => this.state.value++">
      <t t-esc="state.value"/>
    </div>`;

  setup() {
    this.state = useState({ value: 0 });
  }
}
```

This component reads `state.value` when it renders, subscribing it to changes to that key. Whenever
the value changes, Owl will update the component. Note that there is nothing special about the
`state` property, you can name your state variables whatever you want, and you can have multiple of
them on the same component if it makes sense to do so. This also allows `useState` to be used in custom
hooks that may require state that is specific to that hook.

### Reactive props

Since version 2.0, Owl renders are no longer "deep" by default: a component is only rerendered by its
parent if its props have changed (using a simple equality test). What if the contents of a props have
changed in a deeper property? If that prop is reactive, owl will rerender the child components that
need to be updated automatically, and only those components, it does so by reobserving reactive
objects passed as props to components. Consider the following example:

```js
class Counter extends Component {
  static template = xml`
    <div t-on-click="() => props.state.value++">
      <t t-esc="props.state.value"/>
    </div>`;
}

class Parent extends Component {
  static template = xml`
    <Counter state="this.state"/>
    <button t-on-click="() => this.state.value = 0">Reset counter</button>
    <button t-on-click="() => this.state.test++" t-esc="this.state.test"/>`;

  setup() {
    this.state = useState({ value: 0, test: 1 });
  }
}
```

When clicking on the counter button, only the Counter rerenders, because the Parent has never read
the "value" key in the state. When clicking on the "Reset Counter" button, the same thing happens:
only the Counter component rerenders. What matters is not _where_ the state is updated, but which
parts of the state are updated, and which components depend on them. This is achieved by Owl by
automatically calling `useState` on reactive objects passed as props to a child component.

When clicking on the last button, the parent is rerendered, but the child does not care about the
`test` key: it has not read it. The props that we give it (`this.state`) have also not changed,
as such, the parent updates but the child doesn't.

For most day-to-day operations, `useState` should cover all of your needs. If
you are curious about more advanced use cases and technical details, read on.

### Debugging subscriptions

Owl provides a way to show which reactive objects and keys a component is subscribed to: you can
look at `component.__owl__.subscriptions`. Note that this is on the internal `__owl__` field, and
should not be used in any type of production code as the name of this property or any of its properties
or methods are subject to change at any point, even in stable versions of Owl, and may become available
only in debug mode in the future.

## `reactive`

The `reactive` function is the basic reactivity primitive. It takes an object
or an array as first argument, and optionally, a function as the second argument.
The function will be called whenever any tracked value is updated.

```js
const obj = reactive({ a: 1 }, () => console.log("changed"));

obj.a = 2; // does not log anything: the 'a' key has not been read yet
console.log(obj.a); // logs 2 and reads the 'a' key => it is now tracked
obj.a = 3; // logs 'changed' because we updated a tracked value
```

An important property of reactive objects is that they can be reobserved: this
will create an independent proxy that tracks another set of keys:

```js
const obj1 = reactive({ a: 1, b: 2 }, () => console.log("observer 1"));
const obj2 = reactive(obj1, () => console.log("observer 2"));

console.log(obj1.a); // logs 1, and reads the 'a' key => it is now tracked by observer 1
console.log(obj2.b); // logs 2, and 'b' is now tracked by observer 2
obj2.a = 3; // only logs 'observer1', because observer2 does not track a
obj2.b = 3; // only logs 'observer2', because observer1 does not track b
console.log(obj2.a, obj1.b); // logs 3 and 3, while the object is observed independently, it is still a single object
```

Because `useState` returns a normal reactive object, it is possible to call `reactive` on the result
of a `useState` to observe changes to that object while outside the context of a component, or to
call `useState` on reactive objects created outside of components. In those cases, one needs to be
careful with regards to the lifetime of those reactive objects, as holding references to these
objects may prevent garbage collection of the component and its data even if Owl has destroyed it.

### Subscriptions are ephemereal

Subscription to state changes are ephemereal, whenever an observer is notified that a state object
has changed, all of its subscriptions are cleared, meaning that if it still cares about it, it
should read the properties it cares about again. For example:

```js
const obj = reactive({ a: 1 }, () => console.log("observer called"));

console.log(obj.a); // logs 1, and reads the 'a' key => it is now tracked by the observer
obj.a = 3; // logs 'observer1' and clears the subscriptions of the observer
obj.a = 4; // doesn't log anything, the key is no longer observed
```

This may seem counter-intuitive, but it makes perfect sense in the context of components:

```js
class DoubleCounter extends Component {
  static template = xml`
    <t t-esc="state.selected + ': ' + state[state.selected].value"/>
    <button t-on-click="() => this.state.count1++">increment count 1</button>
    <button t-on-click="() => this.state.count2++">increment count 2</button>
    <button t-on-click="changeCounter">Switch counter</button>
  `;

  setup() {
    this.state = useState({ selected: "count1", count1: 0, count2: 0 });
  }

  changeCounter() {
    this.state.selected = this.state.selected === "count1" ? "count2" : "count1";
  }
}
```

In this component, if we increment the value of the second counter, the component will not rerender,
which makes sense as rerendering will have no effect, as the second counter is not displayed. If we
toggle the component to display the second counter, we now no longer want the component to rerender
when the value of the first counter changes, and this is what happens: a component only rerenders
when there are changes to pieces of state that have been read during or after the previous render.
If a piece of state has not been read in the last render, we know that its value won't influence the
rendered output, and so we can ignore it.

### reactive `Map` and `Set`

The reactivity system has special support built-in for the standard container types `Map` and `Set`.
They behave like one would expect: reading a key subscribes the observer to that key, adding or
removing an item to them will notify observers that have used any of the iterators on that reactive
object, such as `.entries()` or `.keys()`, likewise with clearing them.

## Escape hatches

Sometimes, it is desirable to bypass the reactivity system. Creating proxies when interacting with
reactive objects is expensive, and while on the whole, the performance benefit that we get by
rerendering only the parts of the interface that need it outweighs that cost, in some cases, we want
to be able to opt out of creating them in the first place. This is the purpose of `markRaw`:

### `markRaw`

Marks an object so that it is ignored by the reactivity system, meaning that if this object is ever
part of a of a reactive object, it will be returned as is, and no keys in that object will be
observed.

```js
const someObject = markRaw({ b: 1 });
const state = useState({
  a: 1,
  obj: someObject,
});
console.log(state.obj.b); // attempt to subscribe to the "b" key in someObject
state.obj.b = 2; // No rerender will occur here
console.log(someObject === state.obj); // true
```

This is useful in some rare cases. One such example would be if you want to use an array of objects
that is potentially large to render a list, but those objects are known to be immutable:

```js
this.items = useState([
  { label: "some text", value: 42 },
  // ... 1000 total objects
]);
```

in the template:

```xml
<t t-foreach="items" t-as="item" t-key="item.label" t-esc="item.label + item.value"/>
```

Here, on every render, we will go and read one thousand keys from a reactive object, which will
cause one thousand reactive objects to be created. If we know that the content of these objects
cannot change, this is wasted work. If instead all of these objects are marked as raw, we will avoid
all of this work while keeping the ability to lean on the reactivity to track the presence and
identity of these objects:

```js
this.items = useState([
  markRaw({ label: "some text", value: 42 }),
  // ... 1000 total objects
]);
```

However, use this function with caution: this is an escape hatch from the reactivity
system, and as such, using it may cause subtle and unintended issues! For example:

```js
// This will cause a rerender
this.items.push(markRaw({ label: "another label", value: 1337 }));

// THIS WILL NOT CAUSE A RENDER!
this.items[17].value = 3;
// The UI is now desynced from component's state until the next render caused by something else
```

In short: only use `markRaw` if your application is slowing down noticeably and profiling reveals
that a lot of time is spent creating useless reactive objects.

### `toRaw`

While `markRaw` marks an object so that it is never made reactive, `toRaw` takes an object and
returns the underlying non-reactive object. It can be useful in some niche cases. In particular,
because the reactivity system returns a proxy, the returned object does not compare equal to the
original object:

```js
const obj = {};
const reactiveObj = reactive(obj);
console.log(obj === reactiveObj); // false
console.log(obj === toRaw(reactiveObj)); // true
```

It can also be useful during debugging, as unfolding proxies recursively in debuggers can be confusing.

## Advanced usage

The following is a collection of small snippets that leverage the reactivity system in
"non-standard" ways to help you understand its power and where using it might make your code simpler.

### Notification manager

Showing notifications is a pretty common need in web applications, you may want to show a
notification from any other component within the application, and the notifications should stack on
top of one another regardless of which component spawned them, here is how we can leverage the
reactivity to accomplish this:

```js
let notificationId = 1;
const notifications = reactive({});
class NotificationContainer extends Component {
  static template = xml`
    <t t-foreach="notifications" t-as="notification" t-key="notification_key" t-esc="notification"/>
  `;
  setup() {
    this.notifications = useState(notifications);
  }
}

export function addNotification(label) {
  const id = notificationId++;
  notifications[id] = label;
  return () => {
    delete notifications[id];
  };
}
```

Here, the `notifications` variable is a reactive object. Notice how we didn't give `reactive` a
callback: this is because in this case, all we care about is that adding or removing notifications
in the `addNotification` function goes through the reactivity system. The `NotificationContainer`
component reobserves this object with `useState`, and will be updated whenever notifications are
added or removed.

### Store

Centralizing application state is a pretty common want/need in web applications. Because of the way
the reactivity system works, you can treat any reactive object as a store, and if you call `useState`
on it, components will automatically observe only the part of the store that they're interested in:

```js
export const store = reactive({
  list: [],
  add(item) {
    this.list.push(item);
  },
});

export function useStore() {
  return useState(store);
}
```

In any component:

```js
import { useStore } from "./store";

class List extends Component {
  static template = xml`
    <t t-foreach="store.list" t-as="item" t-key="item" t-esc="item"/>
  `;
  setup() {
    this.store = useStore();
  }
}
```

Anywhere in the application:

```js
import { store } from "./store";
// Will cause any instance of the List component in the app to update
store.add("New list item!");
```

Notice how we can make objects with methods into reactive objects, and when these methods are used
to mutate the store contents, it works as expected. And while stores are generally one-off objects,
it is entirely possible to make class instances reactive:

```js
class Store {
  list = [];
  add(item) {
    this.list.push(item);
  }
}
// Essentially equivalent to the previous code
export const store = reactive(new Store());
```

Which can be useful to unit test the class separately.

### Local storage synchronization

Sometimes, you want to persist some state accross reloads, you can do this by storing it in the
`localStorage`, but what if you want to update the `localStorage` item every time the state changes,
so that you don't have to manually synchronize the states? Well, you can use the reactivity system
to write a custom hook that will do that for you:

```js
function useStoredState(key, initialState) {
  const state = JSON.parse(localStorage.getItem(key)) || initialState;
  const store = (obj) => localStorage.setItem(key, JSON.stringify(obj));
  const reactiveState = reactive(state, () => store(reactiveState));
  store(reactiveState);
  return useState(state);
}

class MyComponent extends Component {
  setup() {
    this.state = useStoredState("MyComponent.state", { value: 1 });
  }
}
```

One important thing to notice is that both times we call `store`, we call it with `reactiveState`,
not `state`: we need `store` to read the keys through a reactive object for it to correctly
subscribe to state changes. Notice also that we call `store` the first time by hand, as otherwise it
will not be subscribed to anything, and no amount of change in the object will cause the reactive
callback to be invoked.
