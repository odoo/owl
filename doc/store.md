# 🦉 Store 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [Public API](#public-api)
  - [Mutations](#mutations)
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
some state, and let the developer update it in a structured way (through
mutations and actions). Owl components can then connect to the store, and will
be updated if necessary.

Note: Owl's store is inspired by React Redux and VueX.

## Example

Here is what a simple store looks like:

```js
const actions = {
  addTodo({ commit }, message) {
    commit("addTodo", message);
  }
};

const mutations = {
  addTodo({ state }, message) {
    const todo = {
      id: state.nextId++,
      message,
      isCompleted: false
    };
    state.todos.push(todo);
  }
};

const state = {
  todos: [],
  nextId: 1
};

const store = new owl.Store({ state, actions, mutations });
store.on("update", () => console.log(store.state));

// updating the state
store.dispatch("addTodo", "fix all bugs");
```

## Reference

The store is a simple [`owl.EventBus`](event_bus.md) that triggers `update` events whenever its
state is changed. Note that these events are triggered only after a microtask
tick, so only one event will be triggered for any number of state changes in a
call stack.

Also, it is important to mention that the state is observed (with an `owl.Observer`),
which is the reason why it is able to know if it was changed. This implies that
state changes need to be done carefully in some cases (adding a new key to an
object, or modifying an array with the `arr[i] = newValue` syntax). See the
[Observer](observer.md)'s documentation for more details.

### Public API

1. `constructor`
2. `commit`
3. `dispatch`

### Mutations

Mutations are the only way to modify the state. Changing the state outside a
mutation is not allowed (and should throw an error). Mutations are synchronous.

### Actions

Actions are used to coordinate state changes. It is also useful whenever some
asynchronous logic is necessary. For example, fetching data should be done
in an action.

```js
const actions = {
  async login({ commit }) {
    commit("setLoginState", "pending");
    try {
      const loginInfo = await doSomeRPC("/login/", "someinfo");
      commit("setLoginState", loginInfo);
    } catch {
      commit("setLoginState", "error");
    }
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

Getters take *at most* one argument.


Note that getters are cached if they don't take any argument, or their argument
is a string or a number.

### Connecting a Component

By default, an Owl `Component` is not connected to any store. The `connect`
function is there to create sub Components that are connected versions of
Components.

```javascript
const actions = {
  increment({ commit }) {
    commit("increment", 1);
  }
};
const mutations = {
  increment({ state }, val) {
    state.counter += val;
  }
};
const state = {
  counter: 0
};
const store = new owl.Store({ state, actions, mutations });

class Counter extends owl.Component {
  increment() {
    this.env.store.dispatch("increment");
  }
}
function mapStoreToProps(state) {
  return {
    value: state.counter
  };
}
const ConnectedCounter = owl.connect(Counter, mapStoreToProps);

const counter = new ConnectedCounter({ store, qweb });
```

```xml
<button t-name="Counter" t-on-click="increment">
  Click Me! [<t t-esc="props.value"/>]
</button>
```

The arguments of `connect` are:

- `Counter`: an owl `Component` to connect
- `mapStoreToProps`: a function that extracts the `props` of the Component
  from the `state` of the `Store` and returns them as a dict
- `options`: dictionary of optional parameters that may contain
  - `getStore`: a function that takes the `env` in arguments and returns an
    instance of `Store` to connect to (if not given, connects to `env.store`)
  - `hashFunction`: the function to use to detect changes in the state (if not
    given, generates a function that uses revision numbers, incremented at
    each state change)
  - `deep`: [only useful if no hashFunction is given] if false, only watch
    for top level state changes (true by default)

The `connect` function returns a sub class of the given `Component` which is
connected to the `store`.

### Semantics

The `Store` and the `connect` function try to be smart and to optimize as much
as possible the rendering and update process.  What is important to know is:

- components are always updated in the order of their creation (so, parent
  before children)
- they are updated only if they are in the DOM
- if a parent is asynchronous, the system will wait for it to complete its
  update before updating other components.
- in general, updates are not coordinated.  This is not a problem for synchronous
  components, but if there are many asynchronous components, this could lead to
  a situation where some part of the UI is updated and other parts of the UI is
  not updated.

### Good Practices

- avoid asynchronous components as much as possible.  Asynchronous components
  lead to situations where parts of the UI is not updated immediately.
- do not be afraid to connect many components, parent or children if needed. For
  example, a `MessageList` component could get a list of ids in its `mapStoreToProps` and a `Message` component could get the data of its own
  message
- since the `mapStoreToProps` function is called for each connected component,
  for each state update, it is important to make sure that these functions are
  as fast as possible.