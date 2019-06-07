# 🦉 OWL Component 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [Properties](#properties)
  - [Static Properties](#static-properties)
  - [Methods](#methods)
  - [Lifecycle](#lifecycle)
  - [Composition](#composition)
  - [Event Handling](#event-handling)
  - [`t-key` directive](#t-key-directive)
  - [`t-mounted` directive](#t-mounted-directive)
  - [Props Validation](#props-validation)
  - [Keeping References](#keeping-references])
  - [Asynchronous rendering](#asynchronous-rendering)

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
exclusively done by a [QWeb](qweb.md) template (which needs to be preloaded in QWeb).
Rendering a component generates a virtual dom representation
of the widget, which is then patched to the DOM, in order to apply the changes in an efficient way.

OWL components observe their states, and rerender themselves whenever it is
changed. This is done by an [observer](observer.md).

## Example

Let us have a look at a simple component:

```javascript
class ClickCounter extends owl.Component {
  state = { value: 0 };

  increment() {
    this.state.value++;
  }
}
```

```xml
<button t-name="ClickCounter" t-on-click="increment">
  Click Me! [<t t-esc="state.value"/>]
</button>
```

Note that this code is written in ESNext style, so it will only run on the
latest browsers without a transpilation step.

This example show how a component should be defined: it simply subclasses the
Component class. If no `template` key is defined, then
Owl will use the component's name as template name. Here,
a state object is defined. It is not mandatory to use the state object, but it
is certainly encouraged. The state object is [observed](observer.md), and any
change to it will cause a rerendering.

## Reference

An Owl component is a small class which represent a widget or some UI element.
It exists in the context of an environment (`env`), which is propagated from a
parent to its children. The environment needs to have a QWeb instance, which
will be used to render the component template.

Be aware that the name of the component may be significant: if a component does
not define a `template` key, then Owl will lookup in QWeb to
find a template with the component name (or one of its ancestor).

### Properties

- **`el`** (HTMLElement | null): reference to the DOM root node of the element. It is `null` when the
  component is not mounted.

- **`env`** (Object): the component environment, which contains a QWeb instance.

- **`template`** (string, optional): if given, this is the name of the QWeb template that will render
  the component.

- **`state`** (Object): this is the location of the component's state, if there is
  any. After the willStart method, the `state` property is observed, and each
  change will cause the widget to rerender itself.

- **`props`** (Object): this is an object given (in the constructor) by the parent
  to configure the component. It can be dynamically changed later by the parent,
  in some case. Note that `props` are owned by the parent, not by the component.
  As such, it should not ever be modified by the component!!

- **`refs`** (Object): the `refs` object contains all references to sub DOM nodes
  or sub widgets defined by a `t-ref` directive in the component's template.

### Static Properties

- **`props`** (Object, optional): if given, this is an object that describes the
  type and shape of the (actual) props given to the component. If Owl mode is
  `dev`, this will be used to validate the props each time the component is
  created/updated. See [Props Validation](#props-validation) for more information.
- **`defaultProps`** (Object, optional): if given, this object define default
  values for (top-level) props. Whenever `props` are given to the object, they
  will be altered to add default value (if missing). Note that it does not
  change the initial object, a new object will be created instead.

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

| Method                                           | Description                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| **[constructor](#constructor)**                  | constructor                                           |
| **[willStart](#willStart)**                      | async, before first rendering                         |
| **[mounted](#mounted)**                          | just after component is rendered and added to the DOM |
| **[willUpdateProps](#willupdatepropsnextprops)** | async, before props update                            |
| **[willPatch](#willpatch)**                      | just before the DOM is patched                        |
| **[patched](#patchedsnapshot)**                  | just after the DOM is patched                         |
| **[willUnmount](#willUnmount)**                  | just before removing component from DOM               |

Notes:

- hooks call order is precisely defined: `[willX]` hooks are called first on parent,
  then on children, and `[Xed]` are called in the reverse order: first children,
  then parent.
- no hook method should ever be called manually. They are supposed to be
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
DOM state. Also, it will not be called if the widget is not in the DOM (this can
happen with widgets with `t-keepalive`).

The return value of this method will be given as the first argument of the
corresponding `patched` call.

#### `patched(snapshot)`

This hook is called whenever a component did actually update its DOM (most
likely via a change in its state/props or environment).

This method is not called on the initial render. It is useful to interact
with the DOM (for example, through an external library) whenever the
component was patched. Note that this hook will not be called if the widget is
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

This is the opposite method of `mounted`.

## Composition

The example above shows a QWeb template with a `t-on-click` directive. Widget
templates are standard [QWeb](qweb.md) templates, but with an extra directive:
`t-widget`. With the `t-widget` directive, widget templates can declare sub
widgets:

```xml
<div t-name="ParentWidget">
  <span>some text</span>
  <t t-widget="MyWidget" info="13"/>
</div>
```

```js
class ParentWidget extends owl.Component {
    widgets = { MyWidget: MyWidget};
    ...
}
```

In this example, the `ParentWidget`'s template creates a widget `MyWidget` just
after the span. The `info` key will be added to the subwidget's props. Each
props is a string which represents a javascript (QWeb) expression, so it is
dynamic. If it is necessary to give a string, this can be done by quoting it:
`someString="'somevalue'"`. See the
[QWeb](qweb.md) documentation for more information on the `t-widget` directive.

Note that the rendering context for the template is the widget itself. This means
that the template can access `state`, `props`, `env`, or any methods defined in the widget.

The `t-widget` directive is the key to a declarative component
system. It allows a template to define where and how a sub widget is created
and/or updated. For example:

```xml
<div t-name="ParentWidget">
    <t t-widget="ChildWidget" count="state.val"/>
</div>
```

```js
class ParentWidget {
  widgets = { ChildWidget };
  state = { val: 4 };
}
```

Whenever the template is rendered, it will automatically create the subwidget
`ChildWidget` at the correct place. It needs to find the reference to the
actual component class in the special `widgets` key, or the class registered in
QWeb's global registry (see `register` function of QWeb). It first looks inside
the local `widgets` key, then fallbacks on the global registry.

_Props_: In this example, the child widget will receive the object `{count: 4}` in its
constructor. This will be assigned to the `props` variable, which can be accessed
on the widget (and also, in the template). Whenever the state is updated, then
the subwidget will also be updated automatically.

Note that there are some restrictions on prop names: `class`, `style` and any
string which starts with `t-` are not allowed.

The `t-widget` directive also accepts dynamic values with string interpolation
(like the [`t-attf-`](#dynamic-attributes-t-att-and-t-attf-directives) directive):

```xml
<div t-name="ParentWidget">
    <t t-widget="ChildWidget{{id}}"/>
</div>
```

```js
class ParentWidget {
  widgets = { ChildWidget1, ChildWidget2 };
  state = { id: 1 };
}
```

**CSS and style:** there is some specific support to allow the parent to declare
additional css classes or style for the sub widget: css declared in `class`, `style`, `t-att-class` or `t-att-style` will be added to the
root widget element.

```xml
<div t-name="ParentWidget">
  <t t-widget="MyWidget" class="someClass" style="font-weight:bold;" info="13"/>
</div>
```

Warning: there is a small caveat with dynamic class attributes: since Owl needs
to be able to add/remove proper classes whenever necessary, it needs to be aware
of the possible classes. Otherwise, it will not be able to make the difference
between a valid css class added by the component, or some custom code, and a
class that need to be removed. This is why we only support the explicit syntax
with a class object:

```xml
<t t-widget="MyWidget" t-att-class="{a: state.flagA, b: state.flagB}" />
```

### Event handling

In a component's template, it is useful to be able to register handlers on some
elements to some specific events. This is what makes a template _alive_. There
are four different use cases.

1. Register an event handler on a DOM node (_pure_ DOM event)
2. Register an event handler on a component (_pure_ DOM event)
3. Register an event handler on a DOM node (_business_ DOM event)
4. Register an event handler on a component (_business_ DOM event)

A _pure_ DOM event is directly triggered by a user interaction (e.g. a `click`).

```xml
<button t-on-click="someMethod">Do something</button>
```

This will be roughly translated in javascript like this:

```js
button.addEventListener("click", widget.someMethod.bind(widget));
```

The suffix (`click` in this example) is simply the name of the actual DOM
event.

A _business_ DOM event is triggered by a call to `trigger` on a component.

```xml
<t t-widget="MyWidget" t-on-menu-loaded="someMethod"/>
```

```js
 class MyWidget {
     someWhere() {
         const payload = ...;
         this.trigger('menu-loaded', payload);
     }
 }
```

The call to `trigger` generates a [_CustomEvent_](https://developer.mozilla.org/docs/Web/Guide/Events/Creating_and_triggering_events)
of type `menu-loaded` and dispatches it on the component's DOM element
(`this.el`). The event bubbles and is cancelable. The parent widget listening
to event `menu-loaded` will receive the payload in its `someMethod` handler
(in the `detail` property of the event), whenever the event is triggered.

```js
 class ParentWidget {
     someMethod(ev) {
         const payload = ev.detail;
         ...
     }
 }
```

By convention, we use KebabCase for the name of _business_ events.

In order to remove the DOM event details from the event handlers (like calls to
`event.preventDefault`) and let them focus on data logic, _modifiers_ can be
specified as additional suffixes of the `t-on` directive.

| Modifier   | Description                                                       |
| ---------- | ----------------------------------------------------------------- |
| `.stop`    | calls `event.stopPropagation()` before calling the method         |
| `.prevent` | calls `event.preventDefault()` before calling the method          |
| `.self`    | calls the method only if the `event.target` is the element itself |

```xml
<button t-on-click.stop="someMethod">Do something</button>
```

Note that modifiers can be combined (ex: `t-on-click.stop.prevent`), and that
the order may matter. For instance `t-on-click.prevent.self` will prevent all
clicks while `t-on-click.self.prevent` will only prevent clicks on the element
itself.

The `t-on` directive also allows to prebind some arguments. For example,

```xml
<button t-on-click="someMethod(expr)">Do something</button>
```

Here, `expr` is a valid Owl expression, so it could be `true` or some variable
from the rendering context.

### `t-key` directive

Even though Owl tries to be as declarative as possible, some DOM state is still
locked inside the DOM: for example, the scrolling state, the current user selection,
the focused element or the state of an input. This is why we use a virtual dom
algorithm to keep the actual DOM node as much as possible. However, this is
sometimes not enough, and we need to help Owl decide if an element is actually
the same, or is different. The `t-key` directive is used to give an identity to an element.

There are three main use cases:

- _elements in a list_:

  ```xml
    <span t-foreach="todos" t-as="todo" t-key="todo.id">
        <t t-esc="todo.text"/>
    </span>
  ```

- _`t-if`/`t-else`_

- _animations_: give a different identity to a component. Ex: thread id with
  animations on add/remove message.

### `t-mounted` directive

The `t-mounted` directive allows to register a callback to execute whenever the node
is inserted into the DOM.

```xml
<div><input t-ref="someInput" t-mounted="focusMe"/></div>
```

```js
class MyWidget extends owl.Component {
    ...
    focusMe() {
        this.refs.someInput.focus();
    }
}
```

### Semantics

We give here an informal description of the way components are created/updated
in an application. Here, ordered lists describe actions that are executed
sequentially, bullet lists describe actions that are executed in parallel.

**Scenario 1: initial rendering** Imagine we want to render the following component tree:

```
        A
       / \
      B   C
         / \
        D   E
```

Here is what happen whenever we mount the root
component (with some code like `app.mount(document.body)`).

1. `willStart` is called on `A`

2. when it is done, template `A` is rendered.

   - widget `B` is created
     1. `willStart` is called on `B`
     2. template `B` is rendered
   - widget `C` is created
     1. `willStart` is called on `C`
     2. template `C` is rendered
        - widget `D` is created
          1. `willStart` is called on `D`
          2. template `D` is rendered
        - widget `E` is created
          1. `willStart` is called on `E`
          2. template `E` is rendered

3. widget `A` is patched into a detached DOM element. This will create the actual
   widget `A` DOM structure. The patching process will cause recursively the
   patching of the `B`, `C`, `D` and `E` DOM trees. (so the actual full DOM tree is created
   in one pass)

4. the widget `A` root element is actually appended to `document.body`

5. The method `mounted` is called recursively on all widgets in the following
   order: `B`, `D`, `E`, `C`, `A`.

**Scenario 2: rerendering a component**. Now, let's assume that the user clicked on some
button in `C`, and this results in a state update, which is supposed to:

- update `D`,
- remove `E`,
- add new widget `F`.

So, the component tree should look like this:

```
        A
       / \
      B   C
         / \
        D   F
```

Here is what Owl will do:

1. because of a state change, the method `render` is called on `C`
2. template `C` is rendered again

   - widget `D` is updated:
     1. hook `willUpdateProps` is called on `D` (async)
     2. template `D` is rerendered
   - widget `F` is created:
     1. hook `willStart` is called on `E` (async)
     2. template `F` is rendered

3. `willPatch` hooks are called recursively on widgets `C`, `D` (not on `F`,
   because it is not mounted yet)

4. widget `C` is patched, which will cause recursively:

   2. `willUnmount` hook on `E`, then destruction of `E`,
   3. (initial) patching of `F`, then hook `mounted` is called on `F`

5. patching of `D`

6. `patched` hooks are called on `D`, `C`

### Props Validation

As an application becomes complex, it may be quite unsafe to define props in an informal way. This leads to two issues:

- hard to tell how a component should be used, by looking at its code.
- unsafe, it is easy to send wrong props into a component, either by refactoring a component, or one of its parent.

A props type system would solve both issues, by describing the types and shapes
of the props. Here is how it works in Owl:

- `props` key is a static key (so, different from `this.props` in a component instance)
- it is optional: it is ok for a component to not define a `props` key.
- props are validated whenever a component is created/updated
- props are only validated in `dev` mode (see [tooling page](tooling.md#development-mode))
- if a key does not match the description, an error is thrown
- it only validates keys defined in (static) `props`. Additional keys in (component) `props` are not validated.

For example:

```js
class ComponentA extends owl.Component {
    static props = ['id', 'url'];

    ...
}

class ComponentB extends owl.Component {
  static props = {
    count: {type: Number},
    messages: {
      type: Array,
      element: {type: Object, shape: {id: Boolean, text: 'string' }
    },
   date: Date,
   combinedVal: [Number, Boolean]
  };

  ...
}
```

- it is an object or a list of strings
- a list of strings is a simplified props definition, which only lists the name
  of the props.
- all props are by default required, unless they are defined with `optional: true`
  (in that case, validation is only done if there is a value)
- valid types are: `Number, String, Boolean, Object, Array, Date, Function`, and all
  constructor functions (so, if you have a `Person` class, it can be used as a type)
- arrays are homogeneous (all elements have the same type/shape)

For each key, a `prop` definition is either a constructor, a list of constructors, or an object:

- a constructor: this should describe the type, for example: `id: Number` describe
  the props `id` as a number
- a list of constructors. In that case, this means that we allow more than one
  type. For example, `id: [Number, String]` means that `id` can be either a string
  or a number.
- an object. This makes it possible to have more expressive definition. The following sub keys are then allowed:
  - `type`: the main type of the prop being validated
  - `element`: if the type was `Array`, then the `element` key describes the type of each element in the array. It is optional (not set means that we only validate the array, not its elements),
  - `shape`: if the type was `Object`, then the `shape` key describes the interface of the object. It is optional (not set means that we only validate the object, not its elements)

Examples:

```js
  // only the existence of those 3 keys is documented
  static props = ['message', 'id', 'date'];
```

```js
  static props = {
    messageIds: {type: Array, element: Number},  // list of number
    otherArr: {type: Array},   // just array. no validation is made on sub elements
    otherArr2: Array,   // same as otherArr
    someObj: {type: Object},  // just an object, no internal validation
    someObj2: {
      type: Object,
      shape: {
        id: Number,
        name: {type: String, optional: true},
        url: String
      ]},    // object, with keys id (number), name (string, optional) and url (string)
    someFlag: Boolean,     // a boolean, mandatory (even if `false`)
    someVal: [Boolean, Date]   // either a boolean or a date
  };
```

### Keeping references

The `t-ref` directive helps a component keep reference to some inside part of it.
Like the `t-on` directive, it can work either on a DOM node, or on a component:

```xml
<div>
    <div t-ref="someDiv"/>
    <t t-widget="SubWidget" t-ref="someWidget"/>
</div>
```

In this example, the widget will be able to access the `div` and the component
inside the special `refs` variable:

```js
this.refs.someDiv;
this.refs.someWidget;
```

This is useful for various usecases: for example, integrating with an external
library that needs to render itself inside an actual DOM node. Or for calling
some method on a sub widget.

Note: if used on a component, the reference will be set in the `refs`
variable between `willPatch` and `patched`.

The `t-ref` directive also accepts dynamic values with string interpolation
(like the [`t-attf-`](#dynamic-attributes-t-att-and-t-attf-directives) and
[`t-widget-`](#component-t-widget) directives). For example, if we have
`id` set to 44 in the rendering context,

```xml
<div t-ref="widget_{{id}}"/>
```

```js
this.refs.widget_44;
```

### Asynchronous rendering

Working with asynchronous code always adds a lot of complexity to a system. Whenever
different parts of a system are active at the same time, one needs to think
carefully about all possible interactions. Clearly, this is also true for Owl
components.

There are two different common problems with Owl asynchronous rendering model:

- any widget can delay the rendering (initial and subsequent) of the whole
  application
- for a given widget, there are two independant situations that will trigger an
  asynchronous rerendering: a change in the state, or a change in the props.
  These changes may be done at different times, and Owl has no way of knowing
  how to reconcile the resulting renderings.

Here are a few tips on how to work with asynchronous widgets:

1. minimize the use of asynchronous widgets!
2. Maybe move the asynchronous logic in a store, which then triggers (mostly)
   synchronous renderings
3. Lazy loading external libraries is a good use case for async rendering. This
   is mostly fine, because we can assume that it will only takes a fraction of a
   second, and only once (see `owl.utils.loadJS`)
