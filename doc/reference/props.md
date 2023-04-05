# 🦉 Props 🦉

## Content

- [Overview](#overview)
- [Definition](#definition)
- [Props comparison](#props-comparison)
- [Binding function props](#binding-function-props)
- [Dynamic Props](#dynamic-props)
- [Default Props](#default-props)
- [Props validation](#props-validation)
- [Good Practices](#good-practices)

## Overview

In Owl, `props` (short for _properties_) is an object which contains every piece
of data given to a component by its parent.

```js
class Child extends Component {
  static template = xml`<div><t t-esc="props.a"/><t t-esc="props.b"/></div>`;
}

class Parent extends Component {
  static template = xml`<div><Child a="state.a" b="'string'"/></div>`;
  static components = { Child };
  state = useState({ a: "fromparent" });
}
```

In this example, the `Child` component receives two props from its parent: `a`
and `b`. They are collected into a `props` object by Owl, with each value being
evaluated in the context of the parent. So, `props.a` is equal to `'fromparent'` and
`props.b` is equal to `'string'`.

Note that `props` is an object that only makes sense from the perspective of the
child component.

## Definition

The `props` object is made of every attributes defined on the template, with the
following exceptions:

- every attribute starting with `t-` are not props (they are QWeb directives),

In the following example:

```xml
<div>
    <ComponentA a="state.a" b="'string'"/>
    <ComponentB t-if="state.flag" model="model"/>
</div>
```

the `props` object contains the following keys:

- for `ComponentA`: `a` and `b`,
- for `ComponentB`: `model`,

## Props comparison

Whenever Owl encounters a subcomponent in a template, it performs a shallow
comparison of all props. If they are all referentially equal, then the subcomponent
will not even be updated. Otherwise, if at least one props has changed, then
Owl will update it.

However, in some cases, we know that two values are different, but they have the
same effect, and should not be considered different by Owl. For example, anonymous
functions in a template are always different, but most of them should not be
considered different:

```xml
<t t-foreach="todos" t-as="todo" t-key="todo.id">
  <Todo todo="todo" onDelete="() => deleteTodo(todo.id)" />
</t>
```

In that case, one can use the `.alike` suffix:

```xml
<t t-foreach="todos" t-as="todo" t-key="todo.id">
  <Todo todo="todo" onDelete.alike="() => deleteTodo(todo.id)" />
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
  <Todo todo="todo" toggle.alike="() => toggleTodo(todo.isCompleted)" />
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
      <Child callback="doSomething"/>
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
      <Child callback.bind="doSomething"/>
    </div>`;

  doSomething() {
    // ...
  }
}
```

The `.bind` suffix also implies `.alike`, so these props will not cause additional
renderings.

## Dynamic Props

The `t-props` directive can be used to specify totally dynamic props:

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

## Default Props

If the static `defaultProps` property is defined, it will be used to complete
props received by the parent, if missing.

```js
class Counter extends owl.Component {
  static defaultProps = {
    initialValue: 0,
  };
  ...
}
```

In the example above, the `initialValue` props is now by default set to 0.

## Props Validation

As an application becomes complex, it may be quite unsafe to define props in an informal way. This leads to two issues:

- hard to tell how a component should be used, by looking at its code.
- unsafe, it is easy to send wrong props into a component, either by refactoring a component, or one of its parents.

A props type system solves both issues, by describing the types and shapes
of the props. Here is how it works in Owl:

- `props` key is a static key (so, different from `this.props` in a component instance)
- it is optional: it is ok for a component to not define a `props` key.
- props are validated whenever a component is created/updated
- props are only validated in `dev` mode (see [how to configure an app](app.md#configuration))
- if a key does not match the description, an error is thrown
- it validates keys defined in (static) `props`. Additional keys given by the
  parent will cause an error (unless the special prop `*` is present).
- it is an object or a list of strings
- a list of strings is a simplified props definition, which only lists the name
  of the props. Also, if the name ends with `?`, it is considered optional.
- all props are by default required, unless they are defined with `optional: true`
  (in that case, it is only done if there is a value)
- valid types are: `Number, String, Boolean, Object, Array, Date, Function`, and all
  constructor functions (so, if you have a `Person` class, it can be used as a type)
- arrays are homogeneous (all elements have the same type/shape)

For each key, a `prop` definition is either a boolean, a constructor, a list of constructors, or an object:

- a boolean: indicate that the props exists, and is mandatory.
- a constructor: this should describe the type, for example: `id: Number` describe
  the props `id` as a number
- an object describing a value as type. This is done by using the `value` key. For example, `{value: false}` specifies that the corresponding value should be equal to false.
- a list of constructors. In that case, this means that we allow more than one
  type. For example, `id: [Number, String]` means that `id` can be either a string
  or a number.
- an object. This makes it possible to have more expressive definition. The following sub keys are then allowed (but not mandatory):
  - `type`: the main type of the prop being validated
  - `element`: if the type was `Array`, then the `element` key describes the type of each element in the array. If it is not set, then we only validate the array, not its elements,
  - `shape`: if the type was `Object`, then the `shape` key describes the interface of the object. If it is not set, then we only validate the object, not its elements,
  - `values`: if the type was `Object`, then the `values` key describes the interface of values in the object, this allows validating objects that are used as mappings, where keys are not known in advance but the shape of the values is.
  - `validate`: this is a function which should return a boolean to determine if
    the value is valid or not. Useful for custom validation logic.
  - `optional`: if true, the prop is not mandatory

There is a special `*` prop that means that additional prop are allowed. This is
sometimes useful for generic components that will propagate some or all their
props to their child components.

Note that default values cannot be defined for a mandatory props. Doing so will
result in a prop validation error.

Examples:

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
      element: {type: Object, shape: {id: Boolean, text: String }
    },
   date: Date,
   combinedVal: [Number, Boolean],
   optionalProp: { type: Number, optional: true }
  };

  ...
}
```

```js
  // only the existence of those 3 keys is documented
  static props = ['message', 'id', 'date'];
```

```js
  // only the existence of those 3 keys is documented. any other key is allowed.
  static props = ['message', 'id', 'date', '*'];
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
    someObj3: {
      type: Object,
      values: { type: Array, element: String },
    }, // object with arbitary keys where values are arrays of strings
    someFlag: Boolean,     // a boolean, mandatory (even if `false`)
    someVal: [Boolean, Date],   // either a boolean or a date
    otherValue: true,     // indicates that it is a prop
    kindofsmallnumber: {
      type: Number,
      validate: n => (0 <= n && n <= 10)
    },
    size: {
      validate:  e => ["small", "medium", "large"].includes(e)
    },
    someId: [Number, {value: false}], // either a number or false
  };
```

Note: the props validation code is done by using the [validate utility function](utils.md#validate).

## Good Practices

A `props` object is a collection of values that come from the parent. As such,
they are owned by the parent, and should never be modified by the child:

```js
class MyComponent extends Component {
  constructor(parent, props) {
    super(parent, props);
    props.a.b = 43; // Never do that!!!
  }
}
```

Props should be considered readonly, from the perspective of the child component.
If there is a need to modify them, then the request to update them should be
sent to the parent (for example, with an event).

Any value can go in a props. Strings, objects, classes, or even callbacks could
be given to a child component (but then, in the case of callbacks, communicating
with events seems more appropriate).
