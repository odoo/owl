# Comparison with Vue/React

OWL, React and Vue have the same main feature: they allow developers to build
declarative user interfaces. To do that, all these frameworks uses a virtual dom. However, there are still obviously many differences.

In this page, we try to highlight some of these differences. Obviously, some
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

## Size

OWL is intended to be small and to work at a slightly lower level of abstraction
than React and Vue. Also, jQuery is not the same kind of framework, but it is interesting to compare.

| Framework                | Size (minified, gzipped) |
| ------------------------ | ------------------------ |
| OWL                      | 16kb                     |
| Vue + VueX               | 30kb                     |
| React + ReactDOM + Redux | 40kb                     |
| jQuery                   | 30kb                     |

## Class Based

Both React and Vue moved away from defining components with classes.  They prefer
a more functional approach, in particular, with the new `hooks` mechanisms.

This has some advantages and disadvantages.  But the end result is that React
and Vue both offers multiple different ways of defining new components.  In
contrast, Owl has only one mechanism: class-based components. We believe that Owl
components are fast enough for all our usecases, and making it as simple as
possible for developers is more valuable (for us).

## Tooling/Build step

OWL is designed to be easy to use in a standalone way. For various reasons,
Odoo does not want to rely on standard web tools (such as webpack), and OWL can
be used by simply adding a script tag to a page.

```html
<script src="owl.min.js" />
```

In comparison, React encourages using JSX,
which necessitate a build step, and most Vue applications uses single file
components, which also necessitate a build step.

On the flipside, external tooling may make it harder to use in some case, but it
also brings a lot of benefits. And React/Vue have both a large ecosystem.

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
some JSX code, which is precompiled into plain JavaScript by a build step.

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
more convoluted.

## Reactiveness

React has a simple model: whenever the state changes, it is
replaced with a new state (via the setState method). Then, the DOM is patched.
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
to the store like in redux, by inheriting the `ConnectedComponent` class.

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