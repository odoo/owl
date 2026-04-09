## App Plugins and Validation

Apps are currently simple: a component, an icon, and optionally some systray
items. But what if an app needs shared state that persists across window
open/close cycles? For example, a notepad should keep its text even after the
window is closed and reopened.

In this step, you will make apps more powerful by letting them declare
**plugins**, and you will add **validation** to ensure all app descriptors
have the expected shape.

Here is what you need to do:

- Create a `NotepadPlugin` (`notepad_plugin.js`) in `apps/notepad/` with a
  `text` signal to hold the notepad content
- Update `NotepadApp` to use the plugin via `plugin(NotepadPlugin)` and bind
  its `text` signal with `t-model`
- Add an optional `plugins` key to the app descriptor — an array of plugin
  classes that the app needs
- Update the notepad's `index.js` to include `plugins: [NotepadPlugin]`
- Open multiple notepad windows and type in them — notice that they all share
  the same text, since it comes from a single plugin instance. Close and
  reopen a notepad — the text is preserved because it lives in the plugin,
  not in the component
- In `hibou.js`, define an `APP_SCHEMA` using `t.object()` that validates
  the shape of an app descriptor
- In `Hibou`'s `setup`, validate all apps using `assertType`, then collect
  all plugins from all apps and provide them (together with the
  `WindowManagerPlugin`)

### Hints

The `NotepadPlugin` is simple:

```js
import { Plugin, signal } from "@odoo/owl";

export class NotepadPlugin extends Plugin {
    text = signal("");
}
```

The `NotepadApp` uses it:

```js
import { plugin } from "@odoo/owl";
import { NotepadPlugin } from "./notepad_plugin";

notepad = plugin(NotepadPlugin);
```

```xml
<textarea t-model="this.notepad.text" .../>
```

Define the app schema in `hibou.js`:

```js
import { types as t } from "@odoo/owl";

const APP_SCHEMA = t.object({
    name: t.string(),
    icon: t.string(),
    window: t.constructor(Component),
    "systrayItems?": t.array(t.constructor(Component)),
    "plugins?": t.array(t.constructor(Plugin)),
});
```

In `setup`, validate and collect plugins:

```js
import { assertType } from "@odoo/owl";

setup() {
    for (const app of this.props.apps) {
        assertType(app, APP_SCHEMA);
    }
    const appPlugins = this.props.apps.flatMap((app) => app.plugins || []);
    providePlugins([WindowManagerPlugin, ...appPlugins]);
    ...
}
```

## Notes

Now the notepad keeps its content when you close and reopen the window —
the text lives in the plugin, not in the component. This is the same pattern
we used in the Todo List tutorial: plugins hold state, components display it.

Validating app descriptors at startup catches configuration errors early
(e.g. a typo in a key name, a missing `window` field) instead of letting
them cause cryptic runtime errors later.
