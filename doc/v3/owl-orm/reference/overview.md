# Reference

Everything exported by `@odoo/owl-orm`.

## Model

- [`Model`](model.md): base class for all records. Subclass it, set a static
  `id`, and declare fields as class properties.
- [`setup`](model.md#setup-and-oncreate): runs on every instantiation,
  including hydration and drafts.
- [`onCreate`](model.md#setup-and-oncreate): runs only when a record is
  freshly created on a root ORM.
- [`record.id`](model.md#identity): string identifier.
- [`record.orm`](model.md#identity): back-reference to the owning ORM.
- [`record.isDirty()`](orm.md#dirty-tracking): reactive — has this record
  changed since the last flush?
- [`record.delete()`](orm.md#deleting): shortcut for
  `record.orm.delete(record)`.
- [`record.toJSON()`](orm.md#serialization): plain-object snapshot.

## Fields

- [`fields.char`](fields.md#char): a string field.
- [`fields.number`](fields.md#number): a numeric field.
- [`fields.bool`](fields.md#bool): a boolean field.
- [`fields.json`](fields.md#json): an opaque JSON-serializable field.
- [`fields.many2one`](fields.md#many2one): a reference to a single record
  of another model.
- [`fields.one2many`](fields.md#one2many): a collection of references,
  with an optional `inverse` linking it to a `many2one` on the other side.

All field factories share a common [options table](fields.md#common-options)
(`defaultValue`, `required`, `readonly`, `selection`, `onChange`).

## ORM

- [`new ORM()`](orm.md#creating-an-orm): create a root store. Implicitly
  attaches to the current [Scope](/v3/owl/reference/scope) if one is active,
  so records participate in the component/plugin lifetime.
- [`ORM.fromJSON`](orm.md#serialization): construct an ORM from a JSON dump.
- [`orm.create(M, init?)`](orm.md#create): add a new record.
- [`orm.records(M)`](orm.md#reading-records): array of all active records of
  a model. Reactive — callers re-run when the set changes.
- [`orm.records$(M)`](orm.md#reading-records): the underlying computed
  signal, for passing reactivity to another layer.
- [`orm.getById(M, id)`](orm.md#reading-records): look up a single record.
- [`orm.delete(record)`](orm.md#deleting): mark a record for deletion.
- [`orm.toJSON()`](orm.md#serialization): serialize all active records.

## Drafts and dirty tracking

- [`orm.draft()`](orm.md#drafts): fork the ORM into a child that sees parent
  data but accumulates changes locally.
- [`orm.commit()`](orm.md#drafts): apply a draft's changes to its parent.
- [`orm.discard()`](orm.md#discard): drop all pending changes on this ORM.
- [`orm.flush()`](orm.md#flush): acknowledge pending changes on a root ORM,
  baking them in and resetting dirty tracking.
- [`orm.pendingChanges()`](orm.md#pendingchanges): a reactive changeset of
  everything added, updated, or deleted since the last flush.
- [`orm.applyChanges(changeset, models)`](orm.md#applychanges): apply a
  changeset produced by `pendingChanges()` (e.g. from another ORM, or from
  the server).
