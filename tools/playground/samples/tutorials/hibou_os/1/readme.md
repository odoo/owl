## Hibou OS Tutorial

Welcome to **Hibou OS**! In this tutorial, you will build a mini desktop
environment in the browser — complete with a taskbar, draggable windows, and
small apps. This is a more advanced project that explores plugins, dynamic
components, and complex state management.

Use the navigation bar above the editor to move between steps. Each step
includes hints and a solution you can reveal if you get stuck. Let's begin!

---

## Step 1: Setting the Stage

In this first step, you will create the basic layout: a desktop area that
fills the screen, and a taskbar at the bottom with a few app icons.

Here is what you need to do:

- Create a `hibou.css` file in `core/` and style the `Hibou` component to
  fill the viewport with a background color
- Create a `Taskbar` component (`taskbar.js` + `taskbar.xml` + `taskbar.css`)
  in `core/`, displayed at the bottom of the desktop
- The taskbar should show a few app icons (you can use emoji for now):
  🕐 Clock, 📝 Notepad, 🧮 Calculator
- The `Hibou` component should import and use the `Taskbar`
- Add a tooltip on each taskbar button (using the `title` attribute) to show
  the app name on hover

### Hints

The desktop should use `position: fixed` or `100vh`/`100vw` to fill the
screen. The taskbar sits at the bottom using flexbox:

```css
.desktop {
    width: 100vw;
    height: 100vh;
    background: #76a6d1;
    display: flex;
    flex-direction: column;
}

.taskbar {
    height: 48px;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}
```

Each taskbar icon can be a simple button with an emoji:

```xml
<button class="taskbar-icon">🕐</button>
```

