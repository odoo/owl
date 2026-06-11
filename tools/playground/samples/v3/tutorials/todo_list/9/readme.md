## Computed Values

Sometimes you need a value that is derived from other reactive data. For
example, counting how many todos are still remaining. Instead of computing
this manually every time the list changes, Owl provides `computed` — a value
that updates automatically when its dependencies change.

Here is what you need to do:

- Add a `remaining` computed value to the `TodoListPlugin` that returns the
  number of non-completed todos
- Display it below the todo list in the `TodoList` template (e.g.
  "X remaining items")

### Hints

A `computed` value is created like this:

```js
import { computed } from "@odoo/owl";

remaining = computed(() => {
    return this.todos().filter((todo) => !todo.completed()).length;
});
```

It automatically tracks which signals are read inside the callback. Whenever
any of them change (a todo is added, deleted, or toggled), the computed value
is recalculated.

In the template, read it by calling it:

```xml
<div><t t-out="this.todoList.remaining()"/> remaining items</div>
```

## Bonus Exercises

- Add a `total` computed value and display it alongside the remaining
  count (e.g. "2 remaining / 3 total").
- Hide the count when the list is empty.
