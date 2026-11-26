# Examples

A few end-to-end patterns, each one isolating a feature set. Every
example is self-contained and can be pasted into an empty Owl app.

## Relations with auto-linked inverse

Setting a `many2one` appends to the corresponding `one2many` on the
other side automatically, as long as you declare `inverse`.

```js
import { fields, Model, ORM } from "@odoo/owl-orm";

class User extends Model {
  static id = "user";
  name = fields.char();
  tasks = fields.one2many({ comodel: () => Task, inverse: "author" });
}

class Task extends Model {
  static id = "task";
  title = fields.char({ required: true });
  done = fields.bool();
  author = fields.many2one({ comodel: () => User });
}

const orm = new ORM();
const alice = orm.create(User, { name: "Alice" });

orm.create(Task, { title: "Write docs", author: alice });
orm.create(Task, { title: "Ship it", author: alice });

alice.tasks().map((t) => t.title()); // ["Write docs", "Ship it"]

// Reassigning the many2one also moves the task on the inverse side:
const bob = orm.create(User, { name: "Bob" });
alice.tasks()[0].author.set(bob);
alice.tasks().length; // 1
bob.tasks().length;   // 1
```

## Save button driven by `pendingChanges`

Disable a save button when there's nothing to save, enable it the
moment anything becomes dirty. No manual subscription — the template
reads `pendingChanges()` directly.

```js
import { Component, mount, xml } from "@odoo/owl";
import { fields, Model, ORM } from "@odoo/owl-orm";

class Task extends Model {
  static id = "task";
  title = fields.char();
  done = fields.bool();
}

class TaskEditor extends Component {
  static template = xml`
    <ul>
      <li t-foreach="this.orm.records(Task)" t-as="task" t-key="task.id">
        <input type="checkbox" t-model="task.done"/>
        <input t-model="task.title"/>
        <span t-if="task.isDirty()"> •</span>
      </li>
    </ul>
    <button t-on-click="this.save" t-att-disabled="this.nothingPending()">
      Save
    </button>`;

  Task = Task;

  setup() {
    this.orm = new ORM();
    this.orm.create(Task, { title: "Buy milk" });
    this.orm.flush(); // start clean — no pending changes
  }

  nothingPending() {
    return Object.keys(this.orm.pendingChanges()).length === 0;
  }

  async save() {
    const changes = this.orm.pendingChanges();
    await fetch("/api/save", {
      method: "POST",
      body: JSON.stringify(changes),
    });
    this.orm.flush();
  }
}

mount(TaskEditor, document.body);
```

## Modal edit with a draft

Forking the ORM into a draft gives the user an isolated sandbox. They
can freely edit, cancel with `discard()`, or apply their changes with
`commit()`:

```js
class UserRow extends Component {
  static template = xml`
    <div t-if="!this.draft">
      <span t-out="this.props.user.name()"/>
      <button t-on-click="this.edit">Edit</button>
    </div>
    <div t-else="">
      <input t-model="this.draftCopy.name"/>
      <button t-on-click="this.save">Save</button>
      <button t-on-click="this.cancel">Cancel</button>
    </div>`;

  static props = ["user"];

  edit() {
    this.draft = this.props.user.orm.draft();
    this.draftCopy = this.draft.getById(User, this.props.user.id);
  }

  save() {
    this.draft.commit();
    this.draft = null;
  }

  cancel() {
    this.draft = null; // letting it go is enough; no cleanup needed
  }
}
```

## Computed fields

Records are classes, so `computed` from `@odoo/owl` works as a
derived field that caches until a dependency changes:

```js
import { computed } from "@odoo/owl";

class Task extends Model {
  static id = "task";
  title = fields.char();
  done = fields.bool();

  label = computed(() => (this.done() ? "✓ " : "○ ") + this.title());
}

const orm = new ORM();
const t = orm.create(Task, { title: "Write docs" });
t.label();       // "○ Write docs"
t.done.set(true);
t.label();       // "✓ Write docs" — recomputed lazily on read
```

## `onChange` to intercept writes

Use `onChange` to validate, normalize, or cascade. Call `setValue(v)`
to commit the write, or skip the call to veto it.

```js
class User extends Model {
  static id = "user";
  name = fields.char({
    onChange(value, setValue) {
      setValue(value.trim().slice(0, 80));
    },
  });
}

const u = orm.create(User, { name: "Alice" });
u.name.set("  Bob the Very Long Name That Goes On And On...  ");
u.name(); // trimmed and truncated
```

## Server round-trip via `applyChanges`

`pendingChanges()` produces a changeset; `applyChanges()` consumes one.
This is the canonical pattern for syncing with a server that returns
a patched version of what you submitted (server-assigned IDs,
validation fixups, server-side defaults, etc.):

```js
async function save(orm) {
  const localChanges = orm.pendingChanges();
  const serverPatch = await api.save(localChanges);
  // Apply anything the server changed (e.g. generated IDs, audit fields)
  orm.applyChanges(serverPatch, [User, Task]);
  orm.flush();
}
```
