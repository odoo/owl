# 🦉 Resources and Registries 🦉

## Content

- [Overview](#overview)
- [Resource](#resource)
  - [Creating a Resource](#creating-a-resource)
  - [Sequencing](#sequencing)
  - [useResource](#useresource)
  - [Type Validation](#type-validation)
- [Registry](#registry)
  - [Creating a Registry](#creating-a-registry)
  - [addById](#addbyid)
  - [Sequencing](#registry-sequencing)
  - [Type Validation](#registry-type-validation)
- [Reactivity](#reactivity)

## Overview

Owl provides two ordered, reactive collection types:

- **Resource**: an ordered set of items (no keys). Useful for collections where
  multiple parts of the application contribute items — for example, systray
  entries, error handlers, or keyboard shortcuts.
- **Registry**: an ordered key-value map. Useful when items need to be looked up
  by name — for example, a component registry or action registry.

Both support sequencing (to control ordering) and optional type validation.
Both expose their contents as reactive computed values, so reading them in a
component or effect automatically subscribes to changes.

## Resource

### Creating a Resource

A `Resource` holds an ordered set of items. Use `add()` and `delete()` to
manage items, and `items()` to read them:

```js
const commands = new Resource();

commands.add({ label: "Save", action: save });
commands.add({ label: "Undo", action: undo });

commands.items(); // [{ label: "Save", ... }, { label: "Undo", ... }]

commands.has(someItem); // true or false (reference equality)
commands.delete(someItem);
```

Methods are chainable:

```js
commands.add(item1).add(item2).add(item3);
```

A `name` option can be provided for better error messages:

```js
const commands = new Resource({ name: "commands" });
```

### Sequencing

Items are sorted by a numeric sequence value (default: 50, ascending). Lower
numbers appear first:

```js
const r = new Resource();
r.add("first", { sequence: 10 });
r.add("middle"); // sequence 50 (default)
r.add("last", { sequence: 100 });

r.items(); // ["first", "middle", "last"]
```

### useResource

In components and plugins, `useResource()` adds items to a resource and
automatically removes them when the component or plugin is destroyed:

```js
class SystrayPlugin extends Plugin {
  items = new Resource({ name: "systray" });
}

class ClockComponent extends Component {
  systray = plugin(SystrayPlugin);

  setup() {
    useResource(this.systray.items, [{ label: "Clock", render: () => this.renderClock() }]);
    // items are removed when ClockComponent is destroyed
  }
}
```

### Type Validation

Pass a `validation` option to validate items on `add()`:

```js
const commands = new Resource({
  name: "commands",
  validation: t.object({ label: t.string, action: t.function() }),
});

commands.add({ label: "Save", action: save }); // ok
commands.add({ label: 123 }); // throws validation error
```

## Registry

### Creating a Registry

A `Registry` holds an ordered key-value map. Use `add()`, `get()`, `delete()`,
and `has()` to manage entries:

```js
const views = new Registry({ name: "views" });

views.add("list", ListComponent);
views.add("form", FormComponent);

views.get("list"); // ListComponent
views.has("form"); // true
views.delete("form");
```

`get()` throws an error if the key is not found. Pass a default value to
avoid the error:

```js
views.get("kanban"); // throws KeyNotFoundError
views.get("kanban", null); // returns null
```

`entries()` returns `[key, value]` tuples, `items()` returns values only:

```js
views.entries(); // [["list", ListComponent], ["form", FormComponent]]
views.items(); // [ListComponent, FormComponent]
```

Methods are chainable:

```js
views.add("list", ListComponent).add("form", FormComponent);
```

### addById

For objects that have an `id` property, `addById()` is a shorthand that uses
`item.id` as the key:

```js
const actions = new Registry({ name: "actions" });

const action = { id: "save", label: "Save", run: () => {} };
actions.addById(action);

actions.get("save"); // returns the action object
```

### Registry Sequencing

Like resources, registry entries are sorted by sequence (default: 50,
ascending):

```js
const r = new Registry();
r.add("a", "first", { sequence: 10 });
r.add("b", "middle"); // sequence 50
r.add("c", "last", { sequence: 100 });

r.items(); // ["first", "middle", "last"]
r.entries(); // [["a", "first"], ["b", "middle"], ["c", "last"]]
```

### Registry Type Validation

Pass a `validation` option to validate values on `add()` and `addById()`:

```js
const views = new Registry({
  name: "views",
  validation: t.constructor(Component),
});

views.add("list", ListComponent); // ok
views.add("oops", "not a component"); // throws validation error
```

## Reactivity

Both `Resource.items` and `Registry.items`/`Registry.entries` are reactive
computed values. Reading them inside a component render or an effect
automatically subscribes to changes:

```js
const registry = new Registry();
registry.add("a", 1);

effect(() => {
  console.log(registry.items()); // re-runs when entries change
});

registry.add("b", 2);
await Promise.resolve();
// effect re-runs, logs [1, 2]
```

In component templates, this works naturally:

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

The component will re-render whenever items are added or removed from the
resource.
