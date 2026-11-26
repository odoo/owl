# Fields

Fields are declared by calling a function from the `fields` namespace in a
class property position on a [Model](model.md). Each call returns a signal:
reading the property with `()` returns the current value, and `.set(v)`
writes a new one.

```js
import { fields, Model } from "@odoo/owl-orm";

class Task extends Model {
  static id = "task";
  title = fields.char();
  priority = fields.number({ defaultValue: 0 });
}

const t = orm.create(Task, { title: "Write docs" });
t.title();              // "Write docs"
t.title.set("Updated"); // writes; any reader re-runs
t.priority();           // 0
```

## Common options

All field factories accept a common set of options:

| Option         | Type                                  | Description                                                             |
| -------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `defaultValue` | `T` or `() => T`                      | Initial value. Function form is evaluated once, at record creation.     |
| `required`     | `boolean`                             | If true, `create()` throws when the field is missing or empty.          |
| `readonly`     | `boolean`                             | If true, `field.set(...)` throws on non-draft records.                  |
| `selection`    | `T[]`                                 | Restricts valid values. `set` throws on a value outside the list.       |
| `onChange`     | `(newValue, setValue) => void`        | Intercepts writes. Call `setValue(v)` to commit, or skip to veto.       |

## `char`

A string field. Default value: `""`.

```js
name = fields.char({ required: true });
```

## `number`

A numeric field. Default value: `0`.

```js
priority = fields.number({ defaultValue: 10 });
```

## `bool`

A boolean field. Default value: `false`. Works directly with `t-model` on
checkboxes.

```js
done = fields.bool();
```

## `json`

An opaque field for arbitrary JSON-serializable data. Default value: `null`.
Use it when the shape doesn't warrant its own model — for example free-form
metadata or serialized settings.

```js
metadata = fields.json({ defaultValue: () => ({}) });
```

## `many2one`

A reference to a single record of another model. Reading the field yields
the referenced record (or `null`). `comodel` is a thunk, which lets you
reference models that aren't defined yet at the point of declaration
(useful for circular or forward references).

```js
class Task extends Model {
  static id = "task";
  title = fields.char();
  author = fields.many2one({ comodel: () => User });
}

const alice = orm.create(User, { name: "Alice" });
const t = orm.create(Task, { title: "Write docs", author: alice });
t.author();         // the Alice record
t.author()?.name(); // "Alice"
```

In `create()` and JSON, many2one values can be either the target record or
its id — both are accepted.

## `one2many`

A collection of references. The inverse of a `many2one`. When you pass
`inverse` naming the corresponding many2one on the other side, the ORM
keeps both ends in sync automatically: creating a task with
`author: alice` appends it to `alice.tasks()`.

```js
class User extends Model {
  static id = "user";
  name = fields.char();
  tasks = fields.one2many({ comodel: () => Task, inverse: "author" });
}

class Task extends Model {
  static id = "task";
  title = fields.char();
  author = fields.many2one({ comodel: () => User });
}

const alice = orm.create(User, { name: "Alice" });
orm.create(Task, { title: "A", author: alice });
orm.create(Task, { title: "B", author: alice });
alice.tasks().map((t) => t.title()); // ["A", "B"]
```

The default value of a one2many is `[]`.
