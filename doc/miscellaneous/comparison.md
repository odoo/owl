# Comparison with Vue/React

OWL, React and Vue have the same main feature: they allow developers to build
declarative user interfaces. To do that, all these frameworks uses a virtual dom. However, there are still obviously many differences.

In this page, we try to highlight some of these differences. Obviously, a lot of
effort was done to be fair. However, if you disagree with some of the points
discussed, feel free to open an issue/submit a PR to correct this text.

## Content

- [Size](#size)
- [Class Based](#class-based)
- [Tooling/Build Step](#toolingbuild-step)
- [Templating](#templating)
- [Asynchronous rendering](#asynchronous-rendering)
- [Reactiveness](#reactiveness)
- [State Management](#state-management)
- [Hooks](#hooks)

## Size

OWL is intended to be small and to work at a slightly lower level of abstraction
than React and Vue. Also, jQuery is not the same kind of framework, but it is interesting to compare.

| Framework                | Size (minified, gzipped) |
| ------------------------ | ------------------------ |
| OWL                      | 18kb                     |
| Vue + VueX               | 30kb                     |
| Vue + VueX + Vue Router  | 39kb                     |
| React + ReactDOM + Redux | 40kb                     |
| jQuery                   | 30kb                     |

Note that those comparisons are not entirely fair, because we do not compare
the same exact set of features. For example, VueX and Vue Router support more
advanced use cases.

## Class Based

Both React and Vue moved away from defining components with classes. They prefer
a more functional approach, in particular, with the new `hooks` mechanisms.

This has some advantages and disadvantages. But the end result is that React
and Vue both offers multiple different ways of defining new components. In
contrast, Owl has only one mechanism: class-based components. We believe that Owl
components are fast enough for all our usecases, and making it as simple as
possible for developers is more valuable (for us).

Also, functions or class based components are more than just syntax. Functions
comes with a mindset of composition and class are about inheritance. Clearly,
both of these are important mechanisms for reusing code. Also, one does not
exclude the other.

It certainly looks like the world of UI frameworks is moving toward composition,
for many very good reasons. Owl is still good at composition (for example,
Owl supports slots, which is the primary mechanism to make generic reusable
components). But it can also use inheritance (and this is very important since
templates can also be inherited with `xpaths` transformations).

## Tooling/Build step

OWL is designed to be easy to use in a standalone way. For various reasons,
Odoo does not want to rely on standard web tools (such as webpack), and OWL can
be used by simply adding a script tag to a page.

```html
<script src="owl.min.js" />
```

In comparison, React encourages using JSX, which necessitate a build step, and
most Vue applications uses single file components, which also necessitate a build step.

On the flipside, external tooling may make it harder to use in some case, but it
also brings a lot of benefits. And React/Vue have both a large ecosystem.

Note that since Owl is not dependant on any external tool nor libraries, it is
very easy to integrate into any build toolchain. Also, since we cannot rely on
additional tools, we made a lot of effort to make the most of the web platform.

For example, Owl uses the standard `xml` parser that comes with every browser.
Because of that, Owl did not have to write its own template parser. Another
example is the [`xml`](../reference/tags.md#xml-tag) tag helper function, which makes use of
native template literals to allow in a natural way to write `xml` templates
directly in the javascript code. This can be easily integrated with editor
plugins to have autocompletion inside the template.

## Templating

OWL uses its own QWeb engine, which compiles templates on the
frontend, as they are needed. This is extremely convenient for our use case, in
particular because templates are described in XML files, and can be modified by
XPaths. Since Odoo is at its heart a modular application, this is an important
feature for us.

```xml
<div>
  <button t-on-click="increment">Click Me! [<t t-esc="state.value"/>]</button>
</div>
```

Vue is actually kind of similar. Its template language is kind of close to QWeb,
with the `v` replaced by the `t`. However, it is also more fully featured. For
example, Vue templates have slots, or event modifiers. A large difference is that
most Vue applications will need to be built ahead of time, to compile the templates
into javascript functions. Note that Vue has a separate build which includes the
template compiler.

In contrast, most React applications do not use a templating language, but write
some JSX code, which is precompiled into plain JavaScript by a build step. This
example is done with the (kind of outdated) React class system:

```jsx
class Clock extends React.Component {
  render() {
    return (
      <div>
        <h1>Hello, world!</h1>
        <h2>It is {this.props.date.toLocaleTimeString()}.</h2>
      </div>
    );
  }
}
```

This has the advantage of having the full power of Javascript, but is less
structured than a template language. Note that the tooling is quite impressive:
there is a syntax highlighter for jsx here on github!

By comparison, here is the equivalent Owl component, written with the
[`xml`](../reference/tags.md#xml-tag) tag helper:

```js
class Clock extends Component {
  static template = xml`
      <div>
        <h1>Hello, world!</h1>
        <h2>It is {props.date.toLocaleTimeString()}.</h2>
      </div>
    `;
}
```

## Asynchronous Rendering

This is actually a big difference between OWL and React/Vue: components in OWL
are totally asynchronous. They have two asynchronous hooks in their lifecycle:

- `willStart` (before the component starts rendering)
- `willUpdateProps` (before new props are set)

Both these methods can be implemented and return a promise. The rendering will
then wait for these promises to be completed before patching the DOM. This is
useful for some use cases: for example, a component may want to fetch an external
library (a calendar component may need a specialized calendar rendering library),
in its willStart hook.

```javascript
class MyCalendarComponent extends owl.Component {
    ...

    willStart() {
        return utils.lazyLoad('static/libs/fullcalendar/fullcalendar.js');
    }
    ...
}
```

This may be dangerous (to stop the rendering waiting for the network), but it is
extremely powerful as well, as demonstrated by the Odoo Web Client.

Lazy loading static libraries can obviously be done with React/Vue, but it is
more convoluted. For example, in Vue, you need to use a dynamic import keyword
that needs to be transpiled at build time in order for the component to be loaded
asynchronously (see [the documentation](https://vuejs.org/v2/guide/components-dynamic-async.html#Async-Components)).

## Reactiveness

React has a simple model: whenever the state changes, it is
replaced with a new state (via the `setState` method). Then, the DOM is patched.
This is simple, efficient, and a little bit awkward to write.

Vue is a little bit different: it replace magically the properties in the state
by getters/setters. With that, it can notify components whenever the state that
they read was changed.

Owl is closer to vue: it also tracks magically the state properties, but it does
only increment an internal counter whenever it changes. Note that it is done
with a `Proxy`, which means that it is totally transparent to the developers.
Adding new keys is supported. Once any part of the state has been changed, a
rendering is scheduled in the next microtask tick (promise queue).

## State Management

Managing the state of an application is a tricky issue. Many solutions have
been proposed these last few years. It also depends on the kind of application we
are talking about. A small application may not need much more than a simple
object to contain its state.

However, there are some common solutions for React and Vue: redux and vuex.
Both of them are a centralized store that own the state, and they dictate how
the state can be mutated.

**Redux**

In Redux, the state is mutated by reducers. Reducers are functions
that modify the state by returning a different object:

```javascript
  ...
  switch (action.type) {
    case ADD_TODO: {
      const { id, content } = action.payload;
      return {
        ...state,
        allIds: [...state.allIds, id],
        byIds: {
          ...state.byIds,
          [id]: {
            content,
            completed: false
          }
        }
      };
    }
```

This is a little bit awkward to write, but this allows the component system to
check if a part of the state was changed. This is exactly what is done by the
`connect` function: it create a _connected_ component, which is subscribed to
the state and triggers a rerender if some part of the state was modified.

**VueX**

VueX is based on a different principle: the state is mutated through
some special functions (the mutations), which modify the state in place:

```javascript
    function ({state}, payload) {
        const { id, content } = payload;
        const message = {id, content, completed: false};
        state.messages.push(message)
    }
```

This is simpler, but there is a little bit more happening behind the scene:
each key from the state is silently replaced by getters and setters, and VueX
keeps track of who get data, and retrigger a render when it was changed.

**Owl**

Owl store is a little bit like a mix of redux and vuex: it has actions (but not
mutations), and like VueX, it keeps track of the state changes. However, it does
not notify a component when the state changes. Instead, components need to connect
to the store like in redux, with the `useStore` hook (see the [store documentation](../reference/store.md#connecting-a-component)).

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

class Counter extends Component {
  static template = xml`
      <button t-name="Counter" t-on-click="dispatch('increment')">
        Click Me! [<t t-esc="counter.value"/>]
      </button>`;
  counter = useStore(state => state.counter);
  dispatch = useDispatch();
}

Counter.env.store = store;
const counter = new Counter();
```

## Hooks

[Hooks](https://reactjs.org/docs/hooks-intro.html#motivation) recently took over
the React world. They solve a lot of seemingly unconnected problems: attach
reusable behavior to a component, in a composable way, extract stateful logic
from a component or reuse stateful logic between component, without changing your
component hierarchy.

Here is an example of the React `useState` hook:

```js
import React, { useState } from "react";

function Example() {
  // Declare a new state variable, which we'll call "count"
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
    </div>
  );
}
```

Because of the way React designed the hooks API, they only work for functional
components. But in that case, they really are powerful. Every major React library
is in the process of redesigning their API with hooks (for example,
[Redux](https://react-redux.js.org/next/api/hooks)).

Vue 2 does not have hooks, but the Vue project is working on its next version,
which will feature its new [composition API](https://vue-composition-api-rfc.netlify.com/).
This work is based on the new ideas introduced by React hooks.

From the way React and Vue introduce their hooks, it may look like hooks are not
compatible with class components. However, this is not the case, as shown by
Owl [hooks](../reference/hooks.md). They are inspired by both React and Vue. For example,
the `useState` hook is named after React, but its API is closer to the `reactive`
Vue hook.

Here is what the `Counter` example above look like in Owl:

```js
import { Component, Owl } from "owl";
import { xml } from "owl/tags";

class Example extends Component {
  static template = xml`
      <div>
        <p>You clicked {count.value} times</p>
        <button t-on-click="increment">Click me</button>
      </div>`;

  count = useState({ value: 0 });

  increment() {
    this.state.value++;
  }
}
```

Since the Owl framework had hooks from early in its life, its main APIs
are designed to be interacted with hooks from the start. For example, the
`Context` and `Store` abstractions.
