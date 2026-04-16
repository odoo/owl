# Hooks

## Overview

Hooks were popularised by React as a way to solve the following issues:

- help reusing stateful logic between components
- help organizing code by feature in complex components

Owl hooks serve the same purpose, and they work for class components. They
are the perfect way to make your component reactive and to encapsulate
reusable logic.

## The Hook Rule

There is only one rule: every hook for a component has to be called in the
_setup_ method, or in class fields:

```js
// ok
class SomeComponent extends Component {
  state = proxy({ value: 0 });
}

// also ok
class SomeComponent extends Component {
  setup() {
    this.state = proxy({ value: 0 });
  }
}

// not ok: this is executed after the constructor is called
class SomeComponent extends Component {
  async willStart() {
    this.state = proxy({ value: 0 });
  }
}
```

## Lifecycle Hooks

All lifecycle hooks are documented in detail in their specific
[section](component.md#lifecycle).

| Hook                                          | Description                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| **[onWillStart](component.md#willstart)**     | async, before first rendering                                          |
| **[onMounted](component.md#mounted)**         | just after component is rendered and added to the DOM                  |
| **[onWillPatch](component.md#willpatch)**     | just before the DOM is patched                                         |
| **[onPatched](component.md#patched)**         | just after the DOM is patched                                          |
| **[onWillUnmount](component.md#willunmount)** | just before removing component from DOM                                |
| **[onWillDestroy](component.md#willdestroy)** | just before component is destroyed                                     |
| **[onError](component.md#onerror)**           | catch and handle errors (see [error handling page](error_handling.md)) |

## Other Hooks

### `useEffect`

The `useEffect` hook creates an [effect](reactivity.md#effects) that is
automatically cleaned up when the component is destroyed. It is equivalent to:

```js
onWillDestroy(effect(fn));
```

The effect function runs immediately and re-runs whenever any reactive value
(signal, computed, proxy property) read during execution changes. If the effect
function returns a function, that function is called before each re-run,
allowing resource cleanup.

```js
class MyComponent extends Component {
  static template = xml`<div/>`;

  count = signal(0);

  setup() {
    useEffect(() => {
      console.log("count is", this.count());
    });
  }
}
```

Here is an example of a `useAutofocus` hook built with `useEffect`:

```js
function useAutofocus() {
  const ref = signal(null);
  useEffect(() => {
    const el = ref();
    if (el) {
      el.focus();
    }
  });
  return ref;
}
```

```js
class SomeComponent extends Component {
  static template = xml`
    <div>
        <input />
        <input t-ref="this.inputRef"/>
    </div>`;

  inputRef = useAutofocus();
}
```

### `useListener`

The `useListener` hook adds an event listener to a target and automatically
removes it when the component is destroyed. It accepts either a direct
`EventTarget` (e.g. `window`, `document`) or a signal containing an element
reference:

```js
// Listen on window — added immediately, removed on destroy
useListener(window, "click", this.closeMenu, { capture: true });

// Listen on a ref signal — effect-based, re-attaches when element changes
const ref = signal(null);
useListener(ref, "scroll", this.onScroll);
```

### `useApp`

The `useApp` hook returns the current `App` instance:

```js
setup() {
  const app = useApp();
}
```

## Example: mouse position

Here is the classical example of a non trivial hook to track the mouse position.

```js
function useMouse() {
  const position = proxy({ x: 0, y: 0 });

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

class Root extends Component {
  static template = xml`<div>Mouse: <t t-out="this.mouse.x"/>, <t t-out="this.mouse.y"/></div>`;

  mouse = useMouse();
}
```

Note that we use the prefix `use` for hooks, just like in React. This is just
a convention.
