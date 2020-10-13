# 🦉 Props 🦉

## Content

- [Overview](#overview)
- [Definition](#definition)
- [Good Practices](#good-practices)
- [Dynamic Props](#dynamic-props)

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
- `style` and `class` attributes are excluded as well (they are applied by Owl on
  the root element of the component).

In the following example:

```xml
<div>
    <ComponentA a="state.a" b="'string'"/>
    <ComponentB t-if="state.flag" model="model"/>
    <ComponentC style="color:red;" class="left-pane" />
</div>
```

the `props` object contains the following keys:

- for `ComponentA`: `a` and `b`,
- for `ComponentB`: `model`,
- for `ComponentC`: empty object

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
