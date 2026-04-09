# 🦉 Props 🦉

## Content

- [Overview](#overview)
- [Definition](#definition)
- [The `props` function](#the-props-function)
- [Translatable props](#translatable-props)
- [Dynamic Props](#dynamic-props)
- [Props validation](#props-validation)
- [Props comparison](#props-comparison)
- [Binding function props](#binding-function-props)
- [Good Practices](#good-practices)

## Overview

In Owl, `props` (short for _properties_) is an object which contains every piece
of data given to a component by its parent.

```js
import { Component, props, types as t, xml } from "@odoo/owl";

class Child extends Component {
  static template = xml`<span t-out="this.props.message"/>`;
  props = props({ message: t.string() });
}

class Parent extends Component {
  static template = xml`<Child message="'hello'"/>`;
  static components = { Child };
}
```

In this example, the `Child` component receives a `message` prop from its parent.
Props are collected into an object by Owl, with each value being evaluated in the
context of the parent. So, `this.props.message` is equal to `'hello'`.

The `props` function must be called at the top level of the component class body
(or inside `setup`). It returns an object with getters for each declared prop.

## Definition

Props are the attributes defined on a component tag in a template. Every
attribute that does not start with `t-` (which are QWeb directives) is
considered a prop. Each prop value is a JavaScript expression evaluated in
the context of the parent component.

```xml
<div>
    <ComponentA a="this.state.a" b="'string'"/>
    <ComponentB t-if="this.state.flag" model="this.model"/>
</div>
```

In this example:

- `ComponentA` receives props `a` and `b`,
- `ComponentB` receives prop `model` (`t-if` is a directive, not a prop).

## The `props` function

To access props inside a component, call the `props` function. It returns an
object with getters for each prop.

```js
import { Component, props, xml } from "@odoo/owl";

class MyComponent extends Component {
  static template = xml`<span t-out="this.props.name"/>`;
  props = props();
}
```

The `props` function accepts two optional arguments:

### Schema (first argument)

A schema describing the expected props. It can be:

- **nothing**: accepts any props, no validation.
- **an array of strings**: declares expected keys. Keys ending with `?` are
  optional, all others are required.
- **an object**: maps keys to [type validators](types_validation.md#validators)
  for full type checking. Keys ending with `?` are optional.

Props are validated in [dev mode](app.md#configuration) whenever the component
is created or updated. See [Props validation](#props-validation) for details.

```js
props(); // no schema
props(["name", "age?"]); // array form
props({ name: t.string(), "age?": t.number() }); // typed form
```

### Default values (second argument)

An object of default values for optional props. When a prop is not provided
by the parent (or is `undefined`), the default value is used instead.

Defaults can only be defined on **optional** props (keys ending with `?`).
Defining a default on a mandatory prop will cause a validation error.

```js
props(["color?"], { color: "red" });
props({ "color?": t.string() }, { color: "red" });
```

## Translatable props

When you need to pass a user-facing string to a subcomponent, you likely want it
to be translated. Unfortunately, because props are arbitrary expressions, it wouldn't
be practical for Owl to find out which parts of the expression are strings and translate
them, and it also makes it difficult for tooling to extract these strings to generate
terms to translate. While you can work around this issue by doing the translation in
JavaScript, or by using `t-set` with a body (the body of `t-set` is translated),
and passing the variable as a prop, this is a sufficiently common use case that Owl
provides a suffix for this purpose: `.translate`.

```xml
<t t-name="ParentComponent">
    <Child someProp.translate="some message"/>
</t>
```

Note that the content of this attribute is _NOT_ treated as a JavaScript expression:
it is treated as a string, as if it was an attribute on an HTML element, and translated
before being passed to the component. If you need to interpolate some data into the
string, you will still have to do this in JavaScript.

## Dynamic Props

The `t-props` directive can be used to specify totally dynamic props:

```xml
<div t-name="ParentComponent">
    <Child t-props="this.some.obj"/>
</div>
```

```js
class ParentComponent extends Component {
  static components = { Child };
  some = { obj: { a: 1, b: 2 } };
}
```

## Props Validation

As an application becomes complex, it may be quite unsafe to define props in an
informal way. This leads to two issues:

- hard to tell how a component should be used, by looking at its code,
- unsafe: it is easy to send wrong props into a component, either by refactoring
  a component, or one of its parents.

A prop type system solves both issues, by describing the types and shapes
of the props. Here is how it works in Owl:

- the `props` function accepts an optional schema as its first argument,
- props are validated whenever a component is created or updated,
- props are only validated in `dev` mode (see [how to configure an app](app.md#configuration)),
- if a prop does not match the schema, an error is thrown.

```js
class ProductList extends Component {
  static template = xml`...`;

  props = props({
    count: t.number(),
    items: t.array(t.object({ id: t.number(), label: t.string() })),
    "onSelect?": t.function(),
    size: t.selection(["small", "medium", "large"]),
  });
}
```

### `slots` prop

If a component that uses [slots](slots.md) also validates its props, the
`slots` prop must be explicitly included in the schema, since slots are
provided to a component [as props](slots.md#slots-and-props).

```js
class MyComponent extends Component {
  static template = xml`...`;
  props = props(["someProp", "slots?"]);
}
```

Or with type validation:

```js
class MyComponent extends Component {
  static template = xml`...`;
  props = props({
    "someProp?": t.number(),
    "slots?": t.object(),
  });
}
```

Note that it is not mandatory, if a component does not need to forward its
slots to a child, there is usually no need to mention them in the props
function.

## Props comparison

Whenever Owl encounters a subcomponent in a template, it performs a shallow
comparison of all props. If they are all referentially equal, then the subcomponent
will not even be updated. Otherwise, if at least one prop has changed, then
Owl will update it.

However, in some cases, we know that two values are different, but they have the
same effect, and should not be considered different by Owl. For example, anonymous
functions in a template are always different, but most of them should not be
considered different:

```xml
<t t-foreach="todos" t-as="todo" t-key="todo.id">
  <Todo todo="todo" onDelete="() => this.deleteTodo(todo.id)" />
</t>
```

In that case, one can use the `.alike` suffix:

```xml
<t t-foreach="todos" t-as="todo" t-key="todo.id">
  <Todo todo="todo" onDelete.alike="() => this.deleteTodo(todo.id)" />
</t>
```

This tells Owl that this specific prop should always be considered equivalent
(or, in other words, should be removed from the list of comparable props).

Note that even if most anonymous functions should probably be considered `alike`,
it is not necessarily true in all cases. It depends on what values are captured
by the anonymous function. The following example shows a case where it is probably
wrong to use `.alike`.

```xml
<t t-foreach="todos" t-as="todo" t-key="todo.id">
  <!-- Probably wrong! todo.isCompleted may change -->
  <Todo todo="todo" toggle.alike="() => this.toggleTodo(todo.isCompleted)" />
</t>
```

## Binding function props

It is common to have the need to pass a callback as a prop. Since Owl components
are class based, the callback frequently needs to be bound to its owner component.
So, one can do this:

```js
class SomeComponent extends Component {
  static template = xml`
    <div>
      <Child callback="this.doSomething"/>
    </div>`;

  setup() {
    this.doSomething = this.doSomething.bind(this);
  }

  doSomething() {
    // ...
  }
}
```

However, this is such a common use case that Owl provides a special suffix to do
just that: `.bind`. This looks like this:

```js
class SomeComponent extends Component {
  static template = xml`
    <div>
      <Child callback.bind="this.doSomething"/>
    </div>`;

  doSomething() {
    // ...
  }
}
```

The `.bind` suffix also implies `.alike`, so these props will not cause additional
renderings.

## Good Practices

A `props` object is a collection of values that come from the parent. As such,
they are owned by the parent, and should never be modified by the child.

Props should be considered readonly, from the perspective of the child component.
If there is a need to modify them, then the request to update them should be
sent to the parent (for example, with an event).

Any value can go in a prop. Strings, objects, classes, or even callbacks could
be given to a child component (but then, in the case of callbacks, communicating
with events seems more appropriate).
