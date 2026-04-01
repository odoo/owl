## Simplifying: Merging Window Components

We currently have two separate components for windows: `Window` (the visual
shell with slots) and `ManagedWindow` (the bridge that uses `t-component`).
In practice, `ManagedWindow` is just a thin wrapper. In this step, you will
merge them into a single `Window` component.

Here is what you need to do:

- Add an optional `component` prop to the `Window` component
- In the `Window` template: if `component` is provided, use `t-component`
  to render it in the body; otherwise, fall back to the default slot
  (`t-call-slot`)
- Update the `WindowManager` to render `Window` directly instead of
  `ManagedWindow`
- Move the `t-on-mousedown.capture` for activation to the `WindowManager`
  template
- Delete `managed_window.js` and `managed_window.xml`

### Hints

The Window template can handle both cases with `t-if`:

```xml
<div class="window-body">
  <t t-if="this.props.component" t-component="this.props.component"/>
  <t t-else="" t-call-slot="default"/>
</div>
```

This means the `Window` component now works in two modes:
- **Slot mode**: `<Window title="'Hello'"><p>content</p></Window>`
- **Component mode**: `<Window title="'Clock'" component="ClockApp"/>`

The `WindowManager` template becomes:

```xml
<div class="desktop-area">
  <t t-foreach="this.wm.windows()" t-as="win" t-key="win.id">
    <Window title="win.title" x="win.x" y="win.y" zIndex="win.zIndex"
            component="win.component"
            onClose="() => this.wm.close(win.id)"
            t-on-mousedown.capture="() => this.wm.activate(win.id)"/>
  </t>
</div>
```

## Notes

This is a good example of iterative simplification. We started with two
components because we needed to understand the concepts separately (slots
and `t-component`). Now that we understand both, merging them reduces
indirection and makes the code easier to follow.
