## Window Z-Index Management

When multiple windows are open, clicking on a window should bring it to the
front. Right now, windows just stack in the order they were opened. In this
step, you will add z-index management to the window system.

Here is what you need to do:

- Add a `zIndex` **signal** to each window descriptor in the `WindowManagerPlugin`
- When a window is opened, set its `zIndex` to `signal(nextValue)`
- In the `Window` template, use `t-att-style` to set the `z-index` CSS
  property from the window's `zIndex`
- Add an `activate(id)` method to the plugin that sets the window's `zIndex`
  to the next value, bringing it to the front
- In the `ManagedWindow`, call `activate` when the user presses the mouse
  button anywhere on the window (use `t-on-mousedown.capture`)

### Hints

Add a `nextZIndex` counter to the plugin:

```js
nextZIndex = 1;

open(title, component) {
    this.windows().push({
        id: this.nextId++,
        title,
        component,
        x: 60 + this.windows().length * 30,
        y: 60 + this.windows().length * 30,
        zIndex: signal(this.nextZIndex++),
    });
}

activate(id) {
    const win = this.windows().find((w) => w.id === id);
    if (win) {
        win.zIndex.set(this.nextZIndex++);
    }
}
```

Since `zIndex` is a signal, calling `.set()` automatically triggers a
re-render of any component that reads it — no manual notification needed.

Pass the `zIndex` as a prop to the `Window` component, and apply it in the
template:

```xml
<div class="window" t-att-style="'z-index:' + this.props.zIndex() + ';top:' + ...">
```

Validate it as `t.signal()` in the props definition.

Use `t-on-mousedown.capture` (not `click`) to activate the window. We use
`mousedown` because the window should come to the front as soon as the user
presses the mouse button, before it is released. We use `.capture` so the
event fires during the capture phase (top-down), before any content inside
the window can interfere with it (e.g. a button calling `stopPropagation`).

A lesser-known feature of Owl is that `t-on-` directives work on component
tags too — the event listener is attached to the component's root DOM
element:

```xml
<Window ... t-on-mousedown.capture="() => this.wm.activate(this.props.window.id)">
  ...
</Window>
```
