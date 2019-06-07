# 🦉 Store 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [Public API](#public-api)
  - [Mutations](#mutations)
  - [Actions](#actions)
  - [Getters](#getters)
  - [Connecting a component](#connecting-a-component)

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

Here is what a simple store look like:

```js
const actions = {
    addTodo({commit}, message) {
        commit('addTodo', message);
    }
};

const mutations = {
    addTodo({state}, message) {
        const todo = {
            id: state.nextId++,
            message,
            isCompleted: false,
        };
        state.todos.push(todo);
    },
};

const state = {
    todos: [],
    nextId: 1,
};

const store = new owl.Store({state, actions, mutations});
store.on('update', () => console.log(store.state));

// updating the state
store.dispatch('addTodo', 'fix all bugs');
```


## Reference

The store is a simple [`owl.EventBus`](event_bus.md) that triggers `update` events whenever its
state is changed.  Note that these events are triggered only after a microtask
tick, so only one event will be triggered for any number of state changes in a
call stack.

Also, it is important to mention that the state is observed (with a `owl.Observer`),
which is the reason why it is able to know if it was changed.  This implies that
state changes need to be done carefully in some cases (adding a new key to an
object, or modifying an array with the `arr[i] = newValue` syntax).  See the
[Observer](observer.md)'s documentation for more details.

### Public API

1. `constructor`
2. `commit`
3. `dispatch`

### Mutations

Mutations are the only way to modify the state.  Changing the state outside a
mutation is not allowed (and should throw an error).  Mutations are synchronous.

### Actions

Actions are used to coordinate state changes.  It is also useful whenever some
asynchronous logic is necessary.  For example, fetching data should be done
in an action.

```js
const actions = {
    async login({commit}) {
        commit('setLoginState', 'pending');
        try {
            const loginInfo = await doSomeRPC('/login/', 'someinfo');
            commit('setLoginState', loginInfo);
        } catch {
            commit('setLoginState', 'error');
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
    getPost({state}, id) {
        const post = state.posts.find(p => p.id === id);
        const author = state.authors.find(a => a.id = post.id);
        return {
            id,
            author,
            content: post.content
        };
    },
};

// somewhere else
const post = store.getters.getPost(id);

```

### Connecting a component

Todo