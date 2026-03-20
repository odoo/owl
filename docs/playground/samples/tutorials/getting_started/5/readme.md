## Lifecycle Hooks

Components have a lifecycle: they are created, mounted into the DOM, and
eventually removed. Owl provides **hooks** to run code at specific moments in
this lifecycle. In this step, you will build a `Timer` component that starts
counting when mounted and cleans up when removed.

Here is what you need to do:

- Create a `Timer` component in its own file (`timer.js`)
- It should have a `value` signal starting at `0`
- It should accept an `increment` prop (number)
- In `onMounted`, start a `setInterval` that increments `value` by the
  `increment` prop every second
- In `onWillUnmount`, clear the interval to avoid memory leaks
- In `main.js`, create a `Root` component that displays two timers: one with
  an increment of `1` and another with an increment of `2`

### Hints

Lifecycle hooks are imported from `@odoo/owl` and called in the constructor
(or as class field initializers):

```js
import { Component, onMounted, onWillUnmount } from "@odoo/owl";

class Timer extends Component {
    setup() {
        let intervalId;
        onMounted(() => {
            intervalId = setInterval(() => { ... }, 1000);
        });
        onWillUnmount(() => {
            clearInterval(intervalId);
        });
    }
}
```

The most commonly used hooks are:

- `onMounted`: called after the component is inserted in the DOM
- `onWillUnmount`: called before the component is removed from the DOM
- `onWillStart`: async hook called before first rendering (useful for data fetching)

## Bonus Exercises

- Add a "Pause / Resume" button that stops and restarts the interval.
- Add a "Reset" button that sets the value back to 0.
