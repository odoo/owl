## Opening a Second Window

We have a Window component, but right now only one static window is shown. In
this step, you will make the 🕐 taskbar icon open a second window. This
raises the question: how do we position multiple windows so they don't overlap?

Here is what you need to do:

- Add a `showClock` signal to the `Hibou` component
- When clicking the 🕐 icon in the taskbar, toggle the `showClock` signal
- Display a second Window (with title "Clock" and a simple message) when
  `showClock` is true
- Pass the `onClose` prop to close it
- Position the second window at a different location by passing `x` and `y`
  props to the Window component

### Hints

To pass a callback from `Hibou` through the `Taskbar`, add an `onClockClick`
function prop to the Taskbar.

To position windows, add optional `x` and `y` number props to the `Window`
component, and use `t-att-style` on the root element inside the Window
template:

```xml
<div class="window" t-att-style="'top:' + this.props.y + 'px; left:' + this.props.x + 'px'">
```

Note that `t-att-` directives cannot be used directly on a component tag (since
component attributes are treated as props, not DOM attributes). The component
itself must apply the style on its own root element.

Then in the parent:

```xml
<Window title="'Clock'" x="200" y="120">
  <p>Hello from Clock!</p>
</Window>
```

## Notes

Positioning windows with hardcoded coordinates is fine for now. In a later
step, we will introduce a Window Manager plugin to handle this properly.
