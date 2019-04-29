# 🦉 OWL Component 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Templates](#templates)
- [Reference](#reference)
  - [Properties](#properties)
  - [Methods](#methods)
  - [Lifecycle](#lifecycle)

## Overview

OWL components are the building blocks for user interface. They are designed to be:

1. **declarative:** the user interface should be described in term of the state
   of the application, not as a sequence of imperative steps.

2. **composable:** each widget can seamlessly be created in a parent widget by
   a simple directive in its template.

3. **asynchronous rendering:** the framework will transparently wait for each
   subwidgets to be ready before applying the rendering. It uses native promises
   under the hood.

4. **uses QWeb as a template system:** the templates are described in XML
   and follow the QWeb specification. This is a requirement for Odoo.

OWL components are defined as a subclass of Component. The rendering is
exclusively done by a [QWeb](qweb.md) template (either defined inline or preloaded in QWeb).
The rendering is done by QWeb, which will generate a virtual dom representation
of the widget, then patch the DOM to apply the changes in an efficient way.

OWL components observe their states, and rerender themselves whenever it is
changed. This is done by an [observer](observer.md).

## Example

Let us have a look at a simple component:

```javascript
class ClickCounter extends owl.Component {
  template = "click-counter";
  state = { value: 0 };

  increment() {
    this.state.value++;
  }
}
```

```xml
<button t-name="click-counter" t-on-click="increment">
  Click Me! [<t t-esc="state.value"/>]
</button>
```

Note that this code is written in ESNext style, so it will only run on the
latest browsers without a transpilation step.

This example show how a component should be defined: it simply subclasses the
Component class. It needs to define a template (`click-counter` here). Also,
a state object is defined. It is not mandatory to use the state object, but it
is certainly encouraged. The state object is [observed](observer.md), and any
change to it will cause a rerendering.

## Templates

The example above shows a QWeb template with a `t-on-click` directive.  Widget
templates are standard [QWeb](qweb.md) templates, but with an extra directive:
`t-widget`.  With the `t-widget` directive, widget templates can declare sub
widgets:

```xml
  <div>
    <span>some text</span>
    <t t-widget="MyWidget" t-props="{info: 13}">
  </div>
```

In this example, the template create a widget MyWidget just after the span. See
the [QWeb](qweb.md) documentation for more information on the `t-widget` directive.

Note that the rendering context for the template is the widget itself.  This means
that the template can access `state`, `props`, `env`, or any methods defined in the widget.

## Reference

An Owl component is a small class which represent a widget or some UI element.
It exists in the context of an environment (`env`), which is propagated from a
parent to its children. The environment needs to have a QWeb instance, which
will be used to render the component template.

### Properties

- **`el`** (HTMLElement | null): reference to the DOM root node of the element. It is `null` when the
  component is not mounted.

- **`env`** (Object): the component environment, which contains a QWeb instance.

- **`template`** (string): a string, which is the name of the QWeb template that will render
  the component.

- **`inlineTemplate`** (string, optional): a string that represents a xml template. If set,
  this will be loaded into QWeb and used instead of the `template` property.

- **`state`** (Object): this is the location of the component's state, if there is
  any. After the willStart method, the `state` property is observed, and each
  change will cause the widget to rerender itself.

- **`props`** (Object): this is an object given (in the constructor) by the parent
  to configure the component. It can be dynamically changed later by the parent,
  in some case. Note that `props` are owned by the parent, not by the component.
  As such, it should not ever be modified by the component.

- **`refs`** (Object): the `refs` object contains all references to sub DOM nodes
  or sub widgets defined by a `t-ref` directive in the component's template.

### Methods

- **`mount(target)`** (async): this is the main way a component's hierarchy is added to the
  DOM: the root component is mounted to a target HTMLElement. Obviously, this
  is asynchronous, since each children need to be created as well. Most applications
  will need to call `mount` exactly once, on the root component.

- **`unmount()`**: in case a component need to be detached/removed from the DOM, this
  method can be used. Most applications should not call `unmount`, this is more
  useful to the underlying component system.

- **`render()`** (async): calling this method directly will cause a rerender. Note
  that this should be very rare to have to do it manually, the Owl framework is
  most of the time responsible for doing that at an appropriate moment.

  Note that the render method is asynchronous, so one cannot observe the updated
  DOM in the same stack frame.

- **`shouldUpdate(nextProps)`**: this method is called each time a component's props
  are updated. It returns a boolean, which indicates if the widget should
  ignore a props update. If it returns false, then `willUpdateProps` will not
  be called, and no rendering will occur. Its default implementation is to
  always return true. This is an optimization, similar to React's `shouldComponentUpdate`. Most of the time, this should not be used, but it
  can be useful if we are handling large number of components.

- **`updateProps(nextProps)`**: should not be called manually, except on the root
  component. This method is only supposed to be called by the framework whenever
  a parent is rerendered.

- **`updateEnv(nextEnv)`**: update the environment of a component and all its
  children. This forces a complete rerender. For example, this could be useful
  if we have a `isMobile` key in the environment, to decide if we want a mobile
  interface or a destkop one.

- **`set(target, key, value)`**. This method is necessary in some cases when we
  need to modify the state of the component in a way that is not visible to the
  observer (see [observer's technical limitations](observer.md#technical-limitations)).
  For example, if we need to add a key to the state.

- **`destroy()`**. As its name suggests, this method will remove the component,
  and perform all necessary cleanup, such as unmounting the component, its children,
  removing the parent/children relationship. This method should almost never be
  called directly (except maybe on the root component), but should be done by the
  framework instead.

### Lifecycle

A solid and robust component system needs useful hooks/methods to help
developers write components. Here is a complete description of the lifecycle of
a owl component:

| Method                                           | Description                             |
| ------------------------------------------------ | --------------------------------------- |
| **[constructor](#constructor)**                  | constructor                             |
| **[willStart](#willStart)**                      | async, before first rendering           |
| **[mounted](#mounted)**                          | when component is render and in DOM     |
| **[willUpdateProps](#willupdatepropsnextprops)** | async, before props update              |
| **[willPatch](#willpatch)**              | just before the DOM is patched          |
| **[patched](#patchedsnapshot)**                          | just after the DOM is patched           |
| **[willUnmount](#willUnmount)**                  | just before removing component from DOM |

Note: no hook method should ever be called manually. They are supposed to be
called by the owl framework whenever it is required.

#### `constructor(parent, props)`

The constructor is not exactly a hook, it is the regular,
normal, constructor of the component. Since it is not a hook, you need to make
sure that `super` is called.

This is usually where you would set the initial state and the template of the
component.

```javascript
  constructor(parent, props) {
    super(parent, props);
    this.state = {someValue: true};
    this.template = 'mytemplate';
  }
```

Note that with ESNext class fields, the constructor method does not need to be
implemented in most cases:

```javascript
class ClickCounter extends owl.Component {
  template = "click-counter";
  state = { value: 0 };

  ...
}
```

#### `willStart()`

willStart is an asynchronous hook that can be implemented to
perform some action before the initial rendering of a component.

It will be called exactly once before the initial rendering. It is useful
in some cases, for example, to load external assets (such as a JS library)
before the widget is rendered. Another use case is to load data from a server.

```javascript
  async willStart() {
    await owl.utils.loadJS("my-awesome-lib.js");
  }
```

At this point, the component is not yet rendered. Note that a slow `willStart` method will slow down the rendering of the user
interface. Therefore, some care should be made to make this method as
fast as possible.

The widget rendering will take place after `willStart` is completed.

#### `mounted()`

`mounted` is called each time a component is attached to the
DOM, after the initial rendering and possibly later if the component was unmounted
and remounted. At this point, the component is considered _active_. This is a good place to add some listeners, or to interact with the
DOM, if the component needs to perform some measure for example.

It is the opposite of `willUnmount`. If a component has been mounted, it will
always be unmounted at some point in the future.

The mounted method will be called recursively on each of its children. First,
the parent, then all its children.

Note that the state is now observed. It is however allowed (but not encouraged)
to modify the state in the `mounted` hook. Doing so will cause a rerender,
which will not be perceptible by the user, but will slightly slow down the
component.

#### `willUpdateProps(nextProps)`

The willUpdateProps is an asynchronous hook, called just before new props
are set. This is useful if the component needs some asynchronous task
performed, depending on the props (for example, assuming that the props are
some record Id, fetching the record data).

```javascript
  willUpdateProps(nextProps) {
    return this.loadData({id: nextProps.id});
  }
```

This hook is not called during the first render (but willStart is called
and performs a similar job).

#### `willPatch()`

The willPatch hook is called just before the DOM patching process starts.
It is not called on the initial render. This is useful to read some
information from the DOM. For example, the current position of the
scrollbar.

Note that modifying the state object is not allowed here. This method is called just
before an actual DOM patch, and is only intended to be used to save some local
DOM state.  Also, it will not be called if the widget is not in the DOM (this can
happen with widgets with `t-keepalive`).

The return value of this method will be given as the first argument of the
corresponding `patched` call.

#### `patched(snapshot)`

This hook is called whenever a component did actually update its DOM (most
likely via a change in its state/props or environment).

This method is not called on the initial render. It is useful to interact
with the DOM (for example, through an external library) whenever the
component was patched.  Note that this hook will not be called if the widget is
not in the DOM (this can happen with widgets with `t-keepalive`).

The `snapshot` parameter is the result of the previous `willPatch` call.

Updating the widget state in this hook is possible, but not encouraged.
One need to be careful, because updates here will cause rerender, which in
turn will cause other calls to patched. So, we need to be particularly
careful at avoiding endless cycles.

#### `willUnmount()`

willUnmount is a hook that is called each time just before a component is unmounted from
the DOM. This is a good place to remove some listeners, for example.

```javascript
  mounted() {
    this.env.bus.on('someevent', this, this.doSomething);
  }
  willUnmount() {
    this.env.bus.off('someevent', this, this.doSomething);
  }
```

This is the opposite method of `mounted`. The `willUnmount` method will be
called in reverse order: first the children, then the parents.
