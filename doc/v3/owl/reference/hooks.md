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
// ok: hook called in a class field
class SomeComponent extends Component {
  mouse = useMouse();
}

// also ok: hook called in setup
class SomeComponent extends Component {
  setup() {
    this.mouse = useMouse();
  }
}

// not ok: the onWillStart callback runs after the component is set up
class SomeComponent extends Component {
  setup() {
    onWillStart(async () => {
      this.mouse = useMouse();
    });
  }
}
```

(`useMouse` is a custom hook — see [the example below](#example-mouse-position).)

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

`onWillStart` and `onWillDestroy` also work inside a plugin's `setup()`.
`onWillStart` defers the owning `mount()` call (or the `providePlugins` owner
component's first render) until all plugin async initialization resolves. See
[Plugins — Async Initialization](plugins.md#async-initialization).

## Other Hooks

### `useEffect`

The `useEffect` hook creates an [effect](effects.md) that is
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
  const ref = signal.ref();
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

### `useOnChange`

The `useOnChange` hook runs a callback whenever one of the values returned by a
dependency function changes. Contrary to [`useEffect`](#useeffect), only the
dependency function is tracked: reactive values read (or written) inside the
callback do not become dependencies, so the callback cannot retrigger itself.

```js
useOnChange(dependencies, callback, options);
```

- `dependencies` is a function returning an array of values. It is the tracked
  part of the hook: it runs again whenever a reactive value read here changes.
  The resulting array is compared with the previous one (element by element),
  and the callback only runs if it actually changed.
- `callback` receives the dependencies as its arguments. Like an effect
  callback, it may return a cleanup function, which is then called before the
  next run and when the component is destroyed.
- `options.initialRun` (default: `true`): if `false`, the callback does not run
  on the initial execution, only on subsequent changes.

```js
class RecordViewer extends Component {
  static template = xml`<div t-out="this.record().name"/>`;

  props = props({ recordId: t.number() });
  record = signal(null);

  setup() {
    useOnChange(
      () => [this.props.recordId],
      (recordId) => {
        // reading/writing this.record here does not make it a dependency
        this.record.set(null);
        loadRecord(recordId).then((record) => this.record.set(record));
      }
    );
  }
}
```

Because the dependency array is compared by value, a dependency computed from
reactive values only triggers the callback when its own result changes:

```js
useOnChange(
  () => [this.count() > 10],
  (isBig) => console.log("isBig", isBig)
);
```

Here `this.count()` going from 2 to 3 does not run the callback: the dependency
is still `false`. A `useEffect` reading `this.count() > 10` would re-run on
every change of `count`.

So `useOnChange` is useful when the callback needs to read reactive values that
should _not_ trigger it, and when the dependencies are derived values. When the
dependencies are read directly and the callback needs nothing else, a plain
`useEffect` is simpler:

```js
// these are equivalent
useOnChange(
  () => [this.value()],
  (value) => console.log(value)
);
useEffect(() => console.log(this.value()));
```

### `useListener`

The `useListener` hook adds an event listener to a target and automatically
removes it when the component is destroyed. It accepts either a direct
`EventTarget` (e.g. `window`, `document`) or a signal containing an element
reference:

```js
// Listen on window — added immediately, removed on destroy
useListener(window, "click", (ev) => this.closeMenu(ev), { capture: true });

// Listen on a ref signal — effect-based, re-attaches when element changes
const ref = signal.ref();
useListener(ref, "scroll", (ev) => this.onScroll(ev));
```

> **Note:** the handler is **not** bound — it is passed as-is to
> `addEventListener`, so inside it `this` will be the event target (e.g.
> `window`), not your component. Either wrap the method in an arrow function
> (as above) or bind it explicitly:
>
> ```js
> useListener(window, "click", this.closeMenu.bind(this), { capture: true });
> ```

> **Note:** an event already being dispatched when the listener is attached is
> never delivered. A dialog displayed by a click handler is created while that
> click still bubbles, so its `window` listener would otherwise fire for the
> click that created it.

### `useApp`

The `useApp` hook returns the current `App` instance:

```js
setup() {
  const app = useApp();
}
```

### `useScope`

The `useScope` hook returns the current [`Scope`](scope.md) — the lifetime
handle for the current component or plugin. It is the primary entry point for
async cancellation (via `scope.abortSignal` or `scope.run`) and for capturing the
current scope to run code in it later.

```js
setup() {
  const scope = useScope();
  onWillStart(async () => {
    const data = await scope.run(() => fetchData());
    this.data = data;
  });
}
```

See the [Scope page](scope.md) for full details.

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
