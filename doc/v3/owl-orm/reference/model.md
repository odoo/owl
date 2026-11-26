# Model

## Introduction

A **model** is a class that describes the shape and behavior of a kind of
record. It subclasses `Model`, sets a unique `static id`, and declares its
fields as class properties. You never instantiate a model with `new` — the
[ORM](orm.md) does that for you via `orm.create(M, ...)`, so that the record
is registered and tracked.

```js
import { fields, Model } from "@odoo/owl-orm";

class Task extends Model {
  static id = "task";
  title = fields.char({ required: true });
  done = fields.bool({ defaultValue: false });
}
```

See [Fields](fields.md) for the full list of field types and options.

## Identity

Every record has a string `id`. If you don't supply one at creation, the ORM
generates one with `ORM.uuid()`. IDs are stable within an ORM and used to
establish relationships.

```js
const record = orm.create(Task, { title: "Write docs" });
record.id;  // e.g. "lr4f0z3g-7a1b-c2d4"
record.orm; // back-reference to the ORM that owns it
```

## `setup` and `onCreate`

Models support two lifecycle methods:

- **`setup()`** runs every time a record is instantiated — including when it
  is hydrated from JSON or forked into a draft. Use it for local state that
  must exist for every live instance of the record.
- **`onCreate()`** runs only when a record is freshly created via
  `orm.create(...)` on a root ORM. It does *not* run during JSON loading or
  inside a draft. Use it for side effects that should fire exactly once per
  record creation event (logging, notifications, triggering a save).

```js
class Task extends Model {
  static id = "task";
  title = fields.char();

  setup() {
    // runs on every instantiation (including drafts and hydration)
  }

  onCreate() {
    // runs once, when create() is called on a root ORM
    console.log(`Created task ${this.id}`);
  }
}
```

## Methods on records

Since models are plain classes, you can add any methods, getters, or
computed properties you need. Reading fields inside a method participates
in reactivity exactly like reading them in a template:

```js
import { computed } from "@odoo/owl";

class Task extends Model {
  static id = "task";
  title = fields.char();
  done = fields.bool();

  label = computed(() => (this.done() ? "✓ " : "○ ") + this.title());
}

const t = orm.create(Task, { title: "Write docs" });
t.label(); // "○ Write docs"
t.done.set(true);
t.label(); // "✓ Write docs"
```

## Scope integration

When you `new ORM()` inside an active [Scope](/v3/owl/reference/scope) —
for example in a component's `setup` or a plugin constructor — the ORM
captures that scope and runs every record's constructor (and therefore
every field signal creation) inside it. This means any computations
registered via `computed(...)` on a model class are tied to the scope's
lifetime and disposed when the component unmounts or the plugin is
destroyed. No manual cleanup is needed.

## Built-in record API

In addition to user-defined methods and fields, every record has:

- `record.id` — string identifier.
- `record.orm` — back-reference to the owning [ORM](orm.md).
- `record.isDirty()` — has this record changed since the last
  [`flush()`](orm.md#flush)? Reactive.
- `record.delete()` — shortcut for `record.orm.delete(record)`.
- `record.toJSON()` — plain-object snapshot of this record's fields. See
  [Serialization](orm.md#serialization).
