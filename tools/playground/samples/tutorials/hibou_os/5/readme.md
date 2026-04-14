## The Window Manager Plugin

Right now, windows are managed manually with individual signals in the `Hibou`
component. This does not scale — imagine managing 10 different apps this way.

In this step, you will learn two key ideas:

1. **Plugins for state management** — extracting the window list into a
   `WindowManagerPlugin` so any component can open or close a window without
   prop drilling.
2. **`t-component` for dynamic rendering** — the `ManagedWindow` uses
   `t-component` to instantiate a component class stored in a variable.
   This is how you write generic code that renders different components
   depending on data, without the parent having to know in advance which
   component to use.

**Note:** this is a larger step — take your time, and refer to the hints
below as needed.

Here is what you need to do:

- Create a `WindowManagerPlugin` (`window_manager_plugin.js`) in `core/`
  with:
  - A `windows` signal array holding the open window descriptors (each with
    `id`, `title`, `component`, `x`, `y`)
  - An `open(title, component)` method that adds a window
  - A `close(id)` method that removes a window
- Create a `ManagedWindow` component (`managed_window.js` + `managed_window.xml`)
  in `core/` that:
  - Receives a window descriptor as a prop
  - Renders a `Window` component with the right title, position, and onClose
  - Uses `t-component` inside the Window's slot to dynamically render the app
- Update `Hibou` to provide the plugin, iterate over its `windows` list, and
  render a `ManagedWindow` for each
- Update the `Taskbar` to use the plugin directly (instead of callback props)
  to open windows
- For now, you can use a simple placeholder component for the app content
  (e.g. a component that just displays "Hello!")
- Try clicking the 🕐 icon multiple times — you should see multiple windows
  open, each at a slightly different position

### Hints

The `WindowManagerPlugin` manages a list of open windows:

```js
import { Plugin, signal } from "@odoo/owl";

export class WindowManagerPlugin extends Plugin {
    nextId = 1;
    windows = signal.Array([]);

    open(title, component) {
        this.windows().push({
            id: this.nextId++,
            title,
            component,
            x: 60 + this.windows().length * 30,
            y: 60 + this.windows().length * 30,
        });
    }

    close(id) {
        const index = this.windows().findIndex((w) => w.id === id);
        if (index !== -1) {
            this.windows().splice(index, 1);
        }
    }
}
```

Note the cascading position: each new window is offset by 30px so they don't
stack exactly on top of each other.

The `ManagedWindow` bridges the plugin and the `Window` component. It uses
`t-component` to dynamically render the right app:

```xml
<Window title="this.props.window.title" x="this.props.window.x" y="this.props.window.y"
        onClose="() => this.wm.close(this.props.window.id)">
  <t t-component="this.props.window.component"/>
</Window>
```

This is where the separation pays off: `Window` handles the visual shell
(title bar, close button, slot), while `ManagedWindow` handles the dynamic
logic (which component to render, how to close). `t-component` dynamically
instantiates a component class — unlike slots where the parent writes the
content at design time.

In `Hibou`, iterate over the windows:

```xml
<t t-foreach="this.wm.windows()" t-as="win" t-key="win.id">
  <ManagedWindow window="win"/>
</t>
```

In the `Taskbar`, use the plugin directly to open windows:

```js
import { plugin } from "@odoo/owl";
import { WindowManagerPlugin } from "./window_manager_plugin";

wm = plugin(WindowManagerPlugin);

openApp() {
    this.wm.open("My App", SomePlaceholderComponent);
}
```

## Notes

Notice how the `Taskbar` no longer needs callback props from its parent — it
accesses the plugin directly. This is the same pattern we used in the Todo
List tutorial. The plugin decouples the "who wants to open a window" from
"who manages the window list."
