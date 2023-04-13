# 🦉 Hooks 🦉

## Content

- [Overview](#overview)
- [The Hook Rule](#the-hook-rule)
- [Lifecycle hooks](#lifecycle-hooks)
- [Other hooks](#other-hooks)
  - [`useState`](#usestate)
  - [`useRef`](#useref)
  - [`useSubEnv` and `useChildSubEnv`](#usesubenv-and-usechildsubenv)
  - [`useExternalListener`](#useexternallistener)
  - [`useComponent`](#usecomponent)
  - [`useEnv`](#useenv)
  - [`useEffect`](#useeffect)
- [Example: Mouse Position](#example-mouse-position)

## Overview

Hooks were popularised by React as a way to solve the following issues:

- help reusing stateful logic between components
- help organizing code by feature in complex components
- use state in functional components, without writing a class.

Owl hooks serve the same purpose, except that they work for class components
(note: React hooks do not work on class components, and maybe because of that,
there seems to be the misconception that hooks are in opposition to class. This
is clearly not true, as shown by Owl hooks).

Hooks work beautifully with Owl components: they solve the problems mentioned
above, and in particular, they are the perfect way to make your component
reactive.

## The Hook Rule

There is only one rule: every hook for a component has to be called in the _setup_ method, or in class fields:

```js
// ok
class SomeComponent extends Component {
  state = useState({ value: 0 });
}

// also ok
class SomeComponent extends Component {
  setup() {
    this.state = useState({ value: 0 });
  }
}

// not ok: this is executed after the constructor is called
class SomeComponent extends Component {
  async willStart() {
    this.state = useState({ value: 0 });
  }
}
```

## Lifecycle Hooks

All lifecycle hooks are documented in detail in their specific [section](component.md#lifecycle).

| Hook                                                  | Description                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| **[onWillStart](component.md#willstart)**             | async, before first rendering                                          |
| **[onWillRender](component.md#willrender)**           | just before component is rendered                                      |
| **[onRendered](component.md#rendered)**               | just after component is rendered                                       |
| **[onMounted](component.md#mounted)**                 | just after component is rendered and added to the DOM                  |
| **[onWillUpdateProps](component.md#willupdateprops)** | async, before props update                                             |
| **[onWillPatch](component.md#willpatch)**             | just before the DOM is patched                                         |
| **[onPatched](component.md#patched)**                 | just after the DOM is patched                                          |
| **[onWillUnmount](component.md#willunmount)**         | just before removing component from DOM                                |
| **[onWillDestroy](component.md#willdestroy)**         | just before component is destroyed                                     |
| **[onError](component.md#onerror)**                   | catch and handle errors (see [error handling page](error_handling.md)) |

## Other Hooks

### `useState`

The `useState` hook is certainly the most important hook for Owl components:
this is what allows a component to be reactive, to react to state change.

The `useState` hook has to be given an object or an array, and will return
an observed version of it (using a `Proxy`).

```javascript
const { useState, Component } = owl;

class Counter extends Component {
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

It is important to remember that `useState` only works with objects or arrays. It
is necessary, since Owl needs to react to a change in state.

### `useRef`

The `useRef` hook is useful when we need a way to interact with some inside part
of a component, rendered by Owl. It only work on a html element tagged by the
`t-ref` directive:

```xml
<div>
    <input t-ref="someInput"/>
    <span>hello</span>
</div>
```

In this example, the component will be able to access the `input` with the `useRef` hook:

```js
class Parent extends Component {
  inputRef = useRef("someInput");

  someMethod() {
    // here, if component is mounted, refs are active:
    // - this.inputRef.el is the input HTMLElement
  }
}
```

As shown by the example above, the actual HTMLElement instance is accessed with
the `el` key.

The `t-ref` directive also accepts dynamic values with string interpolation
(like the [`t-attf-`](templates.md#dynamic-attributes) and
`t-component` directives). For example,

```xml
<div t-ref="div_{{someCondition ? '1' : '2'}}"/>
```

Here, the references need to be set like this:

```js
this.ref1 = useRef("div_1");
this.ref2 = useRef("div_2");
```

References are only guaranteed to be active while the parent component is mounted.
If this is not the case, accessing `el` on it will return `null`.

### `useSubEnv` and `useChildSubEnv`

The environment is sometimes useful to share some common information between
all components. But sometimes, we want to _scope_ that knowledge to a subtree.

For example, if we have a form view component, maybe we would like to make some
`model` object available to all sub components, but not to the whole application.
This is where the `useChildSubEnv` hook may be useful: it lets a component add some
information to the environment in a way that only its children
can access it:

```js
class FormComponent extends Component {
  setup() {
    const model = makeModel();
    // model will be available on this.env for this component and all children
    useSubEnv({ model });
    // someKey will be available on this.env for all children
    useChildSubEnv({ someKey: "value" });
  }
}
```

The `useSubEnv` and `useChildSubEnv` hooks take one argument: an object which
contains some key/value that will be added to the current environment. These hooks
will create a new env object with the new information:

- `useSubEnv` will assign this new `env` to itself and to all children components
- `useChildSubEnv` will only assign this new `env` to all children components.

As usual in Owl, [environments](environment.md) created with these two hooks are
frozen, to prevent unwanted modifications.

Note that both these hooks can be called an arbitrary number of times. The `env`
will then be updated accordingly.

### `useExternalListener`

The `useExternalListener` hook helps solve a very common problem: adding and removing
a listener on some target whenever a component is mounted/unmounted. For example,
a dropdown menu (or its parent) may need to listen to a `click` event on `window`
to be closed:

```js
useExternalListener(window, "click", this.closeMenu);
```

### `useComponent`

The `useComponent` hook is useful as a building block for some customized hooks,
that may need a reference to the component calling them.

```js
function useSomething() {
  const component = useComponent();
  // now, component is bound to the instance of the current component
}
```

### `useEnv`

The `useEnv` hook is useful as a building block for some customized hooks,
that may need a reference to the env of the component calling them.

```js
function useSomething() {
  const env = useEnv();
  // now, env is bound to the env of the current component
}
```

### `useEffect`

This hook will run a callback when a component is mounted and patched, and
will run a cleanup function before patching and before unmounting the
the component (only if some dependencies have changed).

It has almost the same API as the React `useEffect` hook, except that the dependencies
are defined by a function instead of just the dependencies.

The `useEffect` hook takes two function: the effect function and the dependency
function. The effect function perform some task and return (optionally) a cleanup
function. The dependency function returns a list of dependencies, these dependencies
are passed as parameters in the effect function . If any of these
dependencies changes, then the current effect will be cleaned up and reexecuted.

Here is an example without any dependencies:

```js
useEffect(
  () => {
    window.addEventListener("mousemove", someHandler);
    return () => window.removeEventListener("mousemove", someHandler);
  },
  () => []
);
```

In the example above, the dependency list is empty, so the effect is only cleaned
up when the component is unmounted.

If the dependency function is skipped, then the effect will be cleaned up and
rerun at every patch.

Here is another example, of how one could implement a `useAutofocus` hook with
the `useEffect` hook:

```js
function useAutofocus(name) {
  let ref = useRef(name);
  useEffect(
    (el) => el && el.focus(),
    () => [ref.el]
  );
}
```

This hook takes the name of a valid `t-ref` directive, which should be present
in the template. It then checks whenever the component is mounted or patched if
the reference is not valid, and in this case, it will focus the node element.
This hook can be used like this:

```js
class SomeComponent extends Component {
  static template = xml`
    <div>
        <input />
        <input t-ref="myinput"/>
    </div>`;

  setup() {
    useAutofocus("myinput");
  }
}
```

## Example: mouse position

Here is the classical example of a non trivial hook to track the mouse position.

```js
const { useState, onWillDestroy, Component } = owl;

// We define here a custom behaviour: this hook tracks the state of the mouse
// position
function useMouse() {
  const position = useState({ x: 0, y: 0 });

  function update(e) {
    position.x = e.clientX;
    position.y = e.clientY;
  }
  window.addEventListener("mousemove", update);
  onWillDestroy(() => {
    window.removeEventListener("mousemove", update);
  });

  return position;
}

// Main root component
class Root extends Component {
  static template = xml`<div>Mouse: <t t-esc="mouse.x"/>, <t t-esc="mouse.y"/></div>`;

  // this hooks is bound to the 'mouse' property.
  mouse = useMouse();
}
```

Note that we use the prefix `use` for hooks, just like in React. This is just
a convention.
