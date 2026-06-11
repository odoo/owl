## The System Tray Clock

Every desktop has a clock. In this step, you will create a `Clock` component
that displays the current time, updated every second, and place it in a
system tray area on the right side of the taskbar.

Here is what you need to do:

- Create a `Clock` component (`clock.js` + `clock.xml`) in `core/`
- It should display the current time in `HH:MM:SS` format
- Use a `signal` to hold the time, and update it every second with
  `setInterval`
- Clean up the interval with `onWillUnmount`
- Add a `systray` area on the right side of the `Taskbar` and place the
  `Clock` inside it
- Update `taskbar.css` to push the systray to the right

### Hints

Use `Date` to get the current time and format it:

```js
const now = new Date();
const time = now.toLocaleTimeString();
```

The taskbar layout can use `flex` with `margin-left: auto` on the systray
to push it to the right:

```css
.systray {
    margin-left: auto;
}
```

Remember to use `onMounted` to start the interval and `onWillUnmount` to
clean it up, just like the Timer component in the Getting Started tutorial.

## Bonus Exercises

- Display the date (e.g. "Thu 27 Mar") next to the time.
