## Dragging Windows

Windows can be opened and stacked, but they are stuck in place. In this step,
you will make windows draggable by their title bar.

Here is what you need to do:

- Convert the `x` and `y` fields in the window descriptor from plain numbers
  to **signals**, so updating them triggers a re-render
- Update the `Window` props to accept `x` and `y` as `t.signal()`, and read
  them with `()` in the template
- Add a `startDrag` method to the `Window` component that listens to
  `mousemove` and `mouseup` on the document to update `x` and `y`
- Bind `startDrag` to `t-on-mousedown` on the title bar

### Hints

First, update the plugin to use signals for `x` and `y`:

```js
open(title, component) {
    this.windows().push({
        ...
        x: signal(60 + this.windows().length * 30),
        y: signal(60 + this.windows().length * 30),
        ...
    });
}
```

In the `Window` template, read the signal values:

```xml
t-att-style="'z-index:' + ... + ';top:' + this.props.y() + 'px;left:' + this.props.x() + 'px'"
```

The drag logic works by listening to `mousemove` on the document (not on the
title bar — the mouse may move faster than the element). On `mousedown`,
record the initial mouse position and current window position. On
`mousemove`, compute the delta and update the signals:

```js
startDrag(ev) {
    const startX = ev.clientX;
    const startY = ev.clientY;
    const origX = this.props.x();
    const origY = this.props.y();

    const onMouseMove = (moveEv) => {
        this.props.x.set(origX + moveEv.clientX - startX);
        this.props.y.set(origY + moveEv.clientY - startY);
    };
    const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
}
```

Bind it to the title bar:

```xml
<div class="window-titlebar" t-on-mousedown="this.startDrag">
```

You may also want to add `user-select: none` on the desktop during drag to
prevent text selection.

## Notes

This is a common pattern for drag-and-drop: listen for `mousedown` on the
handle, then `mousemove`/`mouseup` on the document. Because the signals are
updated on every mouse move, Owl re-renders the window at its new position
in real time.
