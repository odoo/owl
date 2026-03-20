import { useContext, computed, signal } from "@odoo/owl";
export class Model {
  id;
  orm;
  #dp;
  constructor(id, dp, orm) {
    this.id = id;
    this.orm = orm;
    this.#dp = dp;
  }
  setup() {}
  onCreate() {}
  toJSON() {
    const obj = { id: this.id };
    const fields = this.#dp.table.fields;
    for (let f of fields) {
      obj[f.name] = f.getRawValue(this.#dp);
    }
    return obj;
  }
}
let _signals = [];
let _index = 0;
let _dp;
let _table;
class Field {
  name = "";
  config;
  index = _index;
  table = _table;
  constructor(config) {
    this.config = config;
  }
  setValue(dp, value) {
    if (this.config.onChange) {
      const fn = dp.data[this.name].__onchange;
      fn.call(dp.record, value, (v) => this._setValue(dp, v));
    } else {
      return this._setValue(dp, value);
    }
  }
  _setValue(dp, value) {
    if (!dp.draft && this.config.readonly) {
      throw new Error("Cannot edit a readonly field");
    }
    if (this.config.selection) {
      if (dp.draft) {
        if (value !== undefined && !this.config.selection.includes(value)) {
          throw new Error(`Invalid field value: ${value}`);
        }
      } else {
        if (!this.config.selection.includes(value)) {
          throw new Error(`Invalid field value: ${value}`);
        }
      }
    }
    dp.changes()[this.index] = value;
    this.table.dirtyRecords().add(dp.record.id);
    signal.invalidate(dp.changes);
  }
  getValue(dp) {
    const index = this.index;
    const _change = dp.changes()[index];
    if (_change !== undefined) {
      return _change;
    }
    const _data = dp.rawData();
    let val = _data[index];
    if (typeof _data[index] === "function") {
      val = _data[index]();
    }
    if (val !== undefined) {
      return val;
    }
    const def = this.config.defaultValue;
    return typeof def === "function" ? def() : def;
  }
  getRawValue(dp) {
    return this.getValue(dp);
  }
}
class Many2OneField extends Field {
  getValue(dp) {
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
  getRawValue(dp) {
    return this.getValue(dp)?.id || null;
  }
}
class One2ManyField extends Field {
  getValue(dp) {
    let value = super.getValue(dp);
    if (!value.length) {
      return [];
    }
    const M = this.config.comodel();
    const targetTable = this.table.orm._getTable(M);
    const activeIds = new Set(targetTable.activeRecords().map((r) => r.id));
    return value
      .filter((v) => activeIds.has(v.id || v))
      .map((v) => targetTable.getDatapointById(v.id || v).record);
  }
  getRawValue(dp) {
    return this.getValue(dp).map((r) => r.id);
  }
}
function createField(FieldClass, config) {
  const dp = _dp;
  const table = _table;
  if (!table.isReady) {
    table.fields.push(new FieldClass(config));
  }
  const field = table.fields[_index++];
  const fieldValue = computed(() => field.getValue(dp), {
    set: field.setValue.bind(field, dp),
  });
  _signals.push(fieldValue);
  return fieldValue;
}
function makeField(FieldClass, defaultValue) {
  return (options = {}) => createField(FieldClass, { defaultValue, ...options });
}
function many2One(options) {
  return createField(Many2OneField, { defaultValue: null, ...options });
}
function one2many(options) {
  return createField(One2ManyField, { defaultValue: [], ...options });
}
export const fields = {
  char: makeField(Field, ""),
  number: makeField(Field, 0),
  bool: makeField(Field, false),
  json: makeField(Field, null),
  many2one: many2One,
  one2many: one2many,
};
class DataPoint {
  record;
  table;
  draft;
  rawData;
  changes;
  data = {};
  constructor(orm, table, id, initialState, draft, ctx) {
    this.table = table;
    this.draft = draft;
    const _rawData = [];
    const _changes = [];
    _signals = [];
    this.rawData = signal.Array(_rawData);
    this.changes = signal.Array(_changes);
    _dp = this;
    _table = table;
    _index = 0;
    let record;
    if (ctx) {
      ctx.run(() => {
        record = new table.Model(id, this, orm);
      });
    } else {
      record = new table.Model(id, this, orm);
    }
    if (!table.isReady) {
      for (let i = 0; i < _signals.length; i++) {
        const s = _signals[i];
        for (let k in record) {
          if (record[k] === s) {
            table.indexToField.push(k);
            table.fieldToIndex[k] = i;
            table.fields[i].name = k;
          }
        }
      }
      table.isReady = true;
    }
    for (let f in initialState) {
      if (f === "id") continue;
      const idx = table.fieldToIndex[f];
      if (idx === undefined) {
        throw new Error(`unknown initial value for model ${table.Model.constructor.name}: ${f}`);
      }
      _rawData[table.fieldToIndex[f]] = initialState[f];
    }
    for (let f of table.fields) {
      if (_rawData[f.index] === undefined && typeof f.config.defaultValue === "function") {
        _rawData[f.index] = f.config.defaultValue();
      }
    }
    for (let f of table.fields) {
      const n = f.name;
      const rawValue = _rawData[f.index];
      if (!draft && f.config.required && !rawValue) {
        throw new Error(`Missing required field: ${n}`);
      }
      if (f.config.selection) {
        if (draft) {
          if (rawValue !== undefined && !f.config.selection.includes(rawValue)) {
            throw new Error(`Invalid field value: ${rawValue}`);
          }
        } else {
          const effectiveValue = rawValue !== undefined ? rawValue : f.config.defaultValue;
          if (!f.config.selection.includes(effectiveValue)) {
            throw new Error(`Invalid field value: ${effectiveValue}`);
          }
        }
      }
      const s = _signals[f.index];
      if (f.config.onChange) {
        s.__onchange = f.config.onChange;
      }
      this.data[n] = s;
    }
    this.record = record;
    table.datapoints[id] = this;
    record.setup();
  }
}
class Table {
  parent = null;
  orm;
  Model;
  isReady = false;
  indexToField = [];
  fieldToIndex = {};
  datapoints = {};
  fields = [];
  baseRecords = signal.Array([]);
  recordChanges = signal.Array([]);
  dirtyRecords = signal.Set(new Set());
  constructor(orm, M) {
    this.orm = orm;
    this.Model = M;
  }
  activeDatapoints = computed(() => {
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
  activeRecords = computed(() => this.activeDatapoints().map((dp) => dp.record));
  getDatapointById(id) {
    const dp = this.datapoints[id];
    if (dp) {
      return dp;
    }
    if (this.orm._parent) {
      const pTable = this.orm._parent._getTable(this.Model);
      const parentDp = pTable.getDatapointById(id);
      const dp = new DataPoint(this.orm, this, id, parentDp.data, true, this.orm._ctx);
      return dp;
    }
    throw new Error("nope, cannot find this dp");
  }
  pendingChanges() {
    const additions = new Set();
    const deletions = new Set();
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
    const updates = [];
    for (let id of this.dirtyRecords()) {
      if (!additions.has(id) && !deletions.has(id)) {
        const diff = { id };
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
      const result = {};
      if (additions.size) {
        result.additions = [...additions].map((id) => this.datapoints[id].record.toJSON());
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
export class ORM {
  static uuid() {
    const str = Date.now().toString(36) + "-xxxx-xxxx";
    return str.replace(/[x]/g, () => ((Math.random() * 16) | 0).toString(16));
  }
  static fromJSON(obj, models) {
    const orm = new ORM();
    orm.loadJSON(obj, models);
    return orm;
  }
  _parent;
  _ctx;
  #applyingChanges = false;
  constructor(parent) {
    this._parent = parent || null;
    if (parent) {
      this._ctx = parent._ctx;
      const pdata = parent.#db();
      for (let mId in pdata) {
        const ptable = pdata[mId];
        const table = this._getTable(ptable.Model);
        table.baseRecords = computed(() => {
          return ptable.activeDatapoints().map((dp) => dp.record.id);
        });
      }
    } else {
      try {
        this._ctx = useContext();
      } catch {
        this._ctx = null;
      }
    }
  }
  toJSON() {
    const store = {};
    const data = this.#db();
    for (let m in data) {
      const records = data[m].activeRecords().map((r) => r.toJSON());
      if (records.length) {
        store[m] = records;
      }
    }
    return store;
  }
  #db = signal.Object({});
  _getTable(M) {
    const id = M.id;
    const data = this.#db();
    if (!(id in data)) {
      const table = new Table(this, M);
      data[id] = table;
    }
    return data[id];
  }
  loadJSON(json, models) {
    for (let id in json) {
      const M = models.find((m) => m.id === id);
      if (!M) {
        throw new Error("cannot find a model");
      }
      const table = this._getTable(M);
      for (let record of json[id]) {
        new DataPoint(this, table, record.id, record, !!this._parent, this._ctx);
        table.baseRecords().push(record.id);
      }
    }
  }
  create(M, initialState = {}) {
    const table = this._getTable(M);
    const id = initialState.id || ORM.uuid();
    const dp = new DataPoint(this, table, id, initialState, !!this._parent, this._ctx);
    table.recordChanges().push({ type: "add", id });
    this.#linkRelations(dp);
    if (!this._parent && !this.#applyingChanges) {
      dp.record.onCreate();
    }
    return dp.record;
  }
  #linkRelations(dp) {
    for (let field of dp.table.fields) {
      if (field instanceof Many2OneField) {
        const value = field.getValue(dp);
        if (value) {
          const coTable = this._getTable(value.constructor);
          const cofields = coTable.fields;
          for (let cf of cofields) {
            if (cf instanceof One2ManyField) {
              const cfg = cf.config;
              if (cfg.comodel() === dp.table.Model && cfg.inverse === field.name) {
                const coIds = value[cf.name]().map((r) => r.id);
                if (!coIds.includes(dp.record.id)) {
                  coIds.push(dp.record.id);
                  value[cf.name].set(coIds);
                  const codp = coTable.getDatapointById(value.id);
                  coTable.dirtyRecords().add(codp.record.id);
                }
              }
            }
          }
        }
      }
    }
  }
  pendingChanges = computed(() => {
    const result = {};
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
  applyChanges(changes, models = []) {
    this.#applyingChanges = true;
    const data = this.#db();
    for (let modelId in changes) {
      const modelChanges = changes[modelId];
      let table = data[modelId];
      if (!table) {
        const M = models.find((m) => m.id === modelId);
        if (!M) {
          throw new Error("cannot find a model");
        }
        table = this._getTable(M);
      }
      for (let r of modelChanges.additions || []) {
        this.create(table.Model, r);
      }
      for (let id of modelChanges.deletions || []) {
        const dp = table.datapoints[id];
        this.delete(dp.record);
      }
      for (let update of modelChanges.updates || []) {
        const id = update.id;
        const dp = table.datapoints[id];
        const changes = dp.changes();
        for (let k in update) {
          if (k !== "id") {
            changes[table.fieldToIndex[k]] = update[k];
          }
        }
        signal.invalidate(dp.changes);
        table.dirtyRecords().add(id);
      }
    }
    this.#applyingChanges = false;
  }
  draft() {
    return new ORM(this);
  }
  commit() {
    const data = this.#db();
    if (this._parent) {
      const changes = this.pendingChanges();
      const models = Object.values(data).map((s) => s.Model);
      this._parent.applyChanges(changes, models);
      for (let modelId in changes) {
        const parentTable = this._parent._getTable(data[modelId].Model);
        for (let r of changes[modelId].additions || []) {
          parentTable.datapoints[r.id].record.onCreate();
        }
      }
    }
    for (let modelId in data) {
      const table = data[modelId];
      const datapoints = table.activeDatapoints();
      const updates = table.dirtyRecords();
      if (!this._parent) {
        table.baseRecords.set(datapoints.map((r) => r.record.id));
      }
      table.dirtyRecords.set(new Set());
      table.recordChanges.set([]);
      for (let id of updates) {
        const dp = table.datapoints[id];
        if (!this._parent) {
          const _data = dp.data;
          const _nextRawData = dp.rawData();
          for (let f in _data) {
            _nextRawData[table.fieldToIndex[f]] = _data[f]();
          }
        }
        dp.changes().length = 0;
      }
    }
  }
  discard() {
    const data = this.#db();
    for (let modelId in data) {
      const table = data[modelId];
      table.recordChanges.set([]);
      table.dirtyRecords.set(new Set());
    }
  }
  records(M) {
    const table = this._getTable(M);
    return table.activeRecords();
  }
  records$(M) {
    const table = this._getTable(M);
    return table.activeRecords;
  }
  getById(M, id) {
    const table = this._getTable(M);
    const dp = table.datapoints[id];
    return dp ? dp.record : null;
  }
  delete(record) {
    const table = this._getTable(record.constructor);
    this.#unlinkRelations(table.datapoints[record.id]);
    table.recordChanges().push({ type: "delete", id: record.id });
  }
  #unlinkRelations(dp) {
    for (let field of dp.table.fields) {
      if (field instanceof Many2OneField) {
        const value = field.getValue(dp);
        if (value) {
          const coTable = this._getTable(value.constructor);
          for (let cf of coTable.fields) {
            if (cf instanceof One2ManyField) {
              const cfg = cf.config;
              if (cfg.comodel() === dp.table.Model && cfg.inverse === field.name) {
                const coIds = value[cf.name]().map((r) => r.id);
                const idx = coIds.indexOf(dp.record.id);
                if (idx !== -1) {
                  coIds.splice(idx, 1);
                  value[cf.name].set(coIds);
                  const codp = coTable.getDatapointById(value.id);
                  coTable.dirtyRecords().add(codp.record.id);
                }
              }
            }
          }
        }
      }
    }
  }
}
