# 🦉 Owl Component 🦉

## Content

- [Overview](#overview)
- [Properties and methods](#properties-and-methods)
- [Static Properties](#static-properties)
- [Lifecycle](#lifecycle)
  - [`setup`](#setup)
  - [`willStart`](#willstart)
  - [`mounted`](#mounted)
  - [`willPatch`](#willpatch)
  - [`patched`](#patched)
  - [`willUnmount`](#willunmount)
  - [`willDestroy`](#willdestroy)
  - [`onError`](#onerror)
- [Sub components](#sub-components)
- [Dynamic Sub components](#dynamic-sub-components)
- [`status` helper](#status-helper)

## Overview

An Owl component is a small class which represents some part of the user interface.
It is part of a component tree.

OWL components are defined by subclassing the `Component` class. For example,
here is how a `Counter` component could be implemented:

```javascript
const { Component, xml, signal } = owl;

class Counter extends Component {
  static template = xml`
    <button t-on-click="this.increment">
      Click Me! [<t t-out="this.count()"/>]
    </button>`;

  count = signal(0);

  increment() {
    this.count.set(this.count() + 1);
  }
}
```

In this example, we use the `xml` helper to define inline templates, and a
`signal` to hold reactive state (see the page on [reactivity](reactivity.md)).

## Properties and methods

The `Component` base class has a very small API. It does not define any
instance properties by default — it is up to each component to declare what
it needs.

To access props given by the parent, a component must explicitly import them
using the `props` function. The result can be stored on any property name:

```js
class MyComponent extends Component {
  static template = xml`<span t-out="this.myProps.name"/>`;

  myProps = props({ name: t.string() });
}
```

Note that props are owned by the parent, not by the component. As such, they
should not be modified by the component. See the [props page](props.md) for
more information.

## Static Properties

- **`template (string)`**: this is the name of the template that
  will render the component. Note that there is a helper `xml` to
  make it easy to define an inline template.

* **`components (object, optional)`**: if given, this is an object that contains
  the classes of any sub components needed by the template.

  ```js
  class ParentComponent extends Component {
    static components = { SubComponent };
  }
  ```

## Lifecycle

A solid and robust component system needs a complete lifecycle system to help
developers write components. Here is a complete description of the lifecycle of
a Owl component:

| Method                          | Hook            | Description                                                            |
| ------------------------------- | --------------- | ---------------------------------------------------------------------- |
| **[setup](#setup)**             | none            | setup                                                                  |
| **[willStart](#willstart)**     | `onWillStart`   | async, before first rendering                                          |
| **[mounted](#mounted)**         | `onMounted`     | just after component is rendered and added to the DOM                  |
| **[willPatch](#willpatch)**     | `onWillPatch`   | just before the DOM is patched                                         |
| **[patched](#patched)**         | `onPatched`     | just after the DOM is patched                                          |
| **[willUnmount](#willunmount)** | `onWillUnmount` | just before removing component from DOM                                |
| **[willDestroy](#willdestroy)** | `onWillDestroy` | just before component is destroyed                                     |
| **[error](#onerror)**           | `onError`       | catch and handle errors (see [error handling page](error_handling.md)) |

### `setup`

_setup_ is run just after the component is constructed. It is a lifecycle method,
very similar to the _constructor_, except that it does not receive any argument.

It is the proper place to call hook functions. Note that one of the main reason to
have the `setup` hook in the component lifecycle is to make it possible to
monkey patch it. It is a common need in the Odoo ecosystem.

```javascript
setup() {
  useSetupAutofocus();
}
```

### `willStart`

`willStart` is an asynchronous hook that can be implemented to
perform some (most of the time asynchronous) action before the initial rendering of a component.

It will be called exactly once before the initial rendering. It is useful
in some cases, for example, to load external assets (such as a JS library)
before the component is rendered. Another use case is to load data from a server.

The `onWillStart` hook is used to register a function that will be executed at
this moment:

```javascript
  setup() {
    onWillStart(async () => {
      this.data = await this.loadData()
    });
  }
```

At this point, the component is not yet rendered. Note that slow `willStart`
code will slow down the rendering of the user interface. Therefore, some care
should be made to make this method as fast as possible.

Note that if there are more than one `onWillStart` registered callback, then they
will all be run in parallel.

### `mounted`

The `mounted` hook is called each time a component is attached to the
DOM, after the initial rendering. At this point, the component is considered
_active_. This is a good place to add some listeners, or to interact with the
DOM, if the component needs to perform some measure for example.

It is the opposite of `willUnmount`. If a component has been mounted, it will
always be unmounted at some point in the future.

The mounted method will be called recursively on each of its children. First,
children, then parents.

It is allowed (but not encouraged) to modify the state in the `mounted` hook.
Doing so will cause a rerender, which will not be perceptible by the user, but
will slightly slow down the component.

The `onMounted` hook is used to register a function that will be executed at
this moment:

```javascript
  setup() {
    onMounted(() => {
      // do something here
    });
  }
```

### `willPatch`

The willPatch hook is called just before the DOM patching process starts.
It is not called on the initial render. This is useful to read
information from the DOM. For example, the current position of the
scrollbar.

Note that modifying the state is not allowed here. This method is called just
before an actual DOM patch, and is only intended to be used to save some local
DOM state. Also, it will not be called if the component is not in the DOM.

The `onWillPatch` hook is used to register a function that will be executed at
this moment:

```javascript
  setup() {
    onWillPatch(() => {
      this.scrollState = this.getScrollSTate();
    });
  }
```

The `willPatch` is called in the usual parent->children order.

### `patched`

This hook is called whenever a component did actually update its DOM (most
likely via a change in its state or props).

This method is not called on the initial render. It is useful to interact
with the DOM (for example, through an external library) whenever the
component was patched. Note that this hook will not be called if the component is
not in the DOM.

The `onPatched` hook is used to register a function that will be executed at
this moment:

```javascript
  setup() {
    onPatched(() => {
      this.scrollState = this.getScrollSTate();
    });
  }
```

Updating the component state in this hook is possible, but not encouraged.
One needs to be careful, because updates here will create an additional rendering, which in
turn will cause other calls to the `patched` method. So, we need to be particularly
careful at avoiding endless cycles.

Like `mounted`, the `patched` hook is called in the order: children first, then
parent.

### `willUnmount`

`willUnmount` is a hook that is called each time just before a component is
unmounted from the DOM. This is a good place to remove listeners, for example.

The `onWillUnmount` hook is used to register a function that will be executed at
this moment:

```javascript
  setup() {
    onMounted(() => {
      // add some listener
    });
    onWillUnmount(() => {
      // remove listener
    });
  }
```

This is the opposite method of `mounted`. Note that if a component is destroyed
before being mounted, the `willUnmount` method may not be called.

Parent `willUnmount` hooks will be called before children.

### `willDestroy`

Sometimes, components need to do some action in the `setup` and clean it up when
they are inactive. However, the `willUnmount` hook is not appropriate for the
cleaning operation, since the component may be destroyed before it has even been
mounted. The `willDestroy` hook is useful in that situation, since it is always
called.

The `onWillDestroy` hook is used to register a function that will be executed at
this moment:

```javascript
  setup() {
    onWillDestroy(() => {
      // do some cleanup
    });
  }
```

The `willDestroy` hooks are first called on children, then on parents.

### `onError`

Sadly, it may happen that components crashes at runtime. This is an unfortunate
reality, and this is why Owl needs to provide a way to handle these errors.

The `onError` hook is useful when we need to intercept and properly react
to errors that occur in some sub components. See the page on
[error handling](error_handling.md) for more detail.

```javascript
  setup() {
    onError(() => {
      // do something
    });
  }
```

## Sub components

It is convenient to define a component using other (sub) components. This is
called composition, and is very powerful in practice. To do that in Owl, one
can just use a tag starting with a capital letter in its template, and register
the sub component class in its static `components` object:

```js
class Child extends Component {
  static template = xml`<div>child component <t t-out="this.props.value"/></div>`;
}

class Parent extends Component {
  static template = xml`
    <div>
      <Child value="1"/>
      <Child value="2"/>
    </div>`;

  static components = { Child };
}
```

This example also shows how one can pass information from the parent component
to the child component, as props. See the [props section](props.md)
for more information.

## Dynamic sub components

It is not common, but sometimes we need a dynamic component name. In this case,
the `t-component` directive can also be used to accept dynamic values. This should
be an expression that evaluates to a component class. For example:

```js
class A extends Component {
  static template = xml`<div>child a</div>`;
}
class B extends Component {
  static template = xml`<span>child b</span>`;
}
class Parent extends Component {
  static template = xml`<t t-component="this.myComponent"/>`;

  state = proxy({ child: "a" });

  get myComponent() {
    return this.state.child === "a" ? A : B;
  }
}
```

## `status` helper

It is sometimes convenient to have a way to find out in which state a component
is currently. To do that, one can use the `status` helper:

```js
const { status } = owl;
// assume component is an instance of a Component

console.log(status(component));
// logs either:
// - 'new', if the component is new and has not been mounted yet
// - 'mounted', if the component is currently mounted
// - 'cancelled', if the component has not been mounted yet but will be destroyed soon
// - 'destroyed' if the component is currently destroyed
```
