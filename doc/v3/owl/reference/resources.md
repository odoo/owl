# Resource

## Overview

A `Resource` is an ordered, reactive collection of items (no keys). It is
useful for collections where multiple parts of the application contribute
items — for example, systray entries, error handlers, keyboard shortcuts,
or menu sections.

Resources support:

- **sequencing**: items can be given a sequence number to control ordering
- **scoped lifetime**: in components and plugins, items can be automatically
  removed when the owner is destroyed
- **type validation**: items can be validated against a schema on insertion
- **reactivity**: `items()` is a [reactive computed value](reactivity.md#computed-values)
  — reading it inside a component render or an effect subscribes to changes

For a keyed variant, see [Registry](registries.md).

## Creating a Resource

```js
const commands = new Resource();
```

Both constructor options are optional:

```js
const commands = new Resource({
  name: "commands", // for error messages
  validation: t.object({ label: t.string(), run: t.function() }),
});
```

- `name` appears in validation and debug error messages.
- `validation` is applied on every insertion (`add()` and `use()`). See
  [Types & Validation](types_validation.md) for schema syntax.

## Adding items

### `add(item, options?)`

Adds an item permanently. Returns the resource for chaining.

```js
commands.add({ label: "Save", run: save });
commands.add({ label: "Undo", run: undo }, { sequence: 10 });

commands.add(a).add(b).add(c); // chainable
```

`options.sequence` defaults to `50`. Items are sorted ascending by sequence
when read via `items()`. The expected range is `1`–`100`, with `50` sitting in
the middle so callers can insert items before or after the default without
having to renumber existing ones.

### `use(item, options?)`

Like `add()`, but the item is automatically removed when the current
component or plugin is destroyed. Returns the resource for chaining.

```js
class ClockComponent extends Component {
  systray = plugin(SystrayPlugin);

  setup() {
    this.systray.items.use({ label: "Clock", render: () => this.renderClock() });
  }
}
```

`use()` throws `OwlError("No active context")` when called outside of a
component `setup()` or a plugin `setup()`. Use `add()` for entries that
should live for the whole app.

## Removing items

### `delete(item)`

Removes every occurrence of the given item, matched by reference equality.
Returns the resource for chaining.

```js
commands.delete(item);
commands.delete(a).delete(b);
```

### `has(item)`

Returns `true` if the resource contains the given item (reference equality).

```js
commands.has(item); // true or false
```

## Reading items

### `items()`

`items` is a reactive [computed value](reactivity.md#computed-values) that
returns the resource's contents sorted by sequence.

```js
const r = new Resource();
r.add("first", { sequence: 10 });
r.add("middle"); // sequence 50 (default)
r.add("last", { sequence: 100 });

r.items(); // ["first", "middle", "last"]
```

Because `items` is a computed, reading it inside a component render or an
effect subscribes to changes — adding or removing items re-runs the
subscriber:

```js
class CommandPalette extends Component {
  static template = xml`
    <ul>
      <li t-foreach="this.commands.items()" t-as="cmd" t-key="cmd.label">
        <t t-out="cmd.label"/>
      </li>
    </ul>`;

  commands = plugin(CommandPlugin);
}
```

The palette re-renders whenever items are added to or removed from
`this.commands`.

## Type validation

When a `validation` option is passed to the constructor, items are checked
on every `add()` and `use()`:

```js
const commands = new Resource({
  name: "commands",
  validation: t.object({ label: t.string(), run: t.function() }),
});

commands.add({ label: "Save", run: save }); // ok
commands.add({ label: 123 }); // throws validation error
```

See [Types & Validation](types_validation.md) for the full schema syntax.

## API summary

| Method / Property                      | Description                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `new Resource({ name?, validation? })` | Create a resource.                                                                         |
| `add(item, { sequence? })`             | Add permanently. Chainable.                                                                |
| `use(item, { sequence? })`             | Add for the lifetime of the current component/plugin. Chainable. Throws outside a context. |
| `delete(item)`                         | Remove by reference equality. Chainable.                                                   |
| `has(item)`                            | Test membership by reference equality.                                                     |
| `items()`                              | Reactive computed returning items sorted by sequence.                                      |
