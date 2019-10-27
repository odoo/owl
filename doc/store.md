# 🦉 Store 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [Store](#store)
  - [Actions](#actions)
  - [Getters](#getters)
  - [Connecting a Component](#connecting-a-component)
  - [`useStore`](#usestore)
  - [`useDispatch`](#usedispatch)
  - [`useGetters`](#usegetters)
  - [Semantics](#semantics)
  - [Good Practices](#good-practices)

## Overview

Managing the state in an application is not an easy task. In some cases, the
state of an application can be part of the component tree, in a natural way.
However, there are situations where some parts of the state need to be displayed
in various parts of the user interface, and then, it is not obvious which
component should own which part of the state.

Owl's solution to this issue is a centralized store. It is a class that owns
some (or all) state, and lets the developer update it in a structured way, with
`actions`. Owl components can then connect to the store, and will be updated if
necessary.

Note: Owl store is inspired by React Redux and VueX.

## Example

Here is what a simple store looks like:

```js
const actions = {
  addTodo({ state }, message) {
    state.todos.push({
      id: state.nextId++,
      message,
      isCompleted: false
    });
  }
};

const state = {
  todos: [],
  nextId: 1
};

const store = new owl.Store({ state, actions });
store.on("update", null, () => console.log(store.state));

// updating the state
store.dispatch("addTodo", "fix all bugs");
```

This example shows how a store can be defined and used. Note that in most cases,
actions will be dispatched by connected components.

## Reference

### `Store`

The store is a simple [`owl.EventBus`](event_bus.md) that triggers `update` events
whenever its state is changed. Note that these events are triggered only after a
microtask tick, so only one event will be triggered for any number of state changes in a
call stack.

Also, it is important to mention that the state is observed (with an `owl.Observer`),
which is the reason why it is able to know if it was changed. See the
[Observer](observer.md)'s documentation for more details.

The `Store` class is quite small. It has two public methods:

- its constructor
- `dispatch`

The constructor takes a configuration object with four (optional) keys:

- the initial state
- the actions
- the getters
- the environment

```javascript
const config = {
  state,
  actions,
  getters,
  env
};
const store = new Store(config);
```

### Actions

Actions are used to coordinate state changes. It can be used for both synchronous
and asynchronous logic.

```js
const actions = {
  async login({ state }, info) {
    state.loginState = "pending";
    try {
      const loginInfo = await doSomeRPC("/login/", info);
      state.loginState = loginInfo;
    } catch (e) {
      state.loginState = "error";
    }
  }
};
```

The first argument to an action method is an object with four keys:

- `state`: the current state of the store content,
- `dispatch`: a function that can be used to dispatch other actions,
- `getters`: an object containing all getters defined in the store,
- `env`: the current environment. This is useful sometimes, in particular if
  an action needs to apply some side effects (such as performing an rpc), and
  the `rpc` method is located in the environment.

Actions are called with the `dispatch` method on the store, and can receive an
arbitrary number of arguments.

```js
store.dispatch("login", someInfo);
```

Note that anything returned by an action will also be returned by the `dispatch`
call.

Also, it is important to be aware that we need to be careful with asynchronous
logic. Each state change will potentially trigger a rerendering, so we need to
make sure that we do not have a partially corrupted state. Here is an example that
is likely not a good idea:

```javascript
const actions = {
  async fetchSomeData({ state }, recordId) {
    state.recordId = recordId;
    const data = await doSomeRPC("/read/", recordId);
    state.recordData = data;
  }
};
```

In the previous example, there is a period of time in which the state has a
`recordId` which does not correspond to the `recordData`. It is more likely that
we want an atomic update: updating the `recordId` at the same time as the `recordData`
values:

```javascript
const actions = {
  async fetchSomeData({ state }, recordId) {
    const data = await doSomeRPC("/read/", recordId);
    state.recordId = recordId;
    state.recordData = data;
  }
};
```

### Getters

Usually, data contained in the store will be stored in a normalized way. For
example,

```js
{
    posts: [{id: 11, authorId: 4, content: 'Greetings'}],
    authors: [{id: 4, name: 'John'}]
}
```

However, the user interface will probably need some denormalized data like

```js
{id: 11, author: {id: 4, name: 'John'}, content: 'Greetings'}
```

This is what `getters` are for: they give a centralized way to process and
transform the data contained in the store.

```js
const getters = {
  getPost({ state }, id) {
    const post = state.posts.find(p => p.id === id);
    const author = state.authors.find(a => a.id === post.id);
    return {
      id,
      author,
      content: post.content
    };
  }
};

// somewhere else
const post = store.getters.getPost(id);
```

Getters take _at most_ one argument.

Note that getters are not cached.

### Connecting a Component

At some point, we need a way to interact with the store from a component. This
can be done with the help of the three store hooks:

- [`useStore`](#usestore) to subscribe a component to some part of the store state,
- [`useDispatch`](#usedispatch) to get a reference to a dispatch function,
- [`useGetters`](#usegetters) to get a reference to the getters defined in the store.

Assume we have this store:

```javascript
const actions = {
  increment({ state }, val) {
    state.counter.value += val;
  }
};

const state = {
  counter: { value: 0 }
};
const store = new owl.Store({ state, actions });
```

A counter component can then select this value and dispatch an action like this:

```js
class Counter extends Component {
  counter = useStore(state => state.counter);
  dispatch = useDispatch();
}

const counter = new Counter({ store, qweb });
```

```xml
<button t-name="Counter" t-on-click="dispatch('increment')">
  Click Me! [<t t-esc="counter.value"/>]
</button>
```

### `useStore`

The `useStore` hook is used to select some part of the store state. It accepts
two arguments:

- a selector function, which takes the store state as first argument (and the
  component props as second argument) and returns
  an object or an array (which will be then observed),
- optionally, an object with a `store` key (if we want to override the default
  store) and an equality function (if we want to specialize the comparison).

If the `useStore` callback selects a sub part of the store state, the component
will only be rerendered whenever this part of the state changes. Otherwise, it
will perform a strict equality check and will update the component every time this
check fails.

Also, it may not be obvious, but it is crucial to remember that the selector
function should return an object or an array.  The reason is that it needs to be
observed, otherwise the component would not be able to react to changes.

### `useDispatch`

The `useDispatch` hook is useful when a component needs to be able to dispatch
actions. It takes an optional argument, which is a store. If not given, it will
use the store in the environment.

Note that a component does not need to be connected in any other way to the store.
For example:

```js
class DoSomethingButton extends Component {
  static template = xml`<button t-on-click="dispatch('something')">Click</button>`;
  dispatch = useDispatch();
}
```

### `useGetters`

The `useGetters` hook is useful when a component needs to be able to use the
getters defined in a store. It takes an optional argument, which is a store. If
not given, it will use the store in the environment.

Note that a component does not need to be connected in any other way to the store.
For example:

```js
class InfoButton extends Component {
  static template = xml`<span><t t-esc="getters.somevalue()"></span>`;
  getters = useGetters();
}
```

### Semantics

The `Store` class and the `useStore` hook try to be smart and to optimize as much
as possible the rendering and update process. What is important to know is:

- components are always updated in the order of their creation (so, parent
  before children),
- they are updated only if they are in the DOM,
- if a parent is asynchronous, the system will wait for it to complete its
  update before updating other components,
- in general, updates are not coordinated. This is not a problem for synchronous
  components, but if there are many asynchronous components, this could lead to
  a situation where some part of the UI is updated and some other part of the UI is
  not updated.

### Good Practices

- avoid asynchronous components as much as possible. Asynchronous components
  lead to situations where parts of the UI is not updated immediately,
- do not be afraid to connect many components, parent or children if needed. For
  example, a `MessageList` component could get a list of ids in its `useStore`
  call and a `Message` component could get the data of its own
  message,
- since the `useStore` function is called for each connected component,
  for each state update, it is important to make sure that these functions are
  as fast as possible.
