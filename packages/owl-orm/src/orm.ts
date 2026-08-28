import { getScope, Scope, ReactiveValue, computed, signal, Signal } from "@odoo/owl";

//-----------------------------------------------------------------------------
// Model
//-----------------------------------------------------------------------------

type ModelClass = typeof Model & { id: string };

export class Model {
  id: string;
  orm: ORM;
  #dp: DataPoint;

  constructor(id: string, dp: DataPoint, orm: ORM) {
    this.id = id;
    this.orm = orm;
    this.#dp = dp;
  }

  setup() {}

  onCreate() {}

  delete() {
    this.orm.delete(this);
  }

  isDirty(): boolean {
    return this.#dp.table.dirtyRecords().has(this.id);
  }

  toJSON() {
    const obj: any = { id: this.id };
    const fields = this.#dp.table.fields;
    for (let f of fields) {
      obj[f.name] = f.getRawValue(this.#dp);
    }
    return obj;
  }
}

//-----------------------------------------------------------------------------
// Fields
//-----------------------------------------------------------------------------

let _signals: any[] = [];

let _index: number = 0;
let _dp: DataPoint;
let _table: Table;

interface FieldConfig<T> {
  defaultValue?: T | (() => T);
  selection?: T[];
  name?: string;
  required?: boolean;
  readonly?: boolean;
  onChange?: (newValue: T, setValue: (v: T) => void) => void;
}
type FieldOption<T> = Partial<FieldConfig<T>>;

class Field<T> {
  name: string = "";
  config: FieldConfig<T>;
  index: number = _index;
  table: Table = _table;

  constructor(config: FieldConfig<T>) {
    this.config = config;
  }

  setValue(dp: DataPoint, value: T) {
    if (this.config.onChange) {
      const fn = (dp.data[this.name] as any).__onchange;
      fn.call(dp.record, value, (v: any) => this._setValue(dp, v));
    } else {
      return this._setValue(dp, value);
    }
  }
  _setValue(dp: DataPoint, value: T) {
    if (!dp.draft && this.config.readonly) {
      throw new Error(`Cannot edit readonly field "${this.name}" on model "${this.table.Model.id}"`);
    }
    if (this.config.selection) {
      if (dp.draft) {
        if (value !== undefined && !this.config.selection.includes(value)) {
          throw new Error(`Invalid value "${value}" for field "${this.name}" on model "${this.table.Model.id}" (expected one of: ${this.config.selection!.join(", ")})`);
        }
      } else {
        if (!this.config.selection.includes(value)) {
          throw new Error(`Invalid value "${value}" for field "${this.name}" on model "${this.table.Model.id}" (expected one of: ${this.config.selection!.join(", ")})`);
        }
      }
    }

    dp.changes()[this.index] = value as any;
    this.table.dirtyRecords().add(dp.record.id);
    signal.trigger(dp.changes);
  }

  getValue(dp: DataPoint): T {
    const index = this.index;
    const _change = dp.changes()[index];
    if (_change !== undefined) {
      return _change as any;
    }
    const _data = dp.rawData();
    let val = _data[index];
    if (typeof _data[index] === "function") {
      val = (_data as any)[index]();
    }
    if (val !== undefined) {
      return val as any;
    }
    const def = this.config.defaultValue as any;
    return typeof def === "function" ? def() : def;
  }

  getRawValue(dp: DataPoint): any {
    return this.getValue(dp);
  }
}

interface M2OConfig extends FieldConfig<any> {
  comodel: () => ModelClass;
}

class Many2OneField extends Field<any> {
  declare config: M2OConfig;

  getValue(dp: DataPoint) {
    let value = super.getValue(dp);
    if (value === null) {
      return value;
    }
    if (typeof value !== "string") {
      value = value.id;
    }
    const M = this.config.comodel();
    return this.table.orm._getTable(M).getDatapointById(value).record;
  }

  getRawValue(dp: DataPoint) {
    return this.getValue(dp)?.id || null;
  }
}

interface O2MConfig extends M2OConfig {
  inverse?: string;
}

class One2ManyField extends Field<any> {
  declare config: O2MConfig;

  getValue(dp: DataPoint) {
    let value = super.getValue(dp);
    if (!value.length) {
      return [];
    }
    const M = this.config.comodel();
    const targetTable = this.table.orm._getTable(M);
    const activeIds = new Set(targetTable.activeRecords().map((r) => r.id));
    return value
      .filter((v: any) => activeIds.has(v.id || v))
      .map((v: any) => targetTable.getDatapointById(v.id || v).record);
  }

  getRawValue(dp: DataPoint) {
    return this.getValue(dp).map((r: any) => r.id);
  }
}

function createField<T, F extends Field<T>>(
  FieldClass: new (config: FieldConfig<T>) => F,
  config: FieldConfig<T>,
): Signal<T> {
  const dp = _dp;
  const table = _table;

  if (!table.isReady) {
    table.fields.push(new FieldClass(config));
  }

  const field = table.fields[_index++] as F;

  const fieldValue = computed(() => field.getValue(dp), {
    set: field.setValue.bind(field, dp),
  });
  _signals.push(fieldValue);

  return fieldValue as any;
}

function makeField<T>(
  FieldClass: new (config: FieldConfig<T>) => Field<T>,
  defaultValue: T,
): UserField<T> {
  return (options: FieldOption<T> = {}) =>
    createField(FieldClass, { defaultValue, ...options });
}

type UserField<T> = (options?: FieldOption<T>) => Signal<T>;

type Many2OneFieldOption<T extends ModelClass> =
  FieldOption<InstanceType<T> | null> & {
    comodel: () => T;
  };

type One2ManyFieldOption<T extends ModelClass> = FieldOption<
  InstanceType<T>[]
> & {
  comodel: () => T;
  inverse?: string;
};

function many2One<T extends ModelClass>(
  options: Many2OneFieldOption<T>,
): Signal<InstanceType<T> | null> {
  return createField(Many2OneField, { defaultValue: null, ...options }) as any;
}

function one2many<T extends ModelClass>(
  options: One2ManyFieldOption<T>,
): Signal<InstanceType<T>[]> {
  return createField(One2ManyField, { defaultValue: [], ...options }) as any;
}

export const fields = {
  char: makeField<string>(Field, ""),
  number: makeField<number>(Field, 0),
  bool: makeField<boolean>(Field, false),
  json: makeField<any>(Field, null),
  many2one: many2One,
  one2many: one2many,
};

//-----------------------------------------------------------------------------
// Datapoint
//-----------------------------------------------------------------------------

class DataPoint {
  record: Model;
  table: Table;
  draft: boolean;
  // rawValue is: value for scalar fields, id or null for m2o, list of ids for o2m
  rawData: Signal<string[]>;
  // changes: new value for scalar fields, id or null for m2o, list of ids for o2m
  changes: Signal<string[]>;

  // for scalar fields: value, for m2o: null or corresponding record, for o2m: list of records
  data: { [field: string]: Signal<any> } = {};

  constructor(
    orm: ORM,
    table: Table,
    id: string,
    initialState: object,
    draft: boolean,
    ctx: Scope | null,
  ) {
    this.table = table;
    this.draft = draft;
    const _rawData: any[] = [];
    const _changes: any[] = [];
    _signals = [];
    this.rawData = signal.Array(_rawData);
    this.changes = signal.Array(_changes);
    _dp = this;
    _table = table;
    _index = 0;

    let record;
    if (ctx) {
      ctx.run(() => {
        record = new table.Model(id, this, orm) as any;
      });
    } else {
      record = new table.Model(id, this, orm) as any;
    }

    if (!table.isReady) {
      for (let i = 0; i < _signals.length; i++) {
        const s = _signals[i];
        for (let k in record) {
          // we try to find the field in record
          if (record[k] === s) {
            table.indexToField.push(k);
            table.fieldToIndex[k] = i;
            table.fields[i].name = k;
          }
        }
      }
      table.isReady = true;
    }

    // initializing default values, if any
    for (let f in initialState) {
      if (f === "id") continue;
      const idx = table.fieldToIndex[f];
      if (idx === undefined) {
        throw new Error(
          `Unknown field "${f}" in initial state for model "${table.Model.id}"`,
        );
      }
      let value = (initialState as any)[f];
      _rawData[table.fieldToIndex[f]] = value;
    }

    // evaluate function defaults once at creation time so that repeated calls
    // to toJSON() return a stable value (e.g. defaultValue: () => Date.now())
    for (let f of table.fields) {
      if (_rawData[f.index] === undefined && typeof f.config.defaultValue === "function") {
        _rawData[f.index] = f.config.defaultValue();
      }
    }

    for (let f of table.fields) {
      const n = f.name;
      const i = f.index;
      const rawValue = _rawData[i];
      if (!draft && f.config.required && (rawValue === undefined || rawValue === null || rawValue === "")) {
        throw new Error(`Missing required field "${n}" on model "${table.Model.id}"`);
      }
      if (f.config.selection) {
        if (draft) {
          if (
            rawValue !== undefined &&
            !f.config.selection.includes(rawValue)
          ) {
            throw new Error(`Invalid value "${rawValue}" for field "${n}" on model "${table.Model.id}" (expected one of: ${f.config.selection.join(", ")})`);
          }
        } else {
          const effectiveValue =
            rawValue !== undefined ? rawValue : f.config.defaultValue;
          if (!f.config.selection.includes(effectiveValue)) {
            throw new Error(`Invalid value "${effectiveValue}" for field "${n}" on model "${table.Model.id}" (expected one of: ${f.config.selection.join(", ")})`);
          }
        }
      }
      const s = _signals[i];
      if (f.config.onChange) {
        (s as any).__onchange = f.config.onChange;
      }
      this.data[n] = s;
    }
    this.record = record;
    table.datapoints[id] = this;

    record.setup();
  }
}

//-----------------------------------------------------------------------------
// Table
//-----------------------------------------------------------------------------

interface ModelChange {
  additions?: Object[];
  deletions?: string[];
  updates?: Object[];
}

type Changeset = Record<string, ModelChange>;

interface RecordAddedRemoved {
  type: "add" | "delete";
  id: string;
}

class Table {
  parent: Table | null = null;
  orm: ORM;
  Model: ModelClass;
  isReady: boolean = false; // true when field <-> index map has been done
  indexToField: string[] = []; // field index => key name in record
  fieldToIndex: { [field: string]: number } = {};
  datapoints: { [id: string]: DataPoint } = {};
  fields: Field<any>[] = [];
  baseRecords: Signal<string[]> | ReactiveValue<string[]> = signal.Array([]);
  recordChanges: Signal<RecordAddedRemoved[]> = signal.Array([]);
  dirtyRecords: Signal<Set<string>> = signal.Set(new Set()); // updated records

  constructor(orm: ORM, M: ModelClass) {
    this.orm = orm;
    this.Model = M;
  }

  activeDatapoints: () => DataPoint[] = computed(() => {
    let base = this.baseRecords().slice();
    for (let r of this.recordChanges()) {
      if (r.type === "add") {
        if (!base.includes(r.id)) {
          base.push(r.id);
        }
      } else {
        base = base.filter((id) => id !== r.id);
      }
    }
    return base.map((id) => this.getDatapointById(id));
  });

  activeRecords: () => Model[] = computed(() =>
    this.activeDatapoints().map((dp) => dp.record),
  );

  getDatapointById(id: string): DataPoint {
    const dp = this.datapoints[id];
    if (dp) {
      return dp;
    }
    if (this.orm._parent) {
      const pTable = this.orm._parent._getTable(this.Model);
      const parentDp = pTable.getDatapointById(id);
      const dp = new DataPoint(
        this.orm,
        this,
        id,
        parentDp.data,
        true,
        this.orm._ctx,
      );
      return dp;
    }
    throw new Error(`Record "${id}" not found in model "${this.Model.id}"`);
  }

  pendingChanges(): ModelChange | null {
    const additions: Set<string> = new Set();
    const deletions: Set<string> = new Set();
    for (let change of this.recordChanges()) {
      if (change.type === "add") {
        additions.add(change.id);
        deletions.delete(change.id);
      } else {
        if (additions.has(change.id)) {
          additions.delete(change.id);
        } else {
          deletions.add(change.id);
        }
      }
    }
    const updates: Object[] = [];
    for (let id of this.dirtyRecords()) {
      if (!additions.has(id) && !deletions.has(id)) {
        const diff: any = { id };
        const dp = this.datapoints[id];
        const changes = dp.changes();
        for (let i = 0; i < changes.length; i++) {
          let change = changes[i];
          if (change !== undefined) {
            diff[this.indexToField[i]] = change;
          }
        }
        updates.push(diff);
      }
    }
    if (additions.size || updates.length || deletions.size) {
      const result: ModelChange = {};
      if (additions.size) {
        result.additions = [...additions].map((id) =>
          this.datapoints[id].record.toJSON(),
        );
      }
      if (deletions.size) {
        result.deletions = [...deletions];
      }
      if (updates.length) {
        result.updates = updates;
      }
      return result;
    }
    return null;
  }
}

//-----------------------------------------------------------------------------
// ORM
//-----------------------------------------------------------------------------

export class ORM {
  static uuid(): string {
    const str = Date.now().toString(36) + "-xxxx-xxxx";
    return str.replace(/[x]/g, () => ((Math.random() * 16) | 0).toString(16));
  }
  static fromJSON(obj: any, models: ModelClass[]): ORM {
    const orm = new ORM();
    orm.loadJSON(obj, models);
    return orm;
  }

  _parent: ORM | null;
  _ctx: Scope | null;
  #applyingChanges: boolean = false;

  constructor(parent?: ORM) {
    this._parent = parent || null;
    if (parent) {
      this._ctx = parent._ctx;
      const pdata = parent.#db();
      for (let mId in pdata) {
        const ptable = pdata[mId];
        const table = this._getTable(ptable.Model as any);
        table.baseRecords = computed(() => {
          return ptable.activeDatapoints().map((dp) => dp.record.id);
        });
      }
    } else {
      this._ctx = getScope();
    }
  }

  toJSON(): Object {
    const store: any = {};
    const data = this.#db();
    for (let m in data) {
      const records = data[m].activeRecords().map((r: any) => r.toJSON());
      if (records.length) {
        store[m] = records;
      }
    }
    return store;
  }

  #db: Signal<{ [modelId: string]: Table }> = signal.Object({});

  _getTable(M: ModelClass): Table {
    const id = M.id;
    const data = this.#db();
    if (!(id in data)) {
      const table = new Table(this, M);
      data[id] = table;
    }
    return data[id];
  }

  loadJSON(json: Object, models: ModelClass[]) {
    for (let id in json) {
      const M = models.find((m) => m.id === id);
      if (!M) {
        throw new Error(`Unknown model "${id}" in JSON (registered models: ${models.map((m) => m.id).join(", ")})`);
      }
      const table = this._getTable(M);
      for (let record of (json as any)[id]) {
        new DataPoint(
          this,
          table,
          record.id,
          record,
          !!this._parent,
          this._ctx,
        );
        table.baseRecords().push(record.id);
      }
    }
  }

  create<T extends ModelClass>(M: T, initialState: any = {}): InstanceType<T> {
    const table = this._getTable(M);
    const id = initialState.id || ORM.uuid();
    const dp = new DataPoint(
      this,
      table,
      id,
      initialState,
      !!this._parent,
      this._ctx,
    );
    table.recordChanges().push({ type: "add", id });
    this.#linkRelations(dp);
    if (!this._parent && !this.#applyingChanges) {
      dp.record.onCreate();
    }
    return dp.record as any;
  }

  #linkRelations(dp: DataPoint) {
    for (let field of dp.table.fields) {
      if (field instanceof Many2OneField) {
        const value = field.getValue(dp) as Model | null;
        if (value) {
          const coTable = this._getTable((value as any).constructor);
          for (let cf of coTable.fields) {
            if (cf instanceof One2ManyField) {
              const cfg = cf.config;
              if (
                cfg.comodel() === dp.table.Model &&
                cfg.inverse === field.name
              ) {
                const codp = coTable.getDatapointById(value.id);
                const raw: any[] =
                  Field.prototype.getValue.call(cf, codp) || [];
                const ids = raw.map((v: any) =>
                  typeof v === "string" ? v : v.id,
                );
                if (!ids.includes(dp.record.id)) {
                  cf._setValue(codp, [...ids, dp.record.id]);
                }
              }
            }
          }
        }
      }
    }
  }

  pendingChanges: () => Changeset = computed(() => {
    const result: Changeset = {};
    const data = this.#db();
    for (let id in data) {
      const table = data[id];
      const changes = table.pendingChanges();
      if (changes) {
        result[id] = changes;
      }
    }
    return result;
  });

  applyChanges(changes: Changeset, models: ModelClass[] = []) {
    this.#applyingChanges = true;
    const data = this.#db();
    for (let modelId in changes) {
      const modelChanges = changes[modelId];
      let table = data[modelId];
      if (!table) {
        const M = models.find((m) => m.id === modelId);
        if (!M) {
          throw new Error(`Unknown model "${modelId}" in changeset (registered models: ${models.map((m) => m.id).join(", ")})`);
        }
        table = this._getTable(M);
      }
      for (let r of modelChanges.additions || []) {
        this.create(table.Model as any, r);
      }
      for (let id of modelChanges.deletions || []) {
        const dp = table.datapoints[id];
        this.delete(dp.record);
      }
      for (let update of modelChanges.updates || []) {
        const id = (update as any).id;
        const dp = table.datapoints[id];
        const changes: any = dp.changes();
        for (let k in update) {
          if (k !== "id") {
            changes[table.fieldToIndex[k]] = (update as any)[k];
          }
        }
        signal.trigger(dp.changes);
        table.dirtyRecords().add(id);
      }
    }
    this.#applyingChanges = false;
  }

  draft(): ORM {
    return new ORM(this);
  }

  /**
   * Push draft changes to the parent ORM. Only valid on a draft ORM
   * created via `orm.draft()`. Additions, deletions, and field updates
   * are applied to the parent atomically; `onCreate()` fires on newly
   * added records in the parent after they land. Throws if this ORM
   * has no parent.
   */
  commit() {
    if (!this._parent) {
      throw new Error("commit() is for draft ORMs — use flush() on a root ORM");
    }
    const data = this.#db();
    const changes = this.pendingChanges();
    const models = Object.values(data).map((s) => s.Model);
    this._parent.applyChanges(changes, models);
    for (let modelId in changes) {
      const parentTable = this._parent._getTable(data[modelId].Model as any);
      for (let r of changes[modelId].additions || []) {
        parentTable.datapoints[(r as any).id].record.onCreate();
      }
    }
    this.#clearPending();
  }

  /**
   * Acknowledge pending changes on a root ORM: bake current field
   * values into `rawData`, consolidate `baseRecords`, and reset all
   * dirty tracking so that `pendingChanges()` returns `{}`. This does
   * NOT move data anywhere — it just resets the "what changed since
   * last flush" baseline. Throws if called on a draft ORM.
   */
  flush() {
    if (this._parent) {
      throw new Error("flush() is for root ORMs — use commit() on a draft ORM");
    }
    const data = this.#db();
    for (let modelId in data) {
      const table = data[modelId];
      const datapoints = table.activeDatapoints();
      const updates = table.dirtyRecords();
      (table.baseRecords as any).set(datapoints.map((r) => r.record.id));
      for (let id of updates) {
        const dp = table.datapoints[id];
        const _nextRawData: any[] = dp.rawData();
        for (let f of table.fields) {
          _nextRawData[f.index] = f.getRawValue(dp);
        }
      }
    }
    this.#clearPending();
  }

  #clearPending() {
    const data = this.#db();
    for (let modelId in data) {
      const table = data[modelId];
      const dirty = table.dirtyRecords();
      table.dirtyRecords.set(new Set());
      table.recordChanges.set([]);
      for (let id of dirty) {
        const dp = table.datapoints[id];
        dp.changes().length = 0;
        signal.trigger(dp.changes);
      }
    }
  }

  discard() {
    const data = this.#db();
    for (let modelId in data) {
      const table = data[modelId];
      table.recordChanges.set([]);
      for (let id of table.dirtyRecords()) {
        const dp = table.datapoints[id];
        dp.changes().length = 0;
        signal.trigger(dp.changes);
      }
      table.dirtyRecords.set(new Set());
    }
  }

  records<T extends ModelClass>(M: T): InstanceType<T>[] {
    const table = this._getTable(M);
    return table.activeRecords() as any;
  }
  records$<T extends ModelClass>(M: T): ReactiveValue<InstanceType<T>[]> {
    const table = this._getTable(M);
    return table.activeRecords as any;
  }

  getById<T extends ModelClass>(M: T, id: string): InstanceType<T> | null {
    const table = this._getTable(M);
    const dp = table.datapoints[id];
    return dp ? (dp.record as any) : null;
  }

  delete(record: Model) {
    const table = this._getTable((record as any).constructor);
    this.#unlinkRelations(table.datapoints[record.id]);
    table.recordChanges().push({ type: "delete", id: record.id });
  }

  #unlinkRelations(dp: DataPoint) {
    for (let field of dp.table.fields) {
      if (field instanceof Many2OneField) {
        const value = field.getValue(dp) as Model | null;
        if (value) {
          const coTable = this._getTable((value as any).constructor);
          for (let cf of coTable.fields) {
            if (cf instanceof One2ManyField) {
              const cfg = cf.config;
              if (
                cfg.comodel() === dp.table.Model &&
                cfg.inverse === field.name
              ) {
                const codp = coTable.getDatapointById(value.id);
                const raw: any[] =
                  Field.prototype.getValue.call(cf, codp) || [];
                const ids = raw.map((v: any) =>
                  typeof v === "string" ? v : v.id,
                );
                if (ids.includes(dp.record.id)) {
                  cf._setValue(
                    codp,
                    ids.filter((id: string) => id !== dp.record.id),
                  );
                }
              }
            }
          }
        }
      }
    }
  }
}
