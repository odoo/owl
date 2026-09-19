# ORM

The `ORM` class is the central store. It owns the tables of records for each
[model](model.md), hands out records, tracks changes, and (optionally)
integrates with the surrounding [Scope](/v3/owl/reference/scope) so records
share the lifetime of their owning component or plugin.

## Creating an ORM

```js
import { ORM } from "@odoo/owl-orm";

const orm = new ORM();
```

If `new ORM()` is called inside an active scope (a component's `setup`, a
plugin constructor, or any callback reachable from one), the ORM captures
that scope. Records created through the ORM are then constructed under that
scope — their internal computations are disposed automatically when the
scope is destroyed. If no scope is active, the ORM is standalone.

## Create

`orm.create(Model, initialState?)` instantiates a record, registers it, and
returns it. The `initialState` is optional and may include `id` (otherwise
one is generated via `ORM.uuid()`):

```js
const alice = orm.create(User, { name: "Alice" });
const bob = orm.create(User, { id: "u2", name: "Bob" });
```

`initialState` may contain any fields declared on the model, including
relational ones. For `many2one`, pass either the target record or its id;
for `one2many`, pass an array of records or ids. Unknown field names
throw.

Missing `required` fields throw; values outside a field's `selection`
throw.

`onCreate()` is called on the new record once it is fully initialized
(only on a root ORM — see [Drafts](#drafts)).

## Reading records

```js
orm.records(Task);        // Task[] — all active records
orm.records$(Task);       // ReactiveValue<Task[]> — underlying computed
orm.getById(Task, "id1"); // Task | null
```

- `records(M)` is reactive: inside a template or a `computed`, the call
  re-subscribes to any change in the set of active records (creations,
  deletions, draft operations). It does *not* react to field changes —
  those are tracked through the record's own field signals.
- `records$(M)` returns the underlying `ReactiveValue` without calling it.
  Use it when you need to hand off reactivity to a layer that expects a
  signal-like value (other `computed`s, plugins).
- `getById(M, id)` returns `null` rather than throwing when the id is
  unknown.

## Deleting

```js
orm.delete(task); // via the ORM
task.delete();    // shortcut — equivalent
```

Both mark the record as deleted. It stops appearing in `orm.records(M)`,
and its deletion is part of [`orm.pendingChanges()`](#pendingchanges)
until [`flush()`](#flush) is called. Inverse relationships are kept in
sync: deleting a `User` unlinks the deleted user from any `Task.author`
pointing to it (and correspondingly shrinks `user.tasks`).

## Serialization

Every record exposes `toJSON()`, producing a plain object suitable for
`JSON.stringify`. The ORM aggregates all records by model id:

```js
orm.toJSON();
// {
//   user: [{ id: "u1", name: "Alice" }],
//   task: [{ id: "t1", title: "A", author: "u1", done: false }]
// }
```

Relational fields are serialized to ids (a string for `many2one`, an
array of strings for `one2many`), not nested objects — which keeps
output compact and round-trippable.

To restore a snapshot, use the static `ORM.fromJSON(json, models)`. You
must supply the list of model classes so the ORM can map model ids back
to classes:

```js
import { ORM } from "@odoo/owl-orm";

const restored = ORM.fromJSON(json, [User, Task]);
```

During hydration, `setup()` runs on each record; `onCreate()` does **not**
— hydration is not a creation event.

## Dirty tracking

The ORM separates *live* data from *pending* changes. Every creation,
field update, or deletion is recorded as a pending change until you
either [flush](#flush) it (acknowledge and reset the baseline) or
[discard](#discard) it (throw it away).

Every record has an `isDirty()` method returning whether the record has
been modified since the last flush:

```js
const orm = new ORM();
const r = orm.create(User, { name: "Alice" });
orm.flush();

r.isDirty();    // false
r.name.set("Alice B.");
r.isDirty();    // true
orm.flush();
r.isDirty();    // false
```

`isDirty()` is a reactive read — you can use it directly in a template to
highlight unsaved records, or feed it into a `computed` for a global
"dirty" indicator.

## `pendingChanges`

`orm.pendingChanges()` is a reactive changeset of everything that has
happened since the last flush, grouped by model id:

```js
const orm = new ORM();
orm.flush();

const u = orm.create(User, { name: "Alice" });
u.name.set("Alice B.");

orm.pendingChanges();
// {
//   user: {
//     additions: [{ id: "...", name: "Alice B." }]
//   }
// }
```

A changeset may contain `additions`, `updates`, and `deletions`:

- `additions`: array of full JSON snapshots for newly created records.
- `updates`: array of diffs `{ id, <changed fields> }` for records that
  existed before the last flush and have been modified since.
- `deletions`: array of ids that have been marked for deletion.

Because `pendingChanges()` is a `computed`, templates and effects can
read it directly — a save button can be disabled when it's empty without
any manual subscription.

## `flush`

`flush()` acknowledges all pending changes on a **root** ORM: it bakes
current field values into the baseline, consolidates the set of active
records, and resets dirty tracking. It does *not* persist anything on
its own — that's the caller's responsibility (e.g. sending the changeset
to a server). Typical pattern:

```js
const changes = orm.pendingChanges();
await api.save(changes);
orm.flush();
```

After `flush()`, `pendingChanges()` is `{}` and `isDirty()` is `false`
on every record.

`flush()` throws if called on a draft ORM — drafts use
[`commit()`](#drafts) instead.

## `discard`

`discard()` throws away every pending change. Creations disappear,
deletions are reverted, and updated fields revert to their pre-edit
values. Use it for a "cancel" button:

```js
orm.discard();
```

## Drafts

`orm.draft()` returns a child ORM that shares the parent's records as a
read-only baseline but accumulates its own changes. It's a clean way to
implement a modal edit: the user operates on the draft, and you either
`commit()` the result back to the parent or throw the draft away.

```js
const draft = orm.draft();
const copy = draft.getById(User, alice.id);
copy.name.set("Alice B.");
copy.isDirty();   // true
alice.name();     // "Alice" — parent untouched
alice.isDirty();  // false

draft.commit();
alice.name();     // "Alice B."
```

Key properties of a draft:

- Records in the parent appear in the draft lazily: the first time you
  look one up with `getById`, a draft-local copy is forked.
- Creations, updates, and deletions in the draft are invisible to the
  parent until `commit()`.
- `commit()` applies every change atomically via
  [`applyChanges`](#applychanges). Additions fire `onCreate()` on the
  parent records after they land.
- A draft can be discarded simply by letting it go out of scope, or
  explicitly with `discard()`.

`commit()` throws on a root ORM — use [`flush()`](#flush) there instead.

## `applyChanges`

`orm.applyChanges(changeset, models)` is the inverse of
[`pendingChanges()`](#pendingchanges): it consumes a `{ modelId: {
additions, updates, deletions } }` object and applies it. This is what
powers `commit()` internally, and it's also how you ingest a changeset
computed elsewhere — for example a patch returned by a server after a
save:

```js
const changes = orm.pendingChanges();
const patch = await api.save(changes);
orm.applyChanges(patch, [User, Task]);
orm.flush();
```

`models` is required whenever the changeset might mention a model id
the ORM has not yet seen. For changesets that only touch already-known
models, it may be omitted.

When `applyChanges()` creates new records, `onCreate()` is **not**
called — the records are considered to be coming from the outside (a
peer ORM, the server), not locally created.

## Example: component-scoped store

A typical pattern: instantiate the ORM in a component's `setup`, populate
it from props or a fetch, and render from it. The scope integration means
the ORM and its records are disposed with the component:

```js
import { Component, onWillStart, xml } from "@odoo/owl";
import { ORM } from "@odoo/owl-orm";
import { User, Task } from "./models";

class Workspace extends Component {
  static template = xml`
    <ul>
      <li t-foreach="this.orm.records(Task)" t-as="t" t-key="t.id">
        <t t-out="t.title()"/> — <t t-out="t.author()?.name()"/>
      </li>
    </ul>`;

  setup() {
    this.orm = new ORM();
    onWillStart(async () => {
      const data = await fetch("/api/workspace").then((r) => r.json());
      this.orm.loadJSON(data, [User, Task]);
    });
  }
}
```
