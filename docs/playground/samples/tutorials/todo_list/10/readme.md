## Persisting Data

Our todo list works well, but all data is lost when the page is refreshed. In
this step, you will add persistence using
[`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
— a browser API that stores key-value pairs as strings, persisted across
page reloads.

To keep things decoupled, we will create a generic `StoragePlugin` that handles
reading and writing to `localStorage`. The `TodoListPlugin` will then use it
to save and load todos, without knowing the details of the storage medium.

Here is what you need to do:

- Create a `storage_plugin.js` file (outside the `todo_list/` folder) with a
  `StoragePlugin` that has two methods:
  - `save(key, data)` — saves a string to `localStorage`
  - `load(key)` — returns the stored string, or `null`
- In `TodoListPlugin`, import the `StoragePlugin` using `plugin(StoragePlugin)`
- In `setup`, load the saved data and parse it to initialize the todos
- In the existing `useEffect`, instead of logging, save the todos as a JSON
  string using the `StoragePlugin`

### Hints

The `StoragePlugin` is straightforward:

```js
import { Plugin } from "@odoo/owl";

export class StoragePlugin extends Plugin {
    save(key, data) {
        localStorage.setItem(key, data);
    }

    load(key) {
        return localStorage.getItem(key);
    }
}
```

In the `TodoListPlugin`, use `plugin()` to access it. Note that a plugin can
use other plugins — this is how you compose logic:

```js
import { plugin } from "@odoo/owl";
import { StoragePlugin } from "../storage_plugin";

storage = plugin(StoragePlugin);
```

To serialize todos for storage, you need to read the signal values:

```js
const data = this.todos().map((t) => ({
    id: t.id,
    text: t.text,
    completed: t.completed(),
}));
this.storage.save("todos", JSON.stringify(data));
```

To load and restore them, parse the JSON and recreate the signals:

```js
const saved = this.storage.load("todos");
if (saved) {
    const data = JSON.parse(saved);
    // reconstruct todos with signal(completed) ...
}
```

The `StoragePlugin` is a global service — it should be provided at the app
level via the `plugins` option in the `mount` call:

```js
import { StoragePlugin } from "./storage_plugin";

mount(Root, document.body, { templates: TEMPLATES, dev: true, plugins: [StoragePlugin] });
```

This illustrates the difference between global plugins (available to the
entire app) and component-scoped plugins (provided via `providePlugins` inside
a component).

## Notes

By decoupling storage from the todo list logic, we could easily swap
`localStorage` for a server API, IndexedDB, or any other storage medium
without changing the `TodoListPlugin` at all.

## Bonus Exercises

- Make the `StoragePlugin` API asynchronous (`async save`, `async load`), so
  it could be swapped for IndexedDB or network calls without changing the
  consumers.
