## Tidying Up: Extracting Window Logic

The `Hibou` component currently knows about the `WindowManagerPlugin`,
iterates over windows, and renders `ManagedWindow` components. That is too
much responsibility for the root component. Also, all window-related files
are mixed with the rest of `core/`.

In this step, you will clean things up:

- Create a `core/window/` folder and move all window-related files there:
  `window.js/xml/css`, `managed_window.js/xml`, `window_manager_plugin.js`
- Create a `WindowManager` component (`window_manager.js` + `window_manager.xml`)
  in `core/window/` that encapsulates the window iteration logic
- It should access the `WindowManagerPlugin`, iterate over its windows, and
  render a `ManagedWindow` for each
- `Hibou` must still provide the plugin (via `providePlugins`) because both
  `WindowManager` and `Taskbar` need access to it — and they are siblings,
  so the plugin must be provided by their common ancestor
- Simplify `Hibou` so it just provides the plugin and renders
  `<WindowManager/>` in the desktop area, without iterating over windows
  itself
- Update all import paths accordingly

### Hints

The `WindowManager` component takes over the iteration logic:

```js
import { Component, plugin } from "@odoo/owl";
import { ManagedWindow } from "./managed_window";
import { WindowManagerPlugin } from "./window_manager_plugin";

export class WindowManager extends Component {
    static template = "hibou.WindowManager";
    static components = { ManagedWindow };

    wm = plugin(WindowManagerPlugin);
}
```

```xml
<t t-name="hibou.WindowManager">
  <div class="desktop-area">
    <t t-foreach="this.wm.windows()" t-as="win" t-key="win.id">
      <ManagedWindow window="win"/>
    </t>
  </div>
</t>
```

The `Hibou` component becomes much simpler:

```js
import { Component, providePlugins } from "@odoo/owl";
import { Taskbar } from "./taskbar";
import { WindowManager } from "./window/window_manager";
import { WindowManagerPlugin } from "./window/window_manager_plugin";

export class Hibou extends Component {
    static template = "hibou.Hibou";
    static components = { Taskbar, WindowManager };

    setup() {
        providePlugins([WindowManagerPlugin]);
    }
}
```

## Notes

This is a common refactoring pattern: when a component grows too large, look
for a self-contained piece of logic that can be extracted into its own
component or folder. The `core/window/` folder now groups everything related
to window management — the plugin, the UI shell, the managed bridge, and the
iteration logic — making it easy to understand and maintain as a unit.
