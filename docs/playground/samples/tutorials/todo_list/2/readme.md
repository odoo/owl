## Adding New Todos

We can now display a list of todos, but the list is static. In this step, you
will add an input and a button to let the user create new todos.

Here is what you need to do:

- Add an `<input>` and an "Add" `<button>` above the todo list
- When the user presses Enter or clicks the button, add a new todo to the list
- Clear the input after adding a todo
- Ignore whitespace-only input (do not add empty todos)

You will quickly notice that pushing into the array does not update the UI.
This is because Owl needs a reactive data structure to know when to re-render.
You will need to convert the `todos` array into a `signal.Array`.

### Hints

`signal.Array` creates a signal that holds an observable array. It works like
a signal, so you call it to get the array:

```js
import { signal } from "@odoo/owl";

todos = signal.Array([
    { id: 1, text: "Buy milk", completed: false },
]);
```

Since `todos` is a signal, you need to call it to get the underlying observable
array: `this.todos()`. This applies both in JavaScript and in templates (e.g.
`t-foreach` should iterate over `this.todos()`, not `this.todos`).

You can call standard array methods on the observable array — `push`, `splice`,
`filter`, etc. — and the UI will update automatically:

```js
this.todos().push({ id: 4, text: "New todo", completed: false });
```

To read the text from an input, you can use `ev.target.value` in the event
handler:

```js
addTodo(ev) {
    const text = ev.target.value.trim();
    if (text) {
        this.todos().push({ id: ..., text, completed: false });
        ev.target.value = "";
    }
}
```

To handle both Enter and button click, you can use `t-on-keyup` on the input
and `t-on-click` on the button, calling the same method.

To generate a unique id for each new todo, you can use a simple counter as a
class property (e.g. `nextId = 4`) and increment it each time you add a todo.
In a real application, ids would typically come from a database or be generated
as UUIDs.

## Bonus Exercises

- Use `t-model` with a `signal` to bind the input value instead of reading
  `ev.target.value` directly.
- Add a counter below the list showing the number of remaining (non-completed)
  todos.
