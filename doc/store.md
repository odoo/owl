# 🦉 Store 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [Store](#store)
  - [Actions](#actions)
  - [Getters](#getters)
  - [Connecting a Component](#connecting-a-component)
  - [Semantics](#semantics)
  - [Good Practices](#good-practices)

## Overview

Managing the state in an application is not an easy task. In some cases, the
state of an application can be part of the component tree, in a natural way.
However, there are situations where some part of the state need to be displayed
in various parts of the user interface, and then, it is not obvious which
component should own which part of the state.

Owl's solution to this issue is a centralized store. It is a class that owns
some (or all) state, and let the developer update it in a structured way, with
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

Actions are called with the `dispatch` method on the store, and can receive an
arbitrary number of arguments.

```js
store.dispatch("login", someInfo);
```

Note that anything returned by an action will also be returned by the `dispatch`
call.

Also, it is important to be aware that we need to be careful with asynchronous
logic. Each state change will potentially trigger a rerendering, so we need to
make sure that we do not have a partial corrupted state. Here is an example that
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
    const author = state.authors.find(a => (a.id = post.id));
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

Note that getters are cached if they don't take any argument, or their argument
is a string or a number.

### Connecting a Component

At some point, we need a way to access the state in the store from a component.
By default, an Owl `Component` is not connected to any store. To do that, we
need to create a component inheriting from `OwlComponent`:

```javascript
const actions = {
  increment({ state }, val) {
    state.counter += val;
  }
};

const state = {
  counter: 0
};
const store = new owl.Store({ state, actions });

class Counter extends owl.ConnectedComponent {
  static mapStoreToProps(state) {
    return {
      value: state.counter
    };
  }
  increment() {
    this.env.store.dispatch("increment");
  }
}

const counter = new Counter({ store, qweb });
```

```xml
<button t-name="Counter" t-on-click="increment">
  Click Me! [<t t-esc="props.value"/>]
</button>
```

The `ConnectedComponent` class can be configured with the following fields:

- `mapStoreToProps`: a function that extracts the `props` of the Component
  from the `state` of the `Store` and returns them as a dict.
- `getStore`: a function that takes the `env` in arguments and returns an
  instance of `Store` to connect to (if not given, connects to `env.store`)
- `hashFunction`: the function to use to detect changes in the state (if not
  given, generates a function that uses revision numbers, incremented at
  each state change)
- `deep` (boolean): [only useful if no hashFunction is given] if `false`, only watch
  for top level state changes (`true` by default)

Note that the class `ConnectedComponent` has a `dispatch` method. This means
that the previous example could be simplified like this:

```javascript
class Counter extends owl.ConnectedComponent {
  static mapStoreToProps(state) {
    return {
      value: state.counter
    };
  }
}
```

```xml
<button t-name="Counter" t-on-click="dispatch('increment')">
  Click Me! [<t t-esc="props.value"/>]
</button>
```

### Semantics

The `Store` and the `ConnectedComponent` try to be smart and to optimize as much
as possible the rendering and update process. What is important to know is:

- components are always updated in the order of their creation (so, parent
  before children)
- they are updated only if they are in the DOM
- if a parent is asynchronous, the system will wait for it to complete its
  update before updating other components.
- in general, updates are not coordinated. This is not a problem for synchronous
  components, but if there are many asynchronous components, this could lead to
  a situation where some part of the UI is updated and other parts of the UI is
  not updated.

### Good Practices

- avoid asynchronous components as much as possible. Asynchronous components
  lead to situations where parts of the UI is not updated immediately.
- do not be afraid to connect many components, parent or children if needed. For
  example, a `MessageList` component could get a list of ids in its `mapStoreToProps` and a `Message` component could get the data of its own
  message
- since the `mapStoreToProps` function is called for each connected component,
  for each state update, it is important to make sure that these functions are
  as fast as possible.
