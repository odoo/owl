# Registry

## Overview

A `Registry` is an ordered, reactive key-value map. It is useful when items
need to be looked up by name — for example, a component registry, an action
registry, or a view-type registry.

Registries support:

- **sequencing**: entries can be given a sequence number to control ordering
- **scoped lifetime**: in components and plugins, entries can be automatically
  removed when the owner is destroyed
- **type validation**: values can be validated against a schema on insertion
- **reactivity**: `items()` and `entries()` are [reactive computed values](reactivity.md#computed-values)

For a keyless variant, see [Resource](resources.md).

## Creating a Registry

```js
const views = new Registry();
```

Both constructor options are optional:

```js
const views = new Registry({
  name: "views", // for error messages
  validation: t.constructor(Component),
});
```

- `name` appears in error messages (defaults to `"registry"`).
- `validation` is applied on every insertion (`add()`, `addById()`, `use()`,
  `useById()`). See [Types & Validation](types_validation.md) for schema
  syntax.

## Adding entries

### `add(key, value, options?)`

Adds an entry permanently. Returns the registry for chaining.

```js
views.add("list", ListComponent);
views.add("form", FormComponent, { sequence: 10 });

views.add("a", A).add("b", B); // chainable
```

If the key is already registered, `add()` throws. Pass `{ force: true }` to
explicitly overwrite:

```js
views.add("list", ListComponent);
views.add("list", OtherComponent); // throws
views.add("list", OtherComponent, { force: true }); // ok, overwrites
```

`options.sequence` defaults to `50`. Entries are sorted ascending by sequence
in `entries()` and `items()`. The expected range is `1`–`100`, with `50` sitting
in the middle so callers can insert entries before or after the default without
having to renumber existing ones.

### `addById(item, options?)`

Shorthand for values that already carry an `id` property — uses `item.id`
as the key. Returns the registry for chaining.

```js
const actions = new Registry();

const save = { id: "save", label: "Save", run: () => {} };
actions.addById(save);

actions.get("save"); // same reference as save
```

Throws if `item.id` is missing or empty.

### `use(key, value, options?)`

Like `add()`, but the entry is automatically removed when the current
component or plugin is destroyed. Returns the registry for chaining.

```js
class ActionBarComponent extends Component {
  setup() {
    actions.use("save", { label: "Save", run: () => this.save() });
  }
}
```

`use()` throws `OwlError("No active context")` when called outside of a
component `setup()` or a plugin `setup()`.

Like `add()`, `use()` throws if the key is already registered. Pass
`{ force: true }` to overwrite explicitly. On destroy, the entry is removed
only if the current value is still the one it registered — so an active
override by another owner is never clobbered by a stale cleanup. Note that
`use()` does **not** restore any previous value on destroy: if you `force`
over an existing entry, that entry is gone once your scope ends.

### `useById(item, options?)`

Scoped variant of `addById()`. Adds `item` under `item.id` and removes it
when the current component or plugin is destroyed.

```js
setup() {
  actions.useById({ id: "save", label: "Save", run: () => this.save() });
}
```

## Removing entries

### `delete(key)`

Removes an entry by key. Returns `void` (not chainable — unlike
`Resource.delete`).

```js
views.delete("form");
```

### `has(key)`

Returns `true` if the registry has an entry for this key.

```js
views.has("list"); // true or false
```

## Reading entries

### `get(key, defaultValue?)`

Returns the value for `key`. Throws an [`OwlError`](error_handling.md#owlerror)
if the key is missing and no default value is provided:

```js
views.get("list"); // ListComponent
views.get("kanban"); // throws OwlError
views.get("kanban", null); // returns null
```

### `items()` and `entries()`

Both are reactive [computed values](reactivity.md#computed-values), sorted
by sequence. `items()` returns values; `entries()` returns `[key, value]`
tuples.

```js
const r = new Registry();
r.add("a", "first", { sequence: 10 });
r.add("b", "middle"); // sequence 50
r.add("c", "last", { sequence: 100 });

r.items(); // ["first", "middle", "last"]
r.entries(); // [["a", "first"], ["b", "middle"], ["c", "last"]]
```

Because they are computed, reading them inside a component render or an
effect subscribes to changes:

```js
effect(() => {
  console.log(registry.items()); // re-runs when entries change
});

registry.add("b", 2);
await Promise.resolve(); // effect re-runs
```

## Type validation

When a `validation` option is passed to the constructor, values are checked
on every `add()`, `addById()`, `use()`, and `useById()`:

```js
const views = new Registry({
  name: "views",
  validation: t.constructor(Component),
});

views.add("list", ListComponent); // ok
views.add("oops", "not a component"); // throws validation error
```

See [Types & Validation](types_validation.md) for the full schema syntax.

## API summary

| Method / Property                        | Description                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `new Registry({ name?, validation? })`   | Create a registry.                                                                                                                   |
| `add(key, value, { sequence?, force? })` | Add permanently. Chainable. Throws on duplicate key unless `force: true`.                                                            |
| `addById(item, { sequence?, force? })`   | Add under `item.id`. Chainable. Throws if `item.id` is empty, or on duplicate key unless `force: true`.                              |
| `use(key, value, { sequence?, force? })` | Add for the lifetime of the current component/plugin. Chainable. Throws outside a context, or on duplicate key unless `force: true`. |
| `useById(item, { sequence?, force? })`   | Scoped variant of `addById`. Chainable.                                                                                              |
| `get(key, defaultValue?)`                | Look up by key. Throws `OwlError` if missing and no default.                                                                         |
| `delete(key)`                            | Remove. Returns `void`.                                                                                                              |
| `has(key)`                               | Test key presence.                                                                                                                   |
| `items()`                                | Reactive computed returning values sorted by sequence.                                                                               |
| `entries()`                              | Reactive computed returning `[key, value]` tuples sorted by sequence.                                                                |
