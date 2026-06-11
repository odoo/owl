## Deleting Todos

Now let us add the ability to delete todos. This raises an interesting
question: who should be responsible for removing a todo from the list?

The `TodoItem` component displays a single todo, but it does not own the list.
The `TodoList` component owns the `todos` array, so it is the one that should
perform the deletion. This means the child needs to communicate its intent to
the parent.

In Owl, this is done by passing a **callback function as a prop**.

Here is what you need to do:

- Add a delete button (e.g. "✕") on the right side of each todo item
- Add an optional `onDelete` function prop to `TodoItem`
- When the delete button is clicked, call `this.props.onDelete()`
- In `TodoList`, pass an `onDelete` callback to each `TodoItem` that removes
  the todo from the array

### Hints

To declare an optional function prop:

```js
props = props({
    todo: t.object({ ... }),
    "onDelete?": t.function(),
});
```

In the `TodoItem` template, use optional chaining since the prop is optional:

```xml
<button t-on-click="() => this.props.onDelete?.()">✕</button>
```

In the `TodoList` template, pass a callback using an arrow function:

```xml
<TodoItem todo="todo" onDelete="() => this.deleteTodo(todo)"/>
```

To remove an item from a `signal.Array`, you can use `splice`:

```js
deleteTodo(todo) {
    const index = this.todos().indexOf(todo);
    if (index !== -1) {
        this.todos().splice(index, 1);
    }
}
```

## Notes

This pattern — passing callbacks as props — is how child components communicate
with their parents in Owl. The child does not need to know how the deletion
happens; it just calls the function it received. This keeps components
decoupled and reusable.

Notice how the props validation schema defines a kind of **moral contract**:
the component guarantees it will behave properly as long as the given props
match the schema. Since `onDelete` is optional, the component must handle the
case where it is not provided (hence the `?.()` optional chaining). This is
why it is important to think carefully about which props are required and which
are optional.

## Bonus Exercises

- Add a confirmation prompt before deleting a todo.
