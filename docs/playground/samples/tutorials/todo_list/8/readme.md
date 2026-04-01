## Separating Business Logic from UI

The `TodoList` component currently mixes two concerns: managing the list of
todos (adding, deleting) and managing the UI (rendering, autofocus). As an
application grows, this becomes harder to maintain.

Owl 3 introduces **plugins** — reusable units of code that encapsulate logic
independently from any component. A plugin can hold reactive state (like our
todo list), provide a service (like a notification system or a storage layer),
or both. They allow you to separate business logic from UI code, and to share
that logic across multiple components. See the
[Plugins documentation](https://github.com/odoo/owl/blob/master/doc/reference/plugins.md)
for more details.

In this step, you will extract the todo list management into a
`TodoListPlugin`.

Here is what you need to do:

- Create a `todo_list_plugin.js` file with a `TodoListPlugin` class
- Move the `todos` array, `nextId`, `addTodo`, and `deleteTodo` logic into
  the plugin
- In `TodoList`, provide the plugin using `providePlugins` from `@odoo/owl`,
  and access it using `plugin(TodoListPlugin)`
- In `TodoItem`, instead of receiving an `onDelete` callback prop, import
  the plugin directly using `plugin(TodoListPlugin)` and call
  `deleteTodo` on it
- Move the `useEffect` logging into the plugin's `setup` method — plugins
  can use hooks just like components

### Hints

A plugin extends the `Plugin` class:

```js
import { Plugin, signal } from "@odoo/owl";

export class TodoListPlugin extends Plugin {
    nextId = 4;

    todos = signal.Array([...]);

    addTodo(text) { ... }
    deleteTodo(todo) { ... }
}
```

To provide a plugin from a component, use `providePlugins` in the `setup`
method. This makes the plugin available to all descendant components:

```js
import { providePlugins, plugin } from "@odoo/owl";

class TodoList extends Component {
    setup() {
        providePlugins([TodoListPlugin]);
        this.todoList = plugin(TodoListPlugin);
    }
}
```

Any descendant component can then access the same plugin instance:

```js
class TodoItem extends Component {
    todoList = plugin(TodoListPlugin);
}
```

This means `TodoItem` no longer needs an `onDelete` prop — it can call
`this.todoList.deleteTodo(...)` directly.

## Notes

Plugins are a powerful way to organize code in Owl. They decouple business
logic from the component tree, making it easier to test, reuse, and reason
about. A plugin does not need to know which component uses it, and a component
does not need to know how the plugin works internally.

## Bonus Exercises

- Validate the `text` argument in `addTodo` using the `assertType` function
  from Owl: `assertType(text, t.string)`. This ensures the plugin's API is
  called correctly and helps catch bugs early.
