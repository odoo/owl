## Proxies vs Signals

In this step, you will add a small toolbar to filter todos by status (All /
Active / Completed) and sort them (by creation order or by name, ascending
or descending). This is view state, not business data — it lives on the
`TodoList` component, not the `TodoListPlugin`, the same way
`useAutofocus`'s `input` ref does.

The interesting part is *how* to store it. The natural shape is a small
tree of settings:

```js
{
    filter: { status: "all" },
    sort: { by: "id", direction: "asc" },
}
```

You might reach for `signal.Object` here, since it's a single plain object.
But `signal.Object` has the exact same shallow-wrapping rule as
`signal.Array`: it tracks its own top-level keys, and nothing below that. If
`viewPrefs` were a `signal.Object`, then `viewPrefs().filter` and
`viewPrefs().sort` would be returned as plain, non-reactive objects —
writing `viewPrefs().filter.status = "active"` would change the value but
notify nobody, because nothing ever wrapped `filter` itself.

This is exactly the situation `proxy` is for: a tree with more than one
level of nesting, where every level needs to be tracked. One `proxy(...)`
call wraps `viewPrefs`, `viewPrefs.filter`, and `viewPrefs.sort` all at
once, recursively — no matter how many levels deep you go.

Here is what you need to do:

- In `TodoList`, add `viewPrefs = proxy({ filter: { status: "all" }, sort: {
  by: "id", direction: "asc" } })`
- Add a `visibleTodos` computed value that reads `this.todoList.todos()`,
  filters by `viewPrefs.filter.status`, and sorts by `viewPrefs.sort.by` /
  `viewPrefs.sort.direction`
- Add the toolbar to the template: two `<select>` elements for the filter
  and the sort field, plus a button to flip the sort direction
- Render `this.visibleTodos()` in the `t-foreach` instead of
  `this.todoList.todos()`

### Hints

Bind the `<select>` elements with the `.proxy` modifier of `t-model`, using
a dot-notation path:

```xml
<select t-model.proxy="this.viewPrefs.filter.status">
    <option value="all">All</option>
    <option value="active">Active</option>
    <option value="completed">Completed</option>
</select>
```

A `computed` can freely mix reads from a signal-based collection and a
proxy — that's the point of having a single dependency-tracking mechanism
underneath all four reactive primitives:

```js
visibleTodos = computed(() => {
    let todos = this.todoList.todos();
    const { status } = this.viewPrefs.filter;
    if (status !== "all") {
        const wantCompleted = status === "completed";
        todos = todos.filter((todo) => todo.completed() === wantCompleted);
    }
    const { by, direction } = this.viewPrefs.sort;
    return [...todos].sort((a, b) => {
        const cmp = by === "text" ? a.text.localeCompare(b.text) : a.id - b.id;
        return direction === "asc" ? cmp : -cmp;
    });
});
```

Flipping the sort direction is a plain property write on the proxy, just
like any other mutation:

```js
toggleSortDirection() {
    this.viewPrefs.sort.direction = this.viewPrefs.sort.direction === "asc" ? "desc" : "asc";
}
```

## Notes

`signal`, `signal.Array` / `signal.Object`, and `proxy` aren't ranked from
"basic" to "advanced" — they solve different shapes of state:

- `todos` is a collection you explicitly add to and remove from
  (`push`/`splice`), so `signal.Array` — with its shallow tracking and
  explicit whole-value `.set(...)` — is the right fit.
- `viewPrefs` is a small, arbitrarily-nested settings tree you just read and
  write properties on. `proxy` tracks it deeply with zero extra wrapping,
  which is exactly what a settings-shaped object needs.

Picking between them is a question of "how deep is my data, and do I need
explicit control over whole-value replacement?" — not "which one is more
powerful."

## Bonus Exercises

- Add a text-search field: `filter.search = ""`, and only show todos whose
  text includes it (case-insensitively). Notice that adding this new nested
  leaf requires no extra wrapping anywhere — that's `proxy`'s deep tracking
  paying off as the settings tree grows.
- Persist `viewPrefs` to `localStorage` using the `StoragePlugin` from the
  previous step, the same way `todos` is persisted.
