import { Component, mount, Plugin, plugin, Signal, xml } from "@odoo/owl";
import { fields, Model, ORM } from "../src/";
import { makeTestFixture, spyEffect, waitScheduler } from "./helpers";

let nextId = 1;
ORM.uuid = () => `${nextId++}`;

beforeEach(() => {
  nextId = 1;
});

describe("basic features", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();
  }

  class B extends Model {
    static id = "b";
    blip = fields.number();

    getValue(): number {
      return this.blip();
    }
  }

  test("can instantiate a record", () => {
    const orm = new ORM();
    const record1 = orm.create(A);
    expect(record1).toBeInstanceOf(A);
    expect(record1.id).toBe("1");
    expect(record1.blip()).toBe("");
    const record2 = orm.create(A, { blip: "hey" });
    expect(record2.blip()).toBe("hey");
  });

  test("setup is called", () => {
    const steps: string[] = [];
    class A extends Model {
      static id = "a";
      blip = fields.char();

      setup() {
        steps.push("in setup " + this.blip());
      }
    }
    const orm = new ORM();
    orm.create(A, { blip: "abc" });
    expect(steps).toEqual(["in setup abc"]);
  });

  test("can instantiate and call a method on a record", () => {
    const orm = new ORM();
    const record = orm.create(B, { blip: 3 });
    expect(record.getValue()).toBe(3);
    expect(orm.records(B).map((b) => b.getValue())).toEqual([3]);
  });

  test("can serialize a record", () => {
    class A extends Model {
      static id = "a";
      blip = fields.char();
    }

    class B extends Model {
      static id = "b";
      foo = fields.number();
    }

    const orm = new ORM();
    const record1 = orm.create(A, { blip: "yop" });
    expect(record1.toJSON()).toEqual({ id: "1", blip: "yop" });
    const record2 = orm.create(B, { foo: 43 });
    expect(record2.foo()).toBe(43);
    expect(record2.toJSON()).toEqual({ id: "2", foo: 43 });
  });

  test("crashes if invalid field given in create method initial state", () => {
    class A extends Model {
      static id = "a";
      blip = fields.char();
    }

    const orm = new ORM();
    expect(() => orm.create(A, { blipp: "yop" })).toThrow();
  });

  test("can delete a record, 2", () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);
    expect(orm.records(A).map((r) => r.id)).toEqual(["1"]);
    const r = orm.getById(A, "1")!;
    r.orm.delete(r);
    expect(orm.records(A)).toEqual([]);
    expect(orm.pendingChanges()).toEqual({ a: { deletions: ["1"] } });
  });

  test("can delete a record via record.delete()", () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);
    const r = orm.getById(A, "1")!;
    r.delete();
    expect(orm.records(A)).toEqual([]);
    expect(orm.pendingChanges()).toEqual({ a: { deletions: ["1"] } });
  });

  test("isDirty is false on a fresh record", () => {
    const orm = new ORM();
    const r = orm.create(A, { blip: "hey" });
    orm.flush();
    expect(r.isDirty()).toBe(false);
  });

  test("isDirty is true after a field change", () => {
    const orm = new ORM();
    const r = orm.create(A, { blip: "hey" });
    orm.flush();
    r.blip.set("changed");
    expect(r.isDirty()).toBe(true);
  });

  test("isDirty resets after flush", () => {
    const orm = new ORM();
    const r = orm.create(A, { blip: "hey" });
    orm.flush();
    r.blip.set("changed");
    expect(r.isDirty()).toBe(true);
    orm.flush();
    expect(r.isDirty()).toBe(false);
  });

  test("isDirty resets after discard", () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);
    const r = orm.getById(A, "1")!;
    r.blip.set("changed");
    expect(r.isDirty()).toBe(true);
    orm.discard();
    expect(r.isDirty()).toBe(false);
  });

  test("can set a value", () => {
    const orm = new ORM();

    const record = orm.create(A, { blip: "hey" });
    expect(record.blip()).toBe("hey");
    record.blip.set("you");
    expect(record.blip()).toBe("you");
  });

  test("can get a signal to read and set a value", () => {
    const orm = new ORM();

    const record = orm.create(A, { blip: "hey" });
    expect(record.blip()).toBe("hey");
    record.blip.set("you");
    expect(record.blip()).toBe("you");
  });

  test("can read records", () => {
    const orm = new ORM();

    const records = orm.records(A);
    expect(records).toEqual([]);

    const record = orm.create(A, { blip: "hey" });
    expect(record.blip()).toBe("hey");

    const records2 = orm.records(A);
    expect(records2).toEqual([record]);
  });

  test("can get records by id", () => {
    const orm = new ORM();

    const r1 = orm.create(A, { blip: "hey" });
    const r2 = orm.getById(A, r1.id);
    const r3 = orm.records(A)[0];
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(orm.getById(A, "dfsaf")).toBeNull();
  });

  test("can make an object from a record", () => {
    const orm = new ORM();
    const record = orm.create(A, { blip: "aaa" });
    expect(record.toJSON()).toEqual({ id: "1", blip: "aaa" });
  });

  test("can see the changes", () => {
    const orm = new ORM();

    const record = orm.create(A, { blip: "hey" });
    expect(record.blip()).toBe("hey");
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "hey" }],
      },
    });
    record.blip.set("you");
    expect(record.blip()).toBe("you");
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "you" }],
      },
    });

    orm.flush();
    expect(orm.pendingChanges()).toEqual({});
  });

  test("can discard changes", () => {
    const orm = new ORM();

    const record = orm.create(A, { blip: "hey" });
    expect(record.blip()).toBe("hey");
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "hey" }],
      },
    });
    expect(orm.toJSON()).toEqual({ a: [{ id: "1", blip: "hey" }] });
    orm.discard();
    expect(orm.pendingChanges()).toEqual({});
    expect(orm.toJSON()).toEqual({});
  });

  test("discard restores field values on existing records", () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);
    const record = orm.getById(A, "1")!;
    expect(record.blip()).toBe("hey");

    record.blip.set("modified");
    expect(record.blip()).toBe("modified");

    orm.discard();
    expect(record.blip()).toBe("hey");
    expect(orm.pendingChanges()).toEqual({});
  });

  test("adding and deleting a record is a non-operation", () => {
    const orm = new ORM();
    const r = orm.create(A);
    expect(orm.records(A).length).toBe(1);
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "" }],
      },
    });
    orm.delete(r);
    expect(orm.records(A).length).toBe(0);
    expect(orm.pendingChanges()).toEqual({});
  });
});

// ----------------------------------------------------------------------------

describe("default values", () => {
  class A extends Model {
    static id = "a";
    foo = fields.char();
    blip = fields.char({ defaultValue: "asdf" });
    pilb = fields.char({ defaultValue: () => "fdsa" });
  }

  class B extends Model {
    static id = "b";
    a = fields.char();
    b = fields.number();
    c = fields.one2many({ comodel: () => A });
    d = fields.many2one({ comodel: () => A });
    e = fields.bool();
    f = fields.json();
  }
  test("default values work", () => {
    const orm = new ORM();
    const a = orm.create(A);
    expect(a.blip()).toBe("asdf");
    expect(a.pilb()).toBe("fdsa");
  });

  test("function default values are evaluated once at creation time", () => {
    let callCount = 0;
    class T extends Model {
      static id = "t";
      ts = fields.number({ defaultValue: () => ++callCount });
    }
    const orm = new ORM();
    const r = orm.create(T);
    // The default was evaluated once during create
    expect(callCount).toBe(1);
    // Repeated reads return the same frozen value, not a new evaluation
    expect(r.ts()).toBe(1);
    expect(r.ts()).toBe(1);
    expect(callCount).toBe(1);
    // toJSON() also returns the stable value
    expect(r.toJSON()).toEqual({ id: "1", ts: 1 });
    expect(callCount).toBe(1);
  });

  test("function default values produce stable toJSON across pendingChanges and applyChanges", () => {
    // Regression: timestamps in pendingChanges must match what toJSON produces,
    // otherwise a server-ORM sync check would see a spurious mismatch.
    let tick = 0;
    class T extends Model {
      static id = "t";
      ts = fields.number({ defaultValue: () => ++tick });
    }
    const orm = new ORM();
    const serverOrm = new ORM();

    orm.create(T);
    const changes = orm.pendingChanges();
    orm.flush();
    serverOrm.applyChanges(changes, [T]);

    expect(JSON.stringify(orm)).toBe(JSON.stringify(serverOrm));
  });

  test("default values work, part 2", () => {
    const orm = new ORM();
    const a = orm.create(A, { foo: "machin" });
    expect(a.foo()).toBe("machin");
    expect(a.blip()).toBe("asdf");
    expect(a.pilb()).toBe("fdsa");
  });

  test("default values for various field types", () => {
    const orm = new ORM();
    const r = orm.create(B);
    expect(r.toJSON()).toEqual({
      id: "1",
      a: "",
      b: 0,
      c: [],
      d: null,
      e: false,
      f: null,
    });
  });

  test("boolean field with default value true", () => {
    class A extends Model {
      static id = "a";
      b = fields.bool({ defaultValue: true });
    }
    const orm = new ORM();
    const a = orm.create(A);
    expect(a.b()).toBe(true);
    a.b.set(false);
    expect(a.b()).toBe(false);
    orm.flush();
    expect(a.b()).toBe(false);
  });
});

// ----------------------------------------------------------------------------

describe("required fields", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char({ required: true });
  }

  test("required fields work", () => {
    const orm = new ORM();
    expect(() => orm.create(A, {})).toThrow();
    expect(() => orm.create(A, { blip: "a" })).not.toThrow();
    const draft = orm.draft();
    expect(() => draft.create(A, {})).not.toThrow();
    expect(() => draft.create(A, { blip: "a" })).not.toThrow();
  });

  test("committing a record with a missing required field should throw", () => {
    const orm = new ORM();
    const draft = orm.draft();
    draft.create(A);
    expect(() => draft.commit()).toThrow();
  });

  test("required accepts false and 0 as valid values", () => {
    class B extends Model {
      static id = "b";
      n = fields.number({ required: true });
      b = fields.bool({ required: true });
    }
    const orm = new ORM();
    expect(() => orm.create(B, { n: 0, b: false })).not.toThrow();
  });
});

// ----------------------------------------------------------------------------

describe("scalar fields", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();
    robin = fields.number();
  }

  class B extends Model {
    static id = "b";
    blip = fields.bool();
  }

  test("can set and read various fields", () => {
    const orm = new ORM();
    const a = orm.create(A, { blip: "char", robin: 3 });
    expect(a.robin()).toBe(3);
    expect(a.blip()).toBe("char");
  });

  test("can set and read boolean fields", () => {
    const orm = new ORM();
    const b = orm.create(B, { blip: true });
    expect(b.blip()).toBe(true);
    b.blip.set(false);
    expect(b.blip()).toBe(false);
  });

  test("can set fields to falsy values", () => {
    class T extends Model {
      static id = "a";
      blip = fields.char();
      robin = fields.number();
      nibor = fields.bool();
    }

    const orm = new ORM();
    const record = orm.create(T, { blip: "char", robin: 3, nibor: true });
    expect(record.blip()).toBe("char");
    record.blip.set("");
    expect(record.robin()).toBe(3);
    record.robin.set(0);
    expect(record.robin()).toBe(0);

    expect(record.nibor()).toBe(true);
    record.nibor.set(false);
    expect(record.nibor()).toBe(false);
  });

  test("pending changes with falsy values", () => {
    class T extends Model {
      static id = "a";
      blip = fields.char();
      robin = fields.number();
      nibor = fields.bool();
    }

    const orm = new ORM();
    const record = orm.create(T, { blip: "char", robin: 3, nibor: true });
    orm.flush();

    expect(orm.pendingChanges()).toEqual({});
    record.blip.set("");
    record.robin.set(0);
    record.nibor.set(false);
    expect(orm.pendingChanges()).toEqual({
      a: {
        updates: [{ id: "1", blip: "", robin: 0, nibor: false }],
      },
    });
  });

  test("can set and commit fields to falsy values", () => {
    class T extends Model {
      static id = "a";
      blip = fields.char();
      robin = fields.number();
      nibor = fields.bool();
    }

    const orm = new ORM();
    const record = orm.create(T, { blip: "char", robin: 3, nibor: true });
    orm.flush();
    expect(record.nibor()).toBe(true);
    record.nibor.set(false);
    expect(record.nibor()).toBe(false);
    expect(orm.pendingChanges()).toEqual({
      a: {
        updates: [{ id: "1", nibor: false }],
      },
    });
    orm.flush();
    expect(record.nibor()).toBe(false);
  });
});

// ----------------------------------------------------------------------------

describe("many2one", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();
    robin = fields.many2one({ comodel: () => B });
  }

  class B extends Model {
    static id = "b";
    machin = fields.number();
  }

  test("can set and read a many2one", () => {
    const orm = new ORM();
    const b = orm.create(B, { machin: 3 });
    expect(b.machin()).toBe(3);
    const a = orm.create(A, { blip: "char", robin: b });
    expect(b.machin()).toBe(3);
    expect(a.robin()).toBe(b);
    expect(a.robin()!.machin()).toBe(3);
    expect(b.toJSON()).toEqual({ id: "1", machin: 3 });
    expect(a.toJSON()).toEqual({ id: "2", blip: "char", robin: "1" });
    expect(orm.toJSON()).toEqual({
      a: [{ blip: "char", id: "2", robin: "1" }],
      b: [{ id: "1", machin: 3 }],
    });
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ blip: "char", id: "2", robin: "1" }],
      },
      b: {
        additions: [{ id: "1", machin: 3 }],
      },
    });
  });

  test("many2one with falsy value", () => {
    const orm = new ORM();
    const a = orm.create(A, { blip: "char" });
    expect(a.robin()).toBe(null);
    expect(orm.toJSON()).toEqual({
      a: [{ blip: "char", id: "1", robin: null }],
    });
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ blip: "char", id: "1", robin: null }],
      },
    });
  });

  test("can set and read a many2one, with id", () => {
    const orm = new ORM();
    const b = orm.create(B, { machin: 3 });
    const a = orm.create(A, { blip: "char", robin: b.id });
    expect(a.robin()).toBe(b);
    expect(a.robin()!.machin()).toBe(3);
    expect(b.toJSON()).toEqual({ id: "1", machin: 3 });
    expect(a.toJSON()).toEqual({ id: "2", blip: "char", robin: "1" });
    expect(orm.toJSON()).toEqual({
      a: [{ blip: "char", id: "2", robin: "1" }],
      b: [{ id: "1", machin: 3 }],
    });
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ blip: "char", id: "2", robin: "1" }],
      },
      b: {
        additions: [{ id: "1", machin: 3 }],
      },
    });
  });

  test("can deserialize many2ones", () => {
    const orm = ORM.fromJSON(
      {
        a: [{ blip: "char", id: "2", robin: "1" }],
        b: [{ id: "1", machin: 3 }],
      },
      [A, B],
    );
    expect(orm.toJSON()).toEqual({
      a: [{ blip: "char", id: "2", robin: "1" }],
      b: [{ id: "1", machin: 3 }],
    });
  });

  test("can deserialize many2ones (different order)", () => {
    const orm = ORM.fromJSON(
      {
        b: [{ id: "1", machin: 3 }],
        a: [{ blip: "char", id: "2", robin: "1" }],
      },
      [A, B],
    );
    expect(orm.toJSON()).toEqual({
      b: [{ id: "1", machin: 3 }],
      a: [{ blip: "char", id: "2", robin: "1" }],
    });
  });
});

// ----------------------------------------------------------------------------

describe("one2many", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();
    robin = fields.one2many({ comodel: () => B, inverse: "dd" });
  }

  class B extends Model {
    static id = "b";
    machin = fields.number();
  }

  class C extends Model {
    static id = "c";
    items = fields.one2many({ comodel: () => D, inverse: "c" });
  }

  class D extends Model {
    static id = "d";
    c = fields.many2one({ comodel: () => C });
  }

  test("can set and read a one2many", () => {
    const orm = new ORM();
    const b = orm.create(B, { machin: 3 });
    const a = orm.create(A, { blip: "char", robin: [b] });
    expect(a.toJSON()).toEqual({
      id: "2",
      blip: "char",
      robin: ["1"],
    });
    const records = a.robin();
    expect(records.map((r) => r.toJSON())).toEqual([
      {
        id: "1",
        machin: 3,
      },
    ]);

    const a2 = orm.create(A);
    expect(a2.toJSON()).toEqual({
      id: "3",
      blip: "",
      robin: [],
    });
  });

  test("one2many and many2one", () => {
    const orm = new ORM();
    const c = orm.create(C);
    expect(c.toJSON()).toEqual({ id: "1", items: [] });
    const d = orm.create(D, { c });
    expect(d.c()).toBe(c);
    expect(c.items()).toEqual([d]);
    expect(d.toJSON()).toEqual({ id: "2", c: "1" });
    expect(c.toJSON()).toEqual({ id: "1", items: ["2"] });
    expect(orm.toJSON()).toEqual({
      c: [{ id: "1", items: ["2"] }],
      d: [{ id: "2", c: "1" }],
    });
  });

  test("one2many and many2one, in draft mode", () => {
    const orm = new ORM();
    const c = orm.create(C);
    orm.flush();
    expect(c.toJSON()).toEqual({ id: "1", items: [] });
    const draft = orm.draft();
    const d = draft.create(D, { c });
    const draftc = draft.getById(C, c.id)!;
    expect(d.c()).toBe(draftc);
    expect(d.c()).not.toBe(c);
    expect(c.items()).toEqual([]);
    expect(draftc.items().map((r) => r.id)).toEqual(["2"]);
    draft.commit();
    expect(c.items().map((r) => r.id)).toEqual(["2"]);
    expect(d.toJSON()).toEqual({ id: "2", c: "1" });
    expect(c.toJSON()).toEqual({ id: "1", items: ["2"] });
    expect(orm.toJSON()).toEqual({
      c: [{ id: "1", items: ["2"] }],
      d: [{ id: "2", c: "1" }],
    });
  });

  test("one2many and many2one, in draft mode, variation", () => {
    const orm = new ORM();
    const c = orm.create(C);
    orm.create(D, { c });
    orm.flush();
    expect(orm.toJSON()).toEqual({
      c: [{ id: "1", items: ["2"] }],
      d: [{ id: "2", c: "1" }],
    });
    const draft = orm.draft();
    expect(draft.toJSON()).toEqual({
      c: [{ id: "1", items: ["2"] }],
      d: [{ id: "2", c: "1" }],
    });
    orm.create(D, { c });
    expect(draft.toJSON()).toEqual({
      c: [{ id: "1", items: ["2", "3"] }],
      d: [
        { id: "2", c: "1" },
        { id: "3", c: "1" },
      ],
    });
    expect(draft.pendingChanges()).toEqual({});
  });

  test("one2many and many2one, pendingchanges", () => {
    const orm = new ORM();
    const c = orm.create(C);
    expect(c.toJSON()).toEqual({ id: "1", items: [] });
    expect(orm.pendingChanges()).toEqual({
      c: {
        additions: [{ id: "1", items: [] }],
      },
    });
    orm.flush();
    expect(orm.pendingChanges()).toEqual({});
    const d = orm.create(D, { c });
    expect(orm.pendingChanges()).toEqual({
      c: {
        updates: [{ id: "1", items: ["2"] }],
      },
      d: {
        additions: [{ id: "2", c: "1" }],
      },
    });
    expect(d.c()).toBe(c);
    expect(d.toJSON()).toEqual({ id: "2", c: "1" });
    expect(c.toJSON()).toEqual({ id: "1", items: ["2"] });
    orm.flush();
    expect(orm.pendingChanges()).toEqual({});
  });

  test("can import cyclic one2many and many2one", () => {
    const orm = new ORM();
    const c = orm.create(C);
    orm.create(D, { c });
    const json = orm.toJSON();
    expect(json).toEqual({
      c: [{ id: "1", items: ["2"] }],
      d: [{ id: "2", c: "1" }],
    });
    const orm2 = ORM.fromJSON(json, [C, D]);
    expect(orm2.toJSON()).toEqual(json);
    // other order
    const json2 = {
      d: [{ id: "2", c: "1" }],
      c: [{ id: "1", items: ["2"] }],
    };
    const orm3 = ORM.fromJSON(json2, [C, D]);
    expect(orm3.toJSON()).toEqual(json);
  });

  test("reading an empty one2many and effects", async () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey", robin: [] }] }, [A]);
    const e = spyEffect(() => {
      orm.pendingChanges();
    });
    e();
    expect(e.spy).toHaveBeenCalledTimes(1);

    const a = orm.getById(A, "1")!;
    await waitScheduler();
    expect(e.spy).toHaveBeenCalledTimes(1);

    //should not have a side effect
    a.robin();
    await waitScheduler();
    expect(e.spy).toHaveBeenCalledTimes(1);
  });

  test("deleting a child updates the one2many and survives serialization", () => {
    class Parent extends Model {
      static id = "parent";
      children = fields.one2many({ comodel: () => Child, inverse: "parent" });
    }
    class Child extends Model {
      static id = "child";
      name = fields.char();
      parent = fields.many2one({ comodel: () => Parent });
    }

    const orm = new ORM();
    const p = orm.create(Parent);
    const c1 = orm.create(Child, { name: "c1", parent: p });
    const c2 = orm.create(Child, { name: "c2", parent: p });

    expect(p.children().map((r) => r.id)).toEqual([c1.id, c2.id]);

    // delete c1
    orm.delete(c1);

    expect(orm.records(Child).map((r) => r.id)).toEqual([c2.id]);
    expect(p.children().map((r) => r.id)).toEqual([c2.id]);

    // commit, serialize, and reload into a fresh ORM
    orm.flush();
    const json = orm.toJSON();
    expect(json).toEqual({
      parent: [{ id: "1", children: [c2.id] }],
      child: [{ id: c2.id, name: "c2", parent: "1" }],
    });

    const orm2 = ORM.fromJSON(json, [Parent, Child]);
    expect(orm2.toJSON()).toEqual(json);

    const p2 = orm2.records(Parent)[0];
    expect(p2.children().length).toBe(1);
    expect(p2.children()[0].name()).toBe("c2");
  });

  test("deleting a child produces correct pendingChanges", () => {
    class Parent extends Model {
      static id = "parent";
      children = fields.one2many({ comodel: () => Child, inverse: "parent" });
    }
    class Child extends Model {
      static id = "child";
      name = fields.char();
      parent = fields.many2one({ comodel: () => Parent });
    }

    const orm = new ORM();
    const p = orm.create(Parent);
    const c1 = orm.create(Child, { name: "c1", parent: p });
    const c2 = orm.create(Child, { name: "c2", parent: p });
    orm.flush();

    expect(orm.pendingChanges()).toEqual({});

    orm.delete(c1);

    expect(orm.pendingChanges()).toEqual({
      parent: {
        updates: [{ id: p.id, children: [c2.id] }],
      },
      child: {
        deletions: [c1.id],
      },
    });
  });
});

// ----------------------------------------------------------------------------

describe("serialization/deserialization", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();
  }

  test("can serialize and deserialize a store", () => {
    const orm = new ORM();
    expect(orm.toJSON()).toEqual({});
    orm.create(A, { blip: "hey" });
    const obj = orm.toJSON();
    expect(obj).toEqual({ a: [{ id: "1", blip: "hey" }] });
    const newStore = ORM.fromJSON(obj, [A]);
    const records = newStore.records(A);
    expect(records.length).toBe(1);
    expect(records[0].blip()).toBe("hey");
  });

  test("can load data from a json", () => {
    const orm = new ORM();
    const json = { a: [{ id: "1", blip: "hey" }] };
    expect(orm.toJSON()).toEqual({});
    orm.loadJSON(json, [A]);
    expect(orm.toJSON()).toEqual({ a: [{ id: "1", blip: "hey" }] });
  });

  test("can apply changes", () => {
    const orm = new ORM();
    orm.create(A, { blip: "hey" });
    orm.flush();
    const json = orm.toJSON();
    const otherOrm = ORM.fromJSON(json, [A]);
    expect(otherOrm.toJSON()).toEqual({
      a: [{ id: "1", blip: "hey" }],
    });
    orm.create(A, { blip: "coucou" });
    const record = orm.records(A)[0];
    expect(record.toJSON()).toEqual({ id: "1", blip: "hey" });
    record.blip.set("you");
    const changes = orm.pendingChanges();
    expect(changes).toEqual({
      a: {
        additions: [{ blip: "coucou", id: "2" }],
        updates: [{ id: "1", blip: "you" }],
      },
    });
    expect(otherOrm.toJSON()).toEqual({
      a: [{ id: "1", blip: "hey" }],
    });
    otherOrm.applyChanges(changes);
    expect(otherOrm.toJSON()).toEqual({
      a: [
        { id: "1", blip: "you" },
        { id: "2", blip: "coucou" },
      ],
    });
  });
  test("can apply changes, 2", () => {
    const orm = new ORM();
    const otherOrm = new ORM();
    orm.create(A, { blip: "coucou" });
    const changes = orm.pendingChanges();
    otherOrm.applyChanges(changes, [A]);
    expect(otherOrm.toJSON()).toEqual({
      a: [{ id: "1", blip: "coucou" }],
    });
  });
});

// ----------------------------------------------------------------------------

describe("fork/commit", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();
  }

  test("commit() throws on a root ORM", () => {
    const orm = new ORM();
    orm.create(A, { blip: "hey" });
    expect(() => orm.commit()).toThrow();
  });

  test("flush() throws on a draft ORM", () => {
    const orm = new ORM();
    const draft = orm.draft();
    draft.create(A, { blip: "hey" });
    expect(() => draft.flush()).toThrow();
  });

  test("can commit simple changes", () => {
    const orm = new ORM();
    expect(orm.toJSON()).toEqual({});
    orm.create(A, { blip: "hey" });

    expect(orm.pendingChanges()).toEqual({
      a: { additions: [{ blip: "hey", id: "1" }] },
    });
    expect(orm.toJSON()).toEqual({
      a: [{ id: "1", blip: "hey" }],
    });

    orm.flush();
    expect(orm.pendingChanges()).toEqual({});
    expect(orm.toJSON()).toEqual({
      a: [{ id: "1", blip: "hey" }],
    });
  });

  test("can commit simple changes, part 2", () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);
    expect(orm.toJSON()).toEqual({
      a: [{ id: "1", blip: "hey" }],
    });

    expect(orm.pendingChanges()).toEqual({});

    const record = orm.getById(A, "1")!;
    record.blip.set("jake");

    expect(orm.pendingChanges()).toEqual({
      a: { updates: [{ id: "1", blip: "jake" }] },
    });

    orm.flush();
    expect(orm.pendingChanges()).toEqual({});
    expect(orm.toJSON()).toEqual({
      a: [{ id: "1", blip: "jake" }],
    });
  });

  test("can fork and commit simple changes", () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);

    expect(orm.pendingChanges()).toEqual({});
    expect(orm.toJSON()).toEqual({
      a: [{ id: "1", blip: "hey" }],
    });

    expect(orm.pendingChanges()).toEqual({});

    const draft = orm.draft();
    expect(draft).not.toBe(orm);

    expect(draft.toJSON()).toEqual({
      a: [{ id: "1", blip: "hey" }],
    });
    expect(draft.pendingChanges()).toEqual({});
    expect(orm.pendingChanges()).toEqual({});

    const record = orm.getById(A, "1");
    const draftRecord = draft.getById(A, "1");
    expect(draftRecord).not.toBe(record);
    draftRecord!.blip.set("coucou");
    expect(orm.pendingChanges()).toEqual({});
    expect(draft.pendingChanges()).toEqual({
      a: {
        updates: [{ id: "1", blip: "coucou" }],
      },
    });

    expect(orm.toJSON()).toEqual({ a: [{ id: "1", blip: "hey" }] });
    expect(draft.toJSON()).toEqual({ a: [{ id: "1", blip: "coucou" }] });
    expect(record!.blip()).toBe("hey");
    expect(draftRecord!.blip()).toBe("coucou");
    draft.commit();
    expect(record!.blip()).toBe("coucou");
    expect(draftRecord!.blip()).toBe("coucou");
    expect(orm.toJSON()).toEqual({
      a: [{ id: "1", blip: "coucou" }],
    });
    expect(draft.toJSON()).toEqual({
      a: [{ id: "1", blip: "coucou" }],
    });
    expect(draft.pendingChanges()).toEqual({});
    expect(orm.pendingChanges()).toEqual({
      a: {
        updates: [{ id: "1", blip: "coucou" }],
      },
    });

    orm.flush();
    expect(orm.toJSON()).toEqual({
      a: [{ id: "1", blip: "coucou" }],
    });
    expect(orm.pendingChanges()).toEqual({});
  });

  test("can fork and create new record", () => {
    const orm = new ORM();
    const draft = orm.draft();
    draft.create(A, { blip: "some text" });
    expect(orm.toJSON()).toEqual({});
    expect(orm.pendingChanges()).toEqual({});
    expect(draft.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "some text" }],
      },
    });
    draft.commit();
    expect(orm.toJSON()).toEqual({ a: [{ id: "1", blip: "some text" }] });
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "some text" }],
      },
    });
  });

  test("can fork create, and update new record", () => {
    const orm = new ORM();
    const draft = orm.draft();
    draft.create(A, { blip: "some text" });
    expect(orm.toJSON()).toEqual({});
    expect(orm.pendingChanges()).toEqual({});
    expect(draft.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "some text" }],
      },
    });

    const record = draft.getById(A, "1")!;
    record.blip.set("coucou");

    expect(record.blip()).toBe("coucou");
    expect(draft.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "coucou" }],
      },
    });
    draft.commit();
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ id: "1", blip: "coucou" }],
      },
    });
    expect(orm.toJSON()).toEqual({ a: [{ id: "1", blip: "coucou" }] });
  });

  test("concurrent drafts: update in one, delete in another", () => {
    // Setup: create a record and commit it so it's valid in the base ORM
    const orm = new ORM();
    orm.create(A, { blip: "hello" });
    orm.flush();
    expect(orm.records(A).length).toBe(1);
    expect(orm.getById(A, "1")!.blip()).toBe("hello");

    // Create two concurrent drafts from the same base ORM
    const draft1 = orm.draft();
    const draft2 = orm.draft();

    // Access records to trigger lazy datapoint creation in both drafts
    expect(draft1.records(A).length).toBe(1);
    expect(draft2.records(A).length).toBe(1);

    // In draft1, update the record's field
    const draft1Record = draft1.getById(A, "1")!;
    draft1Record.blip.set("updated");
    expect(draft1.getById(A, "1")!.blip()).toBe("updated");

    // In draft2, delete the record
    const draft2Record = draft2.getById(A, "1")!;
    draft2.delete(draft2Record);
    expect(draft2.records(A).length).toBe(0);

    // Base ORM still has the original record
    expect(orm.records(A).length).toBe(1);
    expect(orm.getById(A, "1")!.blip()).toBe("hello");

    // Commit draft2 (deletion) first
    draft2.commit();
    expect(orm.records(A).length).toBe(0);

    // Now commit draft1 (update) — should be handled gracefully
    // The record was already deleted, so the update should be silently ignored
    expect(() => draft1.commit()).not.toThrow();
    expect(orm.records(A).length).toBe(0);
  });
});

// ----------------------------------------------------------------------------

describe("effects", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();
    robin = fields.number();
  }

  test("pendingchanges can be observed with effects", async () => {
    const orm = ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);

    const e = spyEffect(() => {
      orm.pendingChanges();
    });
    e();
    expect(e.spy).toHaveBeenCalledTimes(1);

    const record = orm.getById(A, "1")!;
    record.blip.set("coucou");
    await waitScheduler();
    expect(e.spy).toHaveBeenCalledTimes(2);
  });

  test("records$ is a computed value", () => {
    const orm = new ORM();

    const records$ = orm.records$(A);
    expect(records$()).toEqual([]);

    const record = orm.create(A, { blip: "hey" });
    expect(record.blip()).toBe("hey");
    expect(records$()).toEqual([record]);
  });

  test("new records can be observed with effects", async () => {
    const orm = new ORM();

    const e = spyEffect(() => {
      orm.pendingChanges();
    });

    e();
    expect(e.spy).toHaveBeenCalledTimes(1);

    const draft = orm.draft();

    draft.create(A);
    await waitScheduler();

    expect(e.spy).toHaveBeenCalledTimes(1);
    expect(orm.toJSON()).toEqual({});
    expect(orm.pendingChanges()).toEqual({});

    draft.commit();

    expect(orm.toJSON()).toEqual({ a: [{ id: "1", blip: "", robin: 0 }] });
    expect(orm.pendingChanges()).toEqual({
      a: {
        additions: [{ blip: "", id: "1", robin: 0 }],
      },
    });
    expect(e.spy).toHaveBeenCalledTimes(1);
    await waitScheduler();
    expect(e.spy).toHaveBeenCalledTimes(2);
  });
});

// ----------------------------------------------------------------------------

describe("orm and plugins", () => {
  class P extends Plugin {
    static id = "p";
    a = 1;
  }

  class A extends Model {
    static id = "a";
    blip = fields.char();
    p = plugin(P);
  }

  class OrmPlugin extends Plugin {
    static id = "orm";
    orm = new ORM();
  }

  test("a record can use a plugin", async () => {
    let o: any;

    class W extends Component {
      static template = xml``;
      orm = plugin(OrmPlugin);

      setup() {
        o = this.orm;
      }
    }

    await mount(W, makeTestFixture(), { plugins: [OrmPlugin] });

    const a = o.orm.create(A, { blip: 2 });
    expect(a.p.a).toBe(1);
  });
});

// ----------------------------------------------------------------------------

describe("json fields", () => {
  class Car {
    data: Signal<{ speed: number }>;

    constructor(data: Signal<{ speed: number }>) {
      this.data = data;
    }

    vroom(): string {
      return `vroom${this.data().speed}`;
    }

    accelerate() {
      const data = this.data();
      data.speed++;
      this.data.set(data);
    }
  }
  class A extends Model {
    static id = "a";
    car = fields.json();

    c = new Car(this.car);
  }

  test("json fields work", () => {
    const orm = new ORM();
    const a = orm.create(A, { car: { speed: 3, size: "big" } });
    orm.flush();
    // expect(a.record.car.vroom()).toBe("vroom3!");
    expect(a.toJSON()).toEqual({ id: "1", car: { size: "big", speed: 3 } });

    a.car().otherValue = false;
    expect(a.toJSON()).toEqual({
      id: "1",
      car: { size: "big", speed: 3, otherValue: false },
    });
    expect(orm.pendingChanges()).toEqual({});

    a.car.set(a.car());
    expect(orm.pendingChanges()).toEqual({
      a: {
        updates: [
          { id: "1", car: { speed: 3, size: "big", otherValue: false } },
        ],
      },
    });
  });

  test("json fields work can be manipulated with classes", () => {
    const orm = new ORM();
    const a = orm.create(A, { car: { speed: 3, size: "big" } });
    orm.flush();

    expect(a.c.vroom()).toBe("vroom3");
    expect(orm.pendingChanges()).toEqual({});
    a.c.accelerate();
    expect(a.c.vroom()).toBe("vroom4");
    expect(orm.pendingChanges()).toEqual({
      a: { updates: [{ id: "1", car: { size: "big", speed: 4 } }] },
    });
  });
});

// ----------------------------------------------------------------------------

describe("restricted choices: selection", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char({ selection: ["a", "b"] });
  }

  test("cannot create records with value not in selection", () => {
    const createA = (params: { state?: any; draft?: boolean }) => {
      let orm = new ORM();
      if (params.draft) {
        orm = orm.draft();
      }
      return orm.create(A, params.state);
    };
    expect(() => createA({})).toThrow(); // empty string
    expect(() => createA({ state: { blip: "a" } })).not.toThrow();
    expect(() => createA({ state: { blip: "b" } })).not.toThrow();
    expect(() => createA({ state: { blip: "c" } })).toThrow();

    expect(() => createA({ draft: true })).not.toThrow();
    expect(() => createA({ state: { blip: "a" }, draft: true })).not.toThrow();
    expect(() => createA({ state: { blip: "b" }, draft: true })).not.toThrow();
    expect(() => createA({ state: { blip: "c" }, draft: true })).toThrow();
  });

  test("selection field with defaultValue", () => {
    class B extends Model {
      static id = "b";
      status = fields.char({ selection: ["a", "b"], defaultValue: "b" });
    }

    const orm = new ORM();
    const record = orm.create(B);
    expect(record.status()).toBe("b");

    record.status.set("a");
    expect(record.status()).toBe("a");

    expect(() => record.status.set("c")).toThrow();
  });

  test("cannot edit records with value not in selection", () => {
    const edit = (initialState: any, editValue: any, draft?: boolean) => {
      let orm = new ORM();
      if (draft) {
        orm = orm.draft();
      }
      const record = orm.create(A, { blip: initialState });
      record.blip.set(editValue);
    };

    expect(() => edit("a", "b")).not.toThrow();
    expect(() => edit("a", "c")).toThrow();

    expect(() => edit("a", "b", true)).not.toThrow();
    expect(() => edit("a", "c", true)).toThrow();
  });
});

// ----------------------------------------------------------------------------

describe("readonly", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char({ readonly: true });
  }

  test("cannot edit a readonly field", () => {
    const orm = new ORM();

    const record = orm.create(A);
    expect(() => record.blip.set("some value")).toThrow();
  });

  test("can edit a readonly field in draft mode", () => {
    const orm = new ORM();
    const draft = orm.draft();

    const record = draft.create(A);
    record.blip.set("some value");
    expect(record.blip()).toBe("some value");
    draft.commit();
    const r = orm.getById(A, record.id)!;
    expect(() => r.blip.set("some other value")).toThrow();
  });
});

describe("onCreate", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char();

    onCreate() {
      steps.push("onCreate " + this.blip());
    }
  }

  let steps: string[];
  beforeEach(() => {
    steps = [];
  });

  test("onCreate is called when creating a record on the main ORM", () => {
    const orm = new ORM();
    orm.create(A, { blip: "hello" });
    expect(steps).toEqual(["onCreate hello"]);
  });

  test("onCreate is NOT called in draft mode", () => {
    const orm = new ORM();
    const draft = orm.draft();
    draft.create(A, { blip: "hello" });
    expect(steps).toEqual([]);
  });

  test("onCreate IS called when a draft is committed", () => {
    const orm = new ORM();
    const draft = orm.draft();
    draft.create(A, { blip: "hello" });
    expect(steps).toEqual([]);
    draft.commit();
    expect(steps).toEqual(["onCreate hello"]);
  });

  test("onCreate is NOT called when loading from JSON", () => {
    ORM.fromJSON({ a: [{ id: "1", blip: "hey" }] }, [A]);
    expect(steps).toEqual([]);
  });

  test("onCreate is NOT called by applyChanges", () => {
    const orm = new ORM();
    const other = new ORM();
    orm.create(A, { blip: "hello" });
    steps = [];
    other.applyChanges(orm.pendingChanges(), [A]);
    expect(steps).toEqual([]);
  });

  test("applyChanges does not duplicate onCreate side effects when used for server sync", () => {
    // Simulates the store plugin pattern: draft → commit (fires onCreate on
    // main ORM) → applyChanges onto a server ORM (must NOT fire onCreate again)
    const orm = new ORM();
    const serverOrm = new ORM();

    const draft = orm.draft();
    draft.create(A, { blip: "hello" });
    draft.commit();
    expect(steps).toEqual(["onCreate hello"]);

    const changes = orm.pendingChanges();
    orm.flush();
    serverOrm.applyChanges(changes, [A]);
    // onCreate must not have fired a second time
    expect(steps).toEqual(["onCreate hello"]);
  });

  test("onCreate is called once per addition when commit promotes multiple records", () => {
    const orm = new ORM();
    const draft = orm.draft();
    draft.create(A, { blip: "one" });
    draft.create(A, { blip: "two" });
    draft.commit();
    expect(steps).toEqual(["onCreate one", "onCreate two"]);
  });

  test("onCreate can create related records", () => {
    class B extends Model {
      static id = "b";
      label = fields.char();
      a = fields.many2one({ comodel: () => A });
    }

    class AWithSideEffect extends Model {
      static id = "a";
      blip = fields.char();

      onCreate() {
        this.orm.create(B, { label: "created by " + this.blip(), a: this });
      }
    }

    const orm = new ORM();
    const a = orm.create(AWithSideEffect, { blip: "foo" });
    const bs = orm.records(B);
    expect(bs.length).toBe(1);
    expect(bs[0].label()).toBe("created by foo");
    expect(bs[0].a()).toBe(a);
  });
});

describe("onChange", () => {
  class A extends Model {
    static id = "a";
    blip = fields.char({
      onChange: (newValue, setValue) => {
        if (newValue.startsWith("s")) {
          setValue(newValue);
        }
      },
    });
  }

  test("onchange work as expected", () => {
    const orm = new ORM();

    const record = orm.create(A, { blip: "hey" });
    expect(record.blip()).toEqual("hey");
    record.blip.set("test");
    expect(record.blip()).toEqual("hey");
    record.blip.set("stest");
    expect(record.blip()).toEqual("stest");
  });
});
