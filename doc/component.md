# 🦉 OWL Component 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [Reactive System](#reactive-system)
  - [Properties](#properties)
  - [Static Properties](#static-properties)
  - [Methods](#methods)
  - [Lifecycle](#lifecycle)
  - [Root Component](#root-component)
  - [Environment](#environment)
  - [Composition](#composition)
  - [Event Handling](#event-handling)
  - [Form Input Bindings](#form-input-bindings)
  - [`t-key` Directive](#t-key-directive)
  - [Semantics](#semantics)
  - [Props Validation](#props-validation)
  - [References](#references)
  - [Slots](#slots)
  - [Asynchronous Rendering](#asynchronous-rendering)
  - [Error Handling](#error-handling)
  - [Functional Components](#functional-components)
  - [SVG components](#svg-components)

## Overview

OWL components are the building blocks for user interface. They are designed to be:

1. **declarative:** the user interface should be described in terms of the state
   of the application, not as a sequence of imperative steps.

2. **composable:** each component can seamlessly be created in a parent component by
   a simple tag or directive in its template.

3. **asynchronous rendering:** the framework will transparently wait for each
   sub components to be ready before applying the rendering. It uses native promises
   under the hood.

4. **uses QWeb as a template system:** the templates are described in XML
   and follow the QWeb specification. This is a requirement for Odoo.

OWL components are defined as a subclass of Component. The rendering is
exclusively done by a [QWeb](qweb.md) template (which needs to be preloaded in QWeb).
Rendering a component generates a virtual dom representation
of the component, which is then patched to the DOM, in order to apply the changes in an efficient way.

## Example

Let us have a look at a simple component:

```javascript
const { useState } = owl.hooks;

class ClickCounter extends owl.Component {
  state = useState({ value: 0 });

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

This example shows how a component should be defined: it simply subclasses the
Component class. If no static `template` key is defined, then
Owl will use the component's name as template name. Here,
a state object is defined, by using the `useState` hook. It is not mandatory to use the state object, but it is certainly encouraged. The result of the `useState` call is
[observed](observer.md), and any change to it will cause a rerendering.

## Reference

An Owl component is a small class which represents a component or some UI element.
It exists in the context of an environment (`env`), which is propagated from a
parent to its children. The environment needs to have a QWeb instance, which
will be used to render the component template.

Be aware that the name of the component may be significant: if a component does
not define a `template` key, then Owl will lookup in QWeb to
find a template with the component name (or one of its ancestors).

### Reactive system

OWL components are normal javascript classes.  So, changing a component internal
state does nothing more:

```js
class Counter extends Component {
    static template = xml`<div t-on-click="increment"><t t-esc="state.value"/></div>`;
    state = {value: 0};

    increment() {
        this.state.value++;
    }
}
```

Clicking on the `Counter` component defined above will call the `increment`
method, but it will not rerender the component.  To fix that, one could add an
explicit call to `render` in `increment`:

```js
    increment() {
        this.state.value++;
        this.render();
    }
```

However, it may be simple in this case, but it quickly become cumbersome, as a
component get more complex, and its internal state is modified by more than one
method.

A better way is to use the reactive system: by using the `useState` hook (see the
[hooks](hooks.md) section for more details), one can make Owl react to state
changes.  The `useState` hook generates a proxy version of an object
(this is done by an [observer](observer.md)), which allows the component to
react to any change. So, the `Counter` example above can be improved like this:

```js
const { useState } = owl.hooks;

class Counter extends Component {
    static template = xml`<div t-on-click="increment"><t t-esc="state.value"/></div>`;
    state = useState({value: 0});

    increment() {
        this.state.value++;
    }
}
```

Obviously, we can call the `useState` hook more than once:
```js
const { useState } = owl.hooks;

class Counter extends Component {
    static template = xml`
      <div>
        <span t-on-click="increment(counter1)"><t t-esc="counter1.value"/></span>
        <span t-on-click="increment(counter2)"><t t-esc="counter2.value"/></span>
      </div>`;
    counter1 = useState({value: 0});
    counter2 = useState({value: 0});

    increment(counter) {
        counter.value++;
    }
}
```

Note that hooks are subject to one important [rule](hooks.md#one-rule): they need
to be called in the constructor.

### Properties

- **`el`** (HTMLElement | null): reference to the DOM root node of the element. It is `null` when the
  component is not mounted.

- **`env`** (Object): the component environment, which contains a QWeb instance.

- **`props`** (Object): this is an object containing all the properties given by
  the parent to a child component.  For example, in the following situation,
  the parent component gives a `user` and a `color` value to the `ChildComponent`.

  ```xml
    <div>
      <ChildComponent user="state.user" color="color">
    </div>
  ```

  Note that `props` are owned by the parent, not by the component.
  As such, it should not ever be modified by the component (otherwise you risk
  unintended effects, since the parent may not be aware of the change)!!

  The `props` can be modified dynamically by the parent.  In that case, the
  component will go through the following lifecycle methods: `willUpdateProps`,
  `willPatch` and `patched`.

### Static Properties

- **`template`** (string, optional): if given, this is the name of the QWeb template that will render the component. Note that there is a helper `xml` to
  make it easy to define an inline template.

* **`components`** (Object, optional): if given, this is an object that contains
  the classes of any sub components needed by the template. This is the main way
  used by Owl to be able to create sub components.

  ```js
  class ParentComponent extends owl.Component {
    static components = { SubComponent };
  }
  ```

* **`props`** (Object, optional): if given, this is an object that describes the
  type and shape of the (actual) props given to the component. If Owl mode is
  `dev`, this will be used to validate the props each time the component is
  created/updated. See [Props Validation](#props-validation) for more information.

  ```js
  class Counter extends owl.Component {
    static props = {
      initialValue: Number,
      optional: true
    };
  }
  ```

- **`defaultProps`** (Object, optional): if given, this object define default
  values for (top-level) props. Whenever `props` are given to the object, they
  will be altered to add default value (if missing). Note that it does not
  change the initial object, a new object will be created instead.

  ```js
  class Counter extends owl.Component {
    static defaultProps = {
      initialValue: 0
    };
  }
  ```

There is another static property defined on the `Component` class: `current`.
This property is set to the currently being defined component (in the constructor).
This is the way [hooks](hooks.md) are able to get a reference to the target
component.

### Methods

We explain here all the public methods of the `Component` class.

- **`mount(target, renderBeforeRemount=false)`** (async): this is the main way a
  component is added to the DOM: the root component is mounted to a target
  HTMLElement. Obviously, this is asynchronous, since each children need to be
  created as well. Most applications will need to call `mount` exactly once, on
  the root component.

  The `renderBeforeRemount` argument is useful when a component is unmounted and remounted.
  In that case, we may want to rerender the component _before_ it is remounted, if
  we know that its state (or something in the environment, or ...) has changed.
  In that case, it should simply set to `true`.

- **`unmount()`**: in case a component needs to be detached/removed from the DOM, this
  method can be used. Most applications should not call `unmount`, this is more
  useful to the underlying component system.

- **`render()`** (async): calling this method directly will cause a rerender. Note
  that this should be very rare to have to do it manually, the Owl framework is
  most of the time responsible for doing that at an appropriate moment.

  Note that the render method is asynchronous, so one cannot observe the updated
  DOM in the same stack frame.

- **`shouldUpdate(nextProps)`**: this method is called each time a component's props
  are updated. It returns a boolean, which indicates if the component should
  ignore a props update. If it returns false, then `willUpdateProps` will not
  be called, and no rendering will occur. Its default implementation is to
  always return true. This is an optimization, similar to React's `shouldComponentUpdate`. Most of the time, this should not be used, but it
  can be useful if we are handling large number of components.

- **`destroy()`**. As its name suggests, this method will remove the component,
  and perform all necessary cleanup, such as unmounting the component, its children,
  removing the parent/children relationship. This method should almost never be
  called directly (except maybe on the root component), but should be done by the
  framework instead.

Obviously, these methods are reserved for Owl, and should not be used by Owl
users, unless they want to override them. Also, Owl reserves all method names
starting with `__`, in order to prevent possible future conflicts with user code
whenever Owl needs to change.

### Lifecycle

A solid and robust component system needs useful hooks/methods to help
developers write components. Here is a complete description of the lifecycle of
a owl component:

| Method                                           | Description                                                  |
| ------------------------------------------------ | ------------------------------------------------------------ |
| **[constructor](#constructorparent-props)**      | constructor                                                  |
| **[willStart](#willstart)**                      | async, before first rendering                                |
| **[mounted](#mounted)**                          | just after component is rendered and added to the DOM        |
| **[willUpdateProps](#willupdatepropsnextprops)** | async, before props update                                   |
| **[willPatch](#willpatch)**                      | just before the DOM is patched                               |
| **[patched](#patchedsnapshot)**                  | just after the DOM is patched                                |
| **[willUnmount](#willunmount)**                  | just before removing component from DOM                      |
| **[catchError](#catcherrorerror)**               | catch errors (see [error handling section](#error-handling)) |

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
    this.state = useState({someValue: true});
    this.template = 'mytemplate';
  }
```

Note that with ESNext class fields, the constructor method does not need to be
implemented in most cases:

```javascript
class ClickCounter extends owl.Component {
  state = useState({ value: 0 });

  ...
}
```

#### `willStart()`

willStart is an asynchronous hook that can be implemented to
perform some action before the initial rendering of a component.

It will be called exactly once before the initial rendering. It is useful
in some cases, for example, to load external assets (such as a JS library)
before the component is rendered. Another use case is to load data from a server.

```javascript
  async willStart() {
    await owl.utils.loadJS("my-awesome-lib.js");
  }
```

At this point, the component is not yet rendered. Note that a slow `willStart` method will slow down the rendering of the user
interface. Therefore, some care should be made to make this method as
fast as possible.

#### `mounted()`

`mounted` is called each time a component is attached to the
DOM, after the initial rendering and possibly later if the component was unmounted
and remounted. At this point, the component is considered _active_. This is a good place to add some listeners, or to interact with the
DOM, if the component needs to perform some measure for example.

It is the opposite of `willUnmount`. If a component has been mounted, it will
always be unmounted at some point in the future.

The mounted method will be called recursively on each of its children. First,
the parent, then all its children.

It is allowed (but not encouraged) to modify the state in the `mounted` hook.
Doing so will cause a rerender, which will not be perceptible by the user, but
will slightly slow down the component.

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

Note that modifying the state is not allowed here. This method is called just
before an actual DOM patch, and is only intended to be used to save some local
DOM state. Also, it will not be called if the component is not in the DOM (this can
happen with components with `t-keepalive`).

#### `patched(snapshot)`

This hook is called whenever a component did actually update its DOM (most
likely via a change in its state/props or environment).

This method is not called on the initial render. It is useful to interact
with the DOM (for example, through an external library) whenever the
component was patched. Note that this hook will not be called if the compoent is
not in the DOM (this can happen with components with `t-keepalive`).

Updating the component state in this hook is possible, but not encouraged.
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

#### `catchError(error)`

The `catchError` method is useful when we need to intercept and properly react
to (rendering) errors that occur in some sub components. See the section on
[error handling](#error-handling)

### Root Component

Most of the time, an Owl component will be created automatically by a tag (or the `t-component`
directive) in a template. There is however an obvious exception: the root component
of an Owl application has to be created manually:

```js
class App extends owl.Component { ... }

const qweb = new owl.QWeb(TEMPLATES);
const env = { qweb: qweb };
const app = new App(env);
app.mount(document.body);
```

The root component needs an environment.

### Environment

In Owl, an environment is an object with a `qweb` key, which has to be a
[QWeb](qweb.md) instance. This qweb instance will be used to render everything.

The environment is meant to contain (mostly) static global information and
methods for the whole application. For example, settings keys (`mode` to determine
if we are in desktop or mobile mode, or `theme`: dark or light), `rpc` methods,
session information, ...

The environment will be given to each child, unchanged, in the `env` property.
This can be very useful to share common information/methods. For example, all
rpcs can be made through a `rpc` method in the environment. This makes it very
easy to test a component.

Updating the environment is not as simple as changing a component's state: its
content is not observed, so updates will not be reflected immediately in the
user interface. There is however a mechanism to force root widgets to rerender
themselves whenever the environment is modified: one only needs to call the
`forceUpdate` method on the QWeb instance. For example, a responsive environment
could be done like this:

```js
function setupResponsivePlugin(env) {
  const isMobile = () => window.innerWidth <= 768;
  env.isMobile = isMobile();
  const updateEnv = owl.utils.debounce(() => {
    if (env.isMobile !== isMobile()) {
      env.isMobile = !env.isMobile;
      env.qweb.forceUpdate();
    }
  }, 15);
  window.addEventListener("resize", updateEnv);
}
```

### Composition

The example above shows a QWeb template with a sub component. In a template,
components are declared with a tagname corresponding to the class name. It has
to be capitalized.

```xml
<div t-name="ParentComponent">
  <span>some text</span>
  <MyComponent info="13" />
</div>
```

```js
class ParentComponent extends owl.Component {
    static components = { MyComponent: MyComponent};
    ...
}
```

In this example, the `ParentComponent`'s template creates a component `MyComponent` just
after the span. The `info` key will be added to the subcomponent's `props`. Each
`props` is a string which represents a javascript (QWeb) expression, so it is
dynamic. If it is necessary to give a string, this can be done by quoting it:
`someString="'somevalue'"`.

Note that the rendering context for the template is the component itself. This means
that the template can access `state` (if it exists), `props`, `env`, or any
methods defined in the component.

```xml
<div t-name="ParentComponent">
    <ChildComponent count="state.val" />
</div>
```

```js
class ParentComponent {
  static components = { ChildComponent };
  state = useState({ val: 4 });
}
```

Whenever the template is rendered, it will automatically create the subcomponent
`ChildComponent` at the correct place. It needs to find the reference to the
actual component class in the special static `components` key, or the class registered in
QWeb's global registry (see `register` function of QWeb). It first looks inside
the static `components` key, then fallbacks on the global registry.

_Props_: In this example, the child component will receive the object `{count: 4}` in its
constructor. This will be assigned to the `props` variable, which can be accessed
on the component (and also, in the template). Whenever the state is updated, then
the sub component will also be updated automatically.

Note that there are some restrictions on prop names: `class`, `style` and any
string which starts with `t-` are not allowed.

It is not common, but sometimes we need a dynamic component name and/or dynamic props. In this case,
the `t-component` directive can also be used to accept dynamic values with string interpolation (like the [`t-attf-`](qweb.md#dynamic-attributes) directive):

```xml
<div t-name="ParentComponent">
    <t t-component="ChildComponent{{id}}" />
</div>
```

```js
class ParentComponent {
  static components = { ChildComponent1, ChildComponent2 };
  state = { id: 1 };
}
```

And the `t-props` directive can be used to specify totally dynamic props:

```xml
<div t-name="ParentComponent">
    <Child t-props="some.obj"/>
</div>
```

```js
class ParentComponent {
  static components = { Child };
  some = { obj: { a: 1, b: 2 } };
}
```

There is an even more dynamic way to use `t-component`: its value can be an
expression evaluating to an actual component class. In that case, this is the
class that will be used to create the component:

```js
class A extends Component<any, any, any> {
  static template = xml`<span>child a</span>`;
}
class B extends Component<any, any, any> {
  static template = xml`<span>child b</span>`;
}
class App extends Component<any, any, any> {
  static template = xml`<t t-component="myComponent" t-key="state.child"/>`;

  state = { child: "a" };

  get myComponent() {
    return this.state.child === "a" ? A : B;
  }
}
```

In this example, the component `App` selects dynamically the concrete sub
component class.

**CSS and style:** there is some specific support to allow the parent to declare
additional css classes or style for the sub component: css declared in `class`, `style`, `t-att-class` or `t-att-style` will be added to the
root component element.

```xml
<div t-name="ParentComponent">
  <MyComponent class="someClass" style="font-weight:bold;" info="13" />
</div>
```

Warning: there is a small caveat with dynamic class attributes: since Owl needs
to be able to add/remove proper classes whenever necessary, it needs to be aware
of the possible classes. Otherwise, it will not be able to make the difference
between a valid css class added by the component, or some custom code, and a
class that need to be removed. This is why we only support the explicit syntax
with a class object:

```xml
<MyComponent t-att-class="{a: state.flagA, b: state.flagB}" />
```

### Event Handling

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
button.addEventListener("click", component.someMethod.bind(component));
```

The suffix (`click` in this example) is simply the name of the actual DOM
event.

A _business_ DOM event is triggered by a call to `trigger` on a component.

```xml
<MyComponent t-on-menu-loaded="someMethod" />
```

```js
 class MyComponent {
     someWhere() {
         const payload = ...;
         this.trigger('menu-loaded', payload);
     }
 }
```

The call to `trigger` generates a [_CustomEvent_](https://developer.mozilla.org/docs/Web/Guide/Events/Creating_and_triggering_events)
of type `menu-loaded` and dispatches it on the component's DOM element
(`this.el`). The event bubbles and is cancelable. The parent component listening
to event `menu-loaded` will receive the payload in its `someMethod` handler
(in the `detail` property of the event), whenever the event is triggered.

```js
 class ParentComponent {
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

### Form Input Bindings

It is very common to need to be able to read the value out of an html `input` (or
`textarea`, or `select`) in order to use it (note: it does not need to be in a
form!). A possible way to do this is to do it by hand:

```js
class Form extends owl.Component {
  state = useState({ text: "" });

  _updateInputValue(event) {
    this.state.text = event.target.value;
  }
}
```

```xml
<div>
  <input t-on-input="_updateInputValue" />
  <span t-esc="state.text" />
</div>
```

This works. However, this requires a little bit of _plumbing_ code. Also, the
plumbing code is slightly different if you need to interact with a checkbox,
or with radio buttons, or with select tags.

To help with this situation, Owl has a builtin directive `t-model`: its value
should be an observed value in the component (usually `state.someValue`). With
the `t-model` directive, we can write a shorter code, equivalent to the previous
example:

```js
class Form extends owl.Component {
  state = { text: "" };
}
```

```xml
<div>
  <input t-model="state.text" />
  <span t-esc="state.text" />
</div>
```

The `t-model` directive works with `<input>`, `<input type="checkbox">`,
`<input type="radio">`, `<textarea>` and `<select>`:

```xml
<div>
    <div>Text in an input: <input t-model="state.someVal"/></div>
    <div>Textarea: <textarea t-model="state.otherVal"/></div>
    <div>Boolean value: <input type="checkbox" t-model="state.someFlag"/></div>
    <div>Selection:
        <select t-model="state.color">
            <option value="">Select a color</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
        </select>
    </div>
    <div>
        Selection with radio buttons:
        <span>
            <input type="radio" name="color" id="red" value="red" t-model="state.color"/>
            <label for="red">Red</label>
        </span>
        <span>
            <input type="radio" name="color" id="blue" value="blue" t-model="state.color" />
            <label for="blue">Blue</label>
        </span>
    </div>
</div>
```

Like event handling, the `t-model` directive accepts some modifiers:

| Modifier  | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| `.lazy`   | update the value on the `change` event (default is on `input` event) |
| `.number` | tries to parse the value to a number (using `parseFloat`)            |
| `.trim`   | trim the resulting value                                             |

For example:

```xml
<input t-model.lazy="state.someVal" />
```

These modifiers can be combined. For instance, `t-model.lazy.number` will only
update a number whenever the change is done.

Note: the online playground has an example to show how it works.

### `t-key` Directive

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
        <t t-esc="todo.text" />
    </span>
  ```

- _`t-if`/`t-else`_

- _animations_: give a different identity to a component. Ex: thread id with
  animations on add/remove message.

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

   - component `B` is created
     1. `willStart` is called on `B`
     2. template `B` is rendered
   - component `C` is created
     1. `willStart` is called on `C`
     2. template `C` is rendered
        - component `D` is created
          1. `willStart` is called on `D`
          2. template `D` is rendered
        - component `E` is created
          1. `willStart` is called on `E`
          2. template `E` is rendered

3. component `A` is patched into a detached DOM element. This will create the actual
   component `A` DOM structure. The patching process will cause recursively the
   patching of the `B`, `C`, `D` and `E` DOM trees. (so the actual full DOM tree is created
   in one pass)

4. the component `A` root element is actually appended to `document.body`

5. The method `mounted` is called recursively on all components in the following
   order: `B`, `D`, `E`, `C`, `A`.

**Scenario 2: rerendering a component**. Now, let's assume that the user clicked on some
button in `C`, and this results in a state update, which is supposed to:

- update `D`,
- remove `E`,
- add new component `F`.

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

   - component `D` is updated:
     1. hook `willUpdateProps` is called on `D` (async)
     2. template `D` is rerendered
   - component `F` is created:
     1. hook `willStart` is called on `E` (async)
     2. template `F` is rendered

3. `willPatch` hooks are called recursively on components `C`, `D` (not on `F`,
   because it is not mounted yet)

4. component `C` is patched, which will cause recursively:

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
- it validates keys defined in (static) `props`. Additional keys given by the
  parent will cause an error.

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
  of the props. Also, if the name ends with `?`, it is considered optional.
- all props are by default required, unless they are defined with `optional: true`
  (in that case, validation is only done if there is a value)
- valid types are: `Number, String, Boolean, Object, Array, Date, Function`, and all
  constructor functions (so, if you have a `Person` class, it can be used as a type)
- arrays are homogeneous (all elements have the same type/shape)

For each key, a `prop` definition is either a boolean, a constructor, a list of constructors, or an object:

- a boolean: indicate that the props exists, and is mandatory.
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
  // size is optional
  static props = ['message', 'size?'];
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
    someVal: [Boolean, Date],   // either a boolean or a date
    otherValue: true,     // indicates that it is a prop
  };
```

### References

The `useRef` hook is useful when we need a way to interact with some inside part
of a component, rendered by Owl. It can work either on a DOM node, or on a component,
tagged by the `t-ref` directive. See the [hooks section](hooks.md#useref) for
more detail.

As a short example, here is how we could set the focus on a given input:

```xml
<div>
    <input t-ref="input"/>
    <button t-on-click="focusInput">Click</button>
</div>
```

```js
import { useRef } from "owl/hooks";

class SomeComponent extends Component {
  inputRef = useRef("input");

  focusInput() {
    this.inputRef.el.focus();
  }
}
```

The `useRef` hook can also be used to get a reference to an instance of a sub
component rendered by Owl. In that case, we need to access it with the `comp`
property instead of `el`:

```xml
<div>
    <SubComponent t-ref="sub"/>
    <button t-on-click="doSomething">Click</button>
</div>
```

```js
import { useRef } from "owl/hooks";

class SomeComponent extends Component {
  static components = { SubComponent };
  subRef = useRef("sub");

  doSomething() {
    this.subRef.comp.doSomeThingElse();
  }
}
```

Note that these two examples uses the suffix `ref` to name the reference. This
is not mandatory, but it is a useful convention, so we do not forget to access
it with the `el` or `comp` suffix.

### Slots

To make generic components, it is useful to be able for a parent component to _inject_
some sub template, but still be the owner. For example, a generic dialog component
will need to render some content, some footer, but with the parent as the
rendering context.

This is what _slots_ are for.

```xml
<div t-name="Dialog" class="modal">
  <div class="modal-title"><t t-esc="props.title"/></div>
  <div class="modal-content">
    <t t-slot="content"/>
  </div>
  <div class="modal-footer">
    <t t-slot="footer"/>
  </div>
</div>
```

Slots are defined by the caller, with the `t-set` directive:

```xml
<div t-name="SomeComponent">
  <div>some component</div>
  <Dialog title="Some Dialog">
    <t t-set="content">
      <div>hey</div>
    </t>
    <t t-set="footer">
      <button t-on-click="doSomething">ok</button>
    </t>
  </Dialog>
</div>
```

In this example, the component `Dialog` will render the slots `content` and `footer`
with its parent as rendering context. This means that clicking on the button
will execute the `doSomething` method on the parent, not on the dialog.

Default slot: the first element inside the component which is not a named slot will
be considered the `default` slot. For example:

```xml
<div t-name="Parent">
  <Child>
    <span>some content</span>
  </Child>
</div>

<div t-name="Child">
  <t t-slot="default"/>
</div>
```

### Asynchronous Rendering

Working with asynchronous code always adds a lot of complexity to a system. Whenever
different parts of a system are active at the same time, one needs to think
carefully about all possible interactions. Clearly, this is also true for Owl
components.

There are two different common problems with Owl asynchronous rendering model:

- any component can delay the rendering (initial and subsequent) of the whole
  application
- for a given component, there are two independant situations that will trigger an
  asynchronous rerendering: a change in the state, or a change in the props.
  These changes may be done at different times, and Owl has no way of knowing
  how to reconcile the resulting renderings.

Here are a few tips on how to work with asynchronous components:

1. Minimize the use of asynchronous components!
2. Maybe move the asynchronous logic in a store, which then triggers (mostly)
   synchronous renderings
3. Lazy loading external libraries is a good use case for async rendering. This
   is mostly fine, because we can assume that it will only takes a fraction of a
   second, and only once (see [`owl.utils.loadJS`](utils.md#loadjs))
4. For all the other cases, the `t-asyncroot` directive (to use alongside
   `t-component`) is there to help you. When this directive is met, a new rendering
   sub tree is created, such that the rendering of that component (and its
   children) is not tied to the rendering of the rest of the interface. It can
   be used on an asynchronous component, to prevent it from delaying the
   rendering of the whole interface, or on a synchronous one, such that its
   rendering isn't delayed by other (asynchronous) components. Note that this
   directive has no effect on the first rendering, but only on subsequent ones
   (triggered by state or props changes).

   ```xml
   <div t-name="ParentComponent">
     <SyncChild />
     <AsyncChild t-asyncroot="1"/>
   </div>
   ```

### Error Handling

By default, whenever an error occurs in the rendering of an Owl application, we
destroy the whole application. Otherwise, we cannot offer any guarantee on the
state of the resulting component tree. It might be hopelessly corrupted, but
without any user-visible state.

Clearly, it sometimes is a little bit extreme to destroy the application. This
is why we have a builtin mechanism to handle rendering errors (and errors coming
from lifecycle hooks): the `catchError` hook.

Whenever the `catchError` lifecycle hook is implemented, all errors coming from
sub components rendering and/or lifecycle method calls will be caught and given
to the `catchError` method. This allow us to properly handle the error, and to
not break the application.

For example, here is how we could implement an `ErrorBoundary` component:

```xml
<div t-name="ErrorBoundary">
    <t t-if="state.error">
        Error handled
    </t>
    <t t-else="1">
        <t t-slot="default" />
    </t>
</div>
```

```js
class ErrorBoundary extends Component {
  state = useState({ error: false });

  catchError() {
    this.state.error = true;
  }
}
```

Using the `ErrorBoundary` is then extremely simple:

```xml
<ErrorBoundary><SomeOtherComponent/></ErrorBoundary>
```

Note that we need to be careful here: the fallback UI should not throw any
error, otherwise we risk going into an infinite loop.

Also, it may be useful to know that whenever an error is caught, it is then
broadcasted to the application by an event on the `qweb` instance. It may be
useful, for example, to log the error somewhere.

```js
env.qweb.on("error", null, function(error) {
  // do something
  // react to the error
});
```

### Functional Components

Owl does not exactly have functional components. However, there is an extremely
close alternative: calling sub templates.

A stateless functional component in react is usually some kind of function that
maps props to a virtual dom (often with `jsx`). So, basically, almost like a
template rendered with `props`. In Owl, this can be done by
simply defining a template, that will access the `props` object:

```js
const Welcome = xml`<h1>Hello, {props.name}</h1>`;

class MyComponent extends Component {
  static template = xml`
        <div>
            <t t-call=${Welcome}/>
            <div>something</div>
        </div>
    `;
}
```

The way this works is that sub templates are inlined, and have access to the
ambient context. They can therefore access `props`, and any other part of the
caller component.

### SVG Components

Owl components can be used to generate dynamic SVG graphs:

```js
class Node extends Component {
  static template = xml`
        <g>
            <circle t-att-cx="props.x" t-att-cy="props.y" r="4" fill="black"/>
            <text t-att-x="props.x - 5" t-att-y="props.y + 18"><t t-esc="props.node.label"/></text>
            <t t-set="childx" t-value="props.x + 100"/>
            <t t-set="height" t-value="props.height/(props.node.children || []).length"/>
            <t t-foreach="props.node.children || []" t-as="child">
                <t t-set="childy" t-value="props.y + child_index*height"/>
                <line t-att-x1="props.x" t-att-y1="props.y" t-att-x2="childx" t-att-y2="childy" stroke="black" />
                <Node x="childx" y="childy" node="child" height="height"/>
            </t>
        </g>
    `;
  static components = { Node };
}

class RootNode extends Component {
  static template = xml`
        <svg height="180">
            <Node node="graph" x="10" y="20" height="180"/>
        </svg>
    `;
  static components = { Node };
  graph = {
    label: "a",
    children: [
      { label: "b" },
      { label: "c", children: [{ label: "d" }, { label: "e" }] },
      { label: "f", children: [{ label: "g" }] }
    ]
  };
}
```

This `RootNode` component will then display a live SVG representation of the
graph described by the `graph` property. Note that there is a recursive structure
here: the `Node` component uses itself as a subcomponent.

Note that since SVG needs to be handled in a specific way (its namespace needs
to be properly set), there is a small constraint for Owl components: if an owl
component is supposed to be a part of an svg graph, then its root node needs to
be a `g` tag, so Owl can properly set the namespace.
