## Registries: The Key to Extensibility

Our app system currently relies on a hardcoded list of app descriptors passed
as props. Each app must follow a strict structure with specific keys. But
what if an app only wants to add a systray item and no window? Or only a
plugin? The current design does not allow that.

In this step, you will replace the app descriptor system with **registries**
— a more flexible, decoupled approach. Each app registers what it provides
into the appropriate registry, and the core reads from them.

Here is what you need to do:

- Create `core/registries.js` with three registries:
  - `menuItemRegistry` — for taskbar app entries (name, icon, window),
    with validation
  - `systrayItemRegistry` — for systray components
  - `pluginRegistry` — for app plugins
- Update each app's `index.js` to import the registries and register its
  contributions (instead of exporting a descriptor)
- In `main.js`, import the app modules as side-effect imports
  (`import "./apps/clock"`) to trigger registration, then mount `Hibou`
  without the `apps` prop
- Update `Hibou` to read from the registries: collect plugins from
  `pluginRegistry`, and pass the registries to `Taskbar`
- Update `Taskbar` to iterate over `menuItemRegistry.items()` and
  `systrayItemRegistry.items()` instead of receiving them as props

### Hints

Owl provides a `Registry` class with built-in validation and ordering:

```js
import { Registry, Component, types as t } from "@odoo/owl";

export const menuItemRegistry = new Registry({
    name: "menuItem",
    validation: t.object({
        name: t.string,
        icon: t.string,
        window: t.constructor(Component),
    }),
});

export const systrayItemRegistry = new Registry({ name: "systrayItem" });
export const pluginRegistry = new Registry({ name: "plugin" });
```

Each app registers what it provides:

```js
// apps/clock/index.js
import { menuItemRegistry, systrayItemRegistry } from "../../core/registries";
import { ClockApp } from "./clock_app";
import { Clock as ClockSystray } from "./clock_systray";

menuItemRegistry.add("clock", { name: "Clock", icon: "🕐", window: ClockApp });
systrayItemRegistry.add("clock", ClockSystray);
```

In `main.js`, side-effect imports ensure apps are loaded:

```js
import "./apps/clock";
import "./apps/notepad";
import "./apps/calculator";

mount(Hibou, document.body, { templates: TEMPLATES, dev: true });
```

The `Taskbar` reads from registries reactively — `registry.items()` is a
computed signal, so the UI updates automatically if a registry changes:

```xml
<t t-foreach="menuItemRegistry.items()" t-as="app" t-key="app.name">
  <button class="taskbar-icon" t-att-title="app.name"
          t-on-click="() => this.wm.open(app.name, app.window)"
          t-out="app.icon"/>
</t>
```

## Notes

This pattern — registries populated by side-effect imports — is how Odoo's
web client works. Each module registers its views, fields, actions, and
services into global registries. The core framework reads from them without
knowing which modules are installed. This makes it possible to add or remove
features without touching the core code.

Notice that the `apps` prop and `APP_SCHEMA` validation are no longer needed
— the registry handles validation on `add()`.
