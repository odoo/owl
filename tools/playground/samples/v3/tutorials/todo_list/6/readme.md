## Reacting to Data Changes

Sometimes you need to run code whenever reactive data changes — for example,
logging, saving to localStorage, or syncing with an external service. Owl
provides `useEffect` for this purpose.

In this step, you will use `useEffect` to log the todo list content to the
console whenever it changes.

Here is what you need to do:

- Import `useEffect` from `@odoo/owl`
- In the `TodoList` component's `setup` method, call `useEffect` with a
  function that logs the todos to the console
- Open the browser console and observe what happens when you add a todo or
  toggle its completed state

### Hints

`useEffect` runs a function whenever any signal read inside it changes:

```js
import { useEffect } from "@odoo/owl";

setup() {
    useEffect(() => {
        console.log("todos changed:", this.todos());
    });
}
```

The effect runs once immediately, and then again every time `this.todos()`
(or any other signal read inside the callback) changes. This is useful
to perform side effects such as saving data to a server or updating
`document.title`.

Note that to track changes to individual todo fields (like `completed`), you
need to read those signals inside the effect as well. For example, iterating
over the todos and reading `todo.completed()` will cause the effect to re-run
when any todo is toggled.

## Bonus Exercises

- Log only the number of completed vs remaining todos instead of the full list.
