## The Window Component

Time to add windows to our desktop! In this step, you will create a reusable
`Window` component using **slots** — a mechanism that lets a parent component
inject content into a child component's template.

Here is what you need to do:

- Create a `Window` component (`window.js` + `window.xml` + `window.css`) in
  `core/`
- It should accept a `title` prop (string) and display a title bar with the
  title and a close button
- Use a **default slot** (`t-call-slot="default"`) for the window body — this
  lets any parent inject arbitrary content into the window
- In the `Hibou` component, display a Window on the desktop with a "Welcome
  to Hibou OS!" message as slot content

### Hints

**Slots** are a key concept for building reusable components. The idea is
simple: the child component defines **where** content should appear using
`t-call-slot`, and the parent component decides **what** that content is.

This is different from props: props pass *data* to a child, while slots pass
*template fragments*. A `Window` component does not need to know whether it
will contain a clock, a text editor, or a calculator — it just renders
whatever the parent puts inside it.

There are two kinds of slots:

- The **default slot** receives any content placed between the component's
  opening and closing tags
- **Named slots** let you target specific insertion points using
  `t-set-slot="name"` on the parent side and `t-call-slot="name"` on the
  child side

In the `Window` template, use `t-call-slot` to render the default slot:

```xml
<div class="window">
  <div class="window-titlebar">
    <span t-out="this.props.title"/>
    <button class="window-close" t-on-click="this.props.onClose">✕</button>
  </div>
  <div class="window-body">
    <t t-call-slot="default"/>
  </div>
</div>
```

Here is some CSS you can use for `window.css`:

```css
.window {
    position: absolute;
    top: 60px;
    left: 60px;
    width: 400px;
    min-height: 200px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    overflow: hidden;

    .window-titlebar {
        display: flex;
        align-items: center;
        padding: 0 8px;
        height: 32px;
        background: #e8e8e8;

        .window-close {
            margin-left: auto;
            border: none;
            background: transparent;
            cursor: pointer;
        }
    }

    .window-body { padding: 12px; }
}
```

The parent passes content between the component tags for the default slot:

```xml
<Window title="'Hello'">
  <p>Welcome to Hibou OS!</p>
</Window>
```

## Notes

Slot content is rendered in the **parent's scope**. This means that
expressions inside a slot refer to the parent component's properties and
methods, not the Window's. This is what makes slots powerful — the Window
component does not need to know anything about the content it displays.

