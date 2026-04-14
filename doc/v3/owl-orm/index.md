# Owl ORM

`@odoo/owl-orm` is a reactive in-memory data layer built on top of Owl's
[signal-based reactivity](/v3/owl/reference/reactivity). It lets you describe
your domain as a set of classes (*models*), create and manipulate records
through a central store (the *ORM*), and have every UI that reads those
records update automatically when they change.

The ORM is designed for the same kind of data Odoo's web client deals with:
typed fields, relations between models (many2one, one2many), dirty tracking,
draft/commit workflows, and JSON round-tripping. But it has no server
coupling — it's a plain client-side library that works equally well in any
Owl application.

## At a glance

- **Typed fields** — `char`, `number`, `bool`, `json`, plus relational
  `many2one` / `one2many`. Each field is a signal, so reads track dependencies.
- **Record classes** — models are ordinary ES6 classes extending `Model`, so
  you can add methods, getters, and hooks (`setup`, `onCreate`) alongside the
  declared fields.
- **Dirty tracking** — the ORM knows which records have been created, updated,
  or deleted since the last `flush()`. Useful for save-dialog indicators and
  for computing payloads to send to a server.
- **Drafts** — `orm.draft()` produces a child ORM that sees the parent's data
  but accumulates changes locally. `commit()` applies them back atomically;
  `discard()` throws them away.
- **JSON round-trip** — `orm.toJSON()` / `ORM.fromJSON(json, models)` for
  persistence, hydration, and testing.

## Quick example

```javascript
import { Component, mount, xml } from "@odoo/owl";
import { fields, Model, ORM } from "@odoo/owl-orm";

class Task extends Model {
  static id = "task";
  title = fields.char({ required: true });
  done = fields.bool({ defaultValue: false });
}

class TaskList extends Component {
  static template = xml`
    <ul>
      <li t-foreach="this.orm.records(Task)" t-as="task" t-key="task.id">
        <input type="checkbox" t-model="task.done"/>
        <span t-out="task.title()"/>
      </li>
    </ul>
    <button t-on-click="this.add">Add</button>`;

  Task = Task;
  orm = new ORM();

  setup() {
    this.orm.create(Task, { title: "Buy milk" });
    this.orm.create(Task, { title: "Write docs" });
  }

  add() {
    this.orm.create(Task, { title: "New task" });
  }
}

mount(TaskList, document.body);
```

Every field is a signal: `task.title()` reads, `task.done.set(true)` writes.
The `t-foreach` over `orm.records(Task)` re-runs whenever records are added
or removed, and each `t-out="task.title()"` re-renders on a field change —
no manual subscriptions.

## Next steps

- [Overview](reference/overview) — the full public API at a glance.
- [Examples](reference/examples) — end-to-end snippets for common patterns.
- [Model](reference/model) — declaring models, identity, lifecycle hooks.
- [Fields](reference/fields) — the field types and their options.
- [ORM](reference/orm) — creating, reading, deleting, serializing, and
  the draft/flush/discard workflow.
