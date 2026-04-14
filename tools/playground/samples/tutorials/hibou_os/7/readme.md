## Tidying Up: Apps

The taskbar icons are currently hardcoded, and the systray clock lives in
`core/`. As we add more apps, this approach does not scale. In this step,
you will create a proper app structure where each app is a self-contained
folder that declares what it provides.

Here is what you need to do:

- Create an `apps/` folder with subfolders `clock/`, `notepad/`, `calculator/`
- Move the systray clock from `core/clock.js` into `apps/clock/` and rename
  it to `clock_systray.js`
- Move the `ClockApp` from `apps/clock_app.js` into `apps/clock/`
- Each app folder should have an `index.js` that exports a descriptor object:
  ```js
  export const clock = {
      name: "Clock",
      icon: "🕐",
      window: ClockApp,
      systrayItems: [ClockSystray],
  };
  ```
- Create a simple `NotepadApp` (a `<textarea>`) in `apps/notepad/` and a
  `CalculatorApp` (a simple placeholder) in `apps/calculator/`, each with
  their own `index.js`
- In `main.js`, import all app descriptors and pass them as an `apps` prop
  to the `Hibou` component
- Update `Hibou` to pass the apps to `Taskbar`
- Update `Taskbar` to generate icons dynamically from the apps list using
  `t-foreach`, and render systray items from the apps that provide them

### Hints

An app descriptor is a plain object:

```js
// apps/clock/index.js
import { ClockApp } from "./clock_app";
import { Clock as ClockSystray } from "./clock_systray";

export const clock = {
    name: "Clock",
    icon: "🕐",
    window: ClockApp,
    systrayItems: [ClockSystray],
};
```

```js
// apps/notepad/index.js
import { NotepadApp } from "./notepad_app";

export const notepad = {
    name: "Notepad",
    icon: "📝",
    window: NotepadApp,
};
```

In `main.js`, pass them as props to the root component. The `mount` function
accepts a `props` option for this:

```js
import { clock } from "./apps/clock";
import { notepad } from "./apps/notepad";
import { calculator } from "./apps/calculator";

mount(Hibou, document.body, {
    templates: TEMPLATES,
    dev: true,
    props: { apps: [clock, notepad, calculator] },
});
```

The `Taskbar` renders icons dynamically:

```xml
<div class="taskbar-apps">
  <t t-foreach="this.props.apps" t-as="app" t-key="app.name">
    <button class="taskbar-icon" t-att-title="app.name"
            t-on-click="() => this.wm.open(app.name, app.window)"
            t-out="app.icon"/>
  </t>
</div>
```

For systray items, collect them from all apps and render with `t-component`:

```xml
<div class="systray">
  <t t-foreach="this.systrayItems" t-as="item" t-key="item_index">
    <t t-component="item"/>
  </t>
</div>
```

## Notes

This pattern — each app as a self-contained folder with an index.js
descriptor — makes it easy to add, remove, or configure apps without
touching the core code. The core only needs to know the shape of an app
descriptor, not the details of each app. Try removing an app from the list
in `main.js` (e.g. remove `notepad`) and notice how the icon disappears from
the taskbar — the app is simply not loaded.
