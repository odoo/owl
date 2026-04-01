## Reusable Drag and Drop

The drag logic currently lives directly in the `Window` component. But
drag-and-drop is a general pattern that could be useful elsewhere. In this
step, you will extract it into a reusable `useDragAndDrop` hook.

Here is what you need to do:

- Create a `core/utils/` folder with a `drag_and_drop.js` file
- Export a `useDragAndDrop(x, y)` function that:
  - Takes two signals (`x` and `y`) representing the position
  - Returns an object with two refs: `root` (the element to position) and
    `handle` (the element to drag from)
  - Uses `useEffect` to sync `left`/`top` styles on the root element
  - Uses `useListener` to listen for `mousedown` on the handle and
    implement the drag logic
- Update the `Window` component to use `useDragAndDrop` instead of its own
  `startDrag` method
- Remove `t-att-style` entirely from the Window template — the hook handles
  positioning directly on the DOM element, and z-index is set via a separate
  `useEffect` in the Window component. This is important because `t-att-style`
  replaces the entire `style` attribute on each render, which would overwrite
  the styles set by the hook

### Hints

The hook creates two ref signals — one for positioning, one for the drag
handle:

```js
import { signal, useEffect, useListener } from "@odoo/owl";

export function useDragAndDrop(x, y) {
    const root = signal(null);
    const handle = signal(null);

    useEffect(() => {
        const el = root();
        if (el) {
            el.style.left = x() + "px";
            el.style.top = y() + "px";
        }
    });

    useListener(handle, "mousedown", (ev) => {
        const startX = ev.clientX;
        const startY = ev.clientY;
        const origX = x();
        const origY = y();

        const onMouseMove = (moveEv) => {
            x.set(origX + moveEv.clientX - startX);
            y.set(origY + moveEv.clientY - startY);
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    return { root, handle };
}
```

`useListener` from Owl accepts a signal (ref) as its first argument — it
automatically adds and removes the event listener when the ref changes.

In the `Window` component:

```js
import { useDragAndDrop } from "../utils/drag_and_drop";

dnd = useDragAndDrop(this.props.x, this.props.y);
```

In the template, bind `root` to the `.window` div and `handle` to the
title bar:

```xml
<div class="window" t-ref="this.dnd.root" ...>
  <div class="window-titlebar" t-ref="this.dnd.handle">
```

Remove `t-att-style` entirely from the `.window` div — `t-att-style`
replaces the whole `style` attribute on each render, which would overwrite
the `left`/`top` set by the hook. Instead, manage `z-index` via a separate
`useEffect` in the Window component:

```js
setup() {
    useEffect(() => {
        const el = this.dnd.root();
        const zIndex = this.props.zIndex;
        if (el && zIndex) {
            el.style.zIndex = zIndex();
        }
    });
}
```

## Notes

Separating `root` (what moves) from `handle` (what you drag) is important:
dragging from the window body would interfere with app interactions (clicking
buttons, typing in textareas). Only the title bar should initiate a drag.

This pattern — a hook that returns refs — is powerful because it encapsulates
both DOM manipulation and event handling in a single reusable function. Any
component that needs drag-and-drop can call `useDragAndDrop` without
duplicating the logic.
