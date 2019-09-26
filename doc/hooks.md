# 🦉 Hooks 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [One Rule](#one-rule)
  - [`useState`](#usestate)
  - [`onMounted`](#onmounted)
  - [`onWillUnmount`](#onwillunmount)
  - [`useRef`](#useref)

## Overview

Hooks were popularised by React as a way to solve the following issues:

- help reusing stateful logic between components
- help organizing code by feature in complex components
- use state in functional components, without writing a class.

Owl hooks serve the same purpose, except that they work for class components
(note: React hooks do not work on class components, and maybe because of that,
there seems to be the misconception that hooks are in opposition to class. This
is clearly not true, as shown by Owl hooks).

Hooks works beautifully with Owl components: they solve the problems mentioned
above, and in particular, they are the perfect way to make your component
reactive.

## Example

Here is the classical example of a non trivial hook to track the mouse position.

```js
const { useState, onMounted, onWillUnmount } = owl.hooks;

// We define here a custom behaviour: this hook tracks the state of the mouse
// position
function useMouse() {
  const position = useState({ x: 0, y: 0 });

  function update(e) {
    position.x = e.clientX;
    position.y = e.clientY;
  }
  onMounted(() => {
    window.addEventListener("mousemove", update);
  });
  onWillUnmount(() => {
    window.removeEventListener("mousemove", update);
  });

  return position;
}

// Main root component
class App extends owl.Component {
  static template = xml`
      <div t-name="App">
        <div>Mouse: <t t-esc="mouse.x"/>, <t t-esc="mouse.y"/></div>
      </div>`;

  // this hooks is bound to the 'mouse' property.
  mouse = useMouse();
}
```

Note that we use the prefix `use` for hooks, just like in React. This is just
a convention.

## Reference

### One rule

There is only one rule: every hook for a component have to be called in the
constructor (or in class fields):

```js
// ok
class SomeComponent extends Component {
  state = useState({value: 0});
}

// also ok
class SomeComponent extends Component {
  constructor(...args) {
    super(...args);
    this.state = useState({value: 0});
  }
}

// not ok: this is executed after the constructor is called
class SomeComponent extends Component {
  async willStart() {
    this.state = useState({value: 0});
  }
}
```

### `useState`

The `useState` hook is certainly the most important hooks for Owl components:
this is what enables component to be reactive, to react to state change.

The `useState` hook has to be given an object or an array, and will return
an observed version of it (using a `Proxy`).

```javascript
const { useState } = owl.hooks;

class Counter extends owl.Component {
  static template = xml`
    <button t-on-click="increment">
        Click Me! [<t t-esc="state.value"/>]
    </button>`;

  state = useState({ value: 0 });

  increment() {
    this.state.value++;
  }
}
```

### `onMounted`

`onMounted` is not an hook, but is a building block designed to help make useful
hooks. `onMounted` register a callback, which will be called when the component
is mounted (see example on top of this page).

### `onWillUnmount`

`onWillUnmount` is not an hook, but is a building block designed to help make useful
hooks. `onWillUnmount` register a callback, which will be called when the component
is unmounted (see example on top of this page).

### `useRef`

The `useRef` hook is useful when we need a way to interact with some inside part
of a component, rendered by Owl. It can work either on a DOM node, or on a component,
tagged by the `t-ref` directive:

```xml
<div>
    <div t-ref="someDiv"/>
    <SubComponent t-ref="someComponent"/>
</div>
```

In this example, the component will be able to access the `div` and the component
`SubComponent` using the `useRef` hook:

```js
class Parent extends Component {
  subRef = useRef("someComponent");
  divRef = useRef("someDiv");

  someMethod() {
    // here, if component is mounted, refs are active:
    // - this.divRef.el is the div HTMLElement
    // - this.subRef.comp is the instance of the sub component
  }
}
```

As shown by the example above, html elements are accessed by using the `el`
key, and components references are accessed with `comp`.

Note: if used on a component, the reference will be set in the `refs`
variable between `willPatch` and `patched`.

The `t-ref` directive also accepts dynamic values with string interpolation
(like the [`t-attf-`](qweb.md#dynamic-attributes) and
`t-component` directives). For example,

```xml
<div t-ref="component_{{someCondition ? '1' : '2'}}"/>
```

Here, the references needs to be set like this:

```js
this.ref1 = useRef("component_1");
this.ref2 = useRef("component_2");
```

References are only guaranteed to be active while the parent component is mounted.
If this is not the case, accessing `el` or `comp` on it will return `null`.
