import { MakeGetSet } from "../../common/types";
import { reactive } from "../reactivity";
import { derived } from "../signals.js";
import { Models } from "./modelRegistry";
import { globalStore } from "./store";
import {
  ModelId,
  InstanceId,
  FieldDefinition,
  RecordItem,
  ManyFn,
  X2ManyFieldDefinition,
  RelationChanges,
  DraftContext,
} from "./types";

export class Model {
  static id: ModelId;
  static fields: Record<string, FieldDefinition> = Object.create(null);
  static relatedFields: Record<string, string> = Object.create(null);
  static recordsItems: Record<InstanceId, RecordItem>;

  static create<T extends typeof Model>(this: T, data: Partial<InstanceType<T>>): InstanceType<T> {
    const m = new this(undefined, { createData: data });
    return m as InstanceType<T>;
  }
  static get<T extends typeof Model>(
    this: T,
    id: InstanceId,
    context: DraftContext | null = CurrentDraftContext
  ): InstanceType<T> {
    return context ? this.getContextInstance(id, context) : this.getGlobalInstance(id);
  }
  static getAll<T extends typeof Model>(this: T): InstanceType<T>[] {
    if ((this as any)._getAll) return (this as any)._getAll();
    const modelId = this.id;
    const ids = globalStore.searches[modelId]?.["[]"]!.ids;
    (this as any)._getAll = derived(() => {
      return ids.map((id) => this.get(id)) as InstanceType<T>[];
    });
    return (this as any)._getAll();
  }

  static register<T extends typeof Model>(this: T) {
    const targetModelId = this.id;
    this.recordsItems = globalStore.getModelData(targetModelId);
    Models[targetModelId] = this;
    for (const [fieldName, def] of Object.entries(this.fields)) {
      def.fieldName = fieldName;
      switch (def.type) {
        case "many2many":
          attachMany2ManyField(this, fieldName, def.modelId);
          break;
        case "one2many":
          attachOne2ManyField(this, fieldName, def.modelId);
          break;
        case "many2one":
          attachMany2OneField(this, fieldName, def.modelId);
          break;
        default:
          attachBaseField(this, fieldName);
          break;
      }
    }
    return this;
  }
  static getRecordItem(id: InstanceId, defaultData?: Record<string, any>): RecordItem {
    const modelData = this.recordsItems;
    let recordItem = modelData[id];
    if (recordItem) {
      return recordItem;
    }
    const data = defaultData || {};
    recordItem = modelData[id] = { data } as RecordItem;
    const reactiveData = reactive(data);
    recordItem.reactiveData = reactiveData;
    recordItem.instance = undefined!;
    return recordItem;
  }
  static getGlobalInstance<T extends typeof Model>(this: T, id: InstanceId): InstanceType<T> {
    const recordItem = this.getRecordItem(id);
    const instance = recordItem.instance as InstanceType<T> | undefined;
    return instance || (new this(id) as InstanceType<T>);
  }
  static getContextInstance<T extends typeof Model>(
    this: T,
    id: InstanceId,
    draftContext: DraftContext
  ): InstanceType<T> {
    const modelStore = draftContext!.store;
    let recordModelStore = modelStore[this.id];
    if (!recordModelStore) recordModelStore = modelStore[this.id] = {};
    const instance = recordModelStore[id] as InstanceType<T>;
    return instance || new this(this.getGlobalInstance(id), { draftContext: CurrentDraftContext });
  }

  // Instance properties and methods

  id?: InstanceId;
  data!: RecordItem["data"];
  reactiveData!: RecordItem["reactiveData"];
  changes: RelationChanges = {};
  reactiveChanges: RelationChanges = reactive(this.changes);
  parentRecord?: Model;
  childRecords: Model[] = [];
  draftContext: DraftContext | null = null;

  constructor(
    idOrParentRecord?: InstanceId | Model,
    params: {
      createData?: Record<string, any>;
      draftContext?: DraftContext | null;
    } = {
      draftContext: CurrentDraftContext,
    }
  ) {
    if (typeof idOrParentRecord === "object") {
      this.parentRecord = idOrParentRecord;
      this.draftContext = params.draftContext || { store: {} };
      idOrParentRecord = idOrParentRecord.id;
      this._setDraftItem(idOrParentRecord!);
    }
    const id = idOrParentRecord || getNextId();
    const C = this.constructor as typeof Model;
    const recordItem = C.getRecordItem(params.createData?.id || id!);
    this.data = recordItem.data;
    this.data.id ??= id;
    this.reactiveData = recordItem.reactiveData;
    recordItem.instance = this;

    // todo: this should not be store in data, change it when using proper
    // signals.
    // this.data.id = id === 0 || id ? id : getNextId();
    defineLazyProperty(this, "id", () => {
      const get = derived(() => this.reactiveData.id as InstanceId | undefined);
      return [get] as const;
    });
  }

  delete() {
    // get all many2one fields in the static fields
    const constructor = this.constructor as typeof Model;
    for (const [fieldName, def] of Object.entries(constructor.fields)) {
      switch (def.type) {
        case "many2one":
          (this as any)[fieldName] = null;
          break;
        case "many2many":
        case "one2many":
          const manyField = (this as any)[fieldName] as ManyFn<Model>;
          const records = manyField();
          for (var i = records.length - 1; i >= 0; i--) {
            manyField.delete(records[i]);
          }
          break;
      }
    }
  }
  isNew() {
    return typeof this.reactiveData.id === "string";
  }
  hasChanges() {
    return Object.keys(this.reactiveChanges).length > 0;
  }

  // Draft methods

  makeDraft() {
    const Mod = this.constructor as typeof Model;
    const newInstance = new Mod(this);
    this.childRecords.push(newInstance);
    return newInstance as this;
  }
  saveDraft() {
    if (!this.parentRecord) {
      throw new Error("Cannot save draft without a parent record");
    }
    const parent = this.parentRecord;
    const parentReactiveChanges = parent.reactiveChanges;
    const thisChanges = this.reactiveChanges;
    for (const [key, value] of Object.entries(thisChanges)) {
      if (!Array.isArray(value)) {
        parentReactiveChanges[key] = value;
      } else {
        const [deleteList, addList] = value;
        let parentChanges = parentReactiveChanges[key] as [InstanceId[], InstanceId[]] | undefined;
        if (!parentChanges) {
          parentChanges = parentReactiveChanges[key] = [[], []];
        }
        const [parentDeleteList, parentAddList] = parentChanges;
        for (const id of deleteList) {
          arrayDelete(parentAddList, id);
          parentDeleteList.push(id);
        }
        for (const id of addList) {
          arrayDelete(parentDeleteList, id);
          parentAddList.push(id);
        }
      }
      delete thisChanges[key];
    }
  }
  withContext(fn: () => void) {
    return withDraftContext(this.draftContext, fn);
  }
  _setDraftItem(id: InstanceId) {
    if (!this.draftContext) return;
    const modelStore = this.draftContext.store;
    let recordModelStore = modelStore[(this.constructor as typeof Model).id];
    if (!recordModelStore) {
      recordModelStore = modelStore[(this.constructor as typeof Model).id] = {};
    }
    recordModelStore[id] = this;
  }
}

function attachBaseField(target: typeof Model, fieldName: string) {
  // todo: use instance instead of this
  defineLazyProperty(target.prototype, fieldName, (obj: Model) => {
    return [
      () => {
        return fieldName in obj.reactiveChanges
          ? obj.reactiveChanges[fieldName]
          : getBaseFieldValue(obj, fieldName);
      },
      (value: any) => {
        obj.reactiveChanges[fieldName] = value;
      },
    ] as const;
  });
}
function attachOne2ManyField(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  const fieldInfos = getFieldInfos(target, fieldName, relatedModelId);
  defineLazyProperty(target.prototype, fieldName, (obj: Model) => {
    const { relatedFieldName, RelatedModel } = fieldInfos;
    if (!relatedFieldName) {
      const get = () => [] as Model[];
      return [() => get] as const;
    }
    const ctx = obj.draftContext;
    const get = getRelatedList(obj, fieldName, RelatedModel);
    get.add = (m2oRecord: Model) => {
      m2oRecord = ensureContext(ctx, m2oRecord);
      const o2MRecordIdFrom = m2oRecord.reactiveData[relatedFieldName] as number | undefined;
      const o2MRecordFrom = o2MRecordIdFrom ? target.get(o2MRecordIdFrom, ctx) : undefined;
      setMany2One(relatedFieldName, m2oRecord, fieldName, o2MRecordFrom, obj);
    };
    get.delete = (m2oRecord: Model) => {
      m2oRecord = ensureContext(ctx, m2oRecord);
      setMany2One(relatedFieldName, m2oRecord, fieldName, obj, undefined);
    };
    return [() => get] as const;
  });
}
function attachMany2ManyField(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  const fieldInfos = getFieldInfos(target, fieldName, relatedModelId);
  defineLazyProperty(target.prototype, fieldName, (obj: Model) => {
    const { relatedFieldName, RelatedModel } = fieldInfos;
    if (!relatedFieldName) {
      const get = () => [] as Model[];
      return [() => get] as const;
    }
    const ctx = obj.draftContext;
    const get = getRelatedList(obj, fieldName, RelatedModel);
    get.add = (m2mRecord: Model) => {
      m2mRecord = ensureContext(ctx, m2mRecord);
      recordArrayAdd(obj, fieldName, m2mRecord.id!);
      recordArrayAdd(m2mRecord, relatedFieldName, obj.id!);
    };
    get.delete = (m2mRecord: Model) => {
      m2mRecord = ensureContext(ctx, m2mRecord);
      recordArrayDelete(obj, fieldName, m2mRecord.id!);
      recordArrayDelete(m2mRecord, relatedFieldName, obj.id!);
    };
    return [() => get] as const;
  });
}
function attachMany2OneField(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  const fieldInfos = getFieldInfos(target, fieldName, relatedModelId);
  defineLazyProperty(target.prototype, fieldName, (obj: Model) => {
    const ctx = obj.draftContext;
    const get = derived(() => {
      const { RelatedModel } = fieldInfos;
      const id =
        fieldName in obj.reactiveChanges
          ? obj.reactiveChanges[fieldName]
          : obj.reactiveData[fieldName];
      if (id === undefined || id === null) {
        return null;
      }
      return RelatedModel.get(id, ctx);
    });
    const set = (o2mRecordTo: Model | number) => {
      const { relatedFieldName, RelatedModel } = fieldInfos;
      if (!relatedFieldName) throw new Error("Related field name is undefined");
      if (typeof o2mRecordTo === "number") {
        o2mRecordTo = RelatedModel.get(o2mRecordTo, ctx);
      } else {
        o2mRecordTo = o2mRecordTo && ensureContext(ctx, o2mRecordTo);
      }
      const o2mRecordIdFrom = obj.reactiveData[fieldName] as number | undefined;
      const o2mRecordFrom = o2mRecordIdFrom ? RelatedModel.get(o2mRecordIdFrom, ctx) : undefined;
      setMany2One(fieldName, obj, relatedFieldName, o2mRecordFrom, o2mRecordTo);
    };
    return [get, set] as const;
  });
}
function getFieldInfos(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  return {
    get relatedFieldName() {
      const relatedFieldName = getRelatedFieldName(target, fieldName);
      Object.defineProperty(this, "relatedFieldName", { get: () => relatedFieldName });
      return relatedFieldName;
    },
    get RelatedModel() {
      const RelatedModel = Models[relatedModelId];
      Object.defineProperty(this, "RelatedModel", { get: () => RelatedModel });
      return RelatedModel;
    },
  };
}
/**
 * Define a lazy property on an object that computes its getter and setter on first access.
 * Allowing to delay some computation until the property is actually used.
 *
 * @param object The object on which to define the property.
 * @param property The name of the property to define.
 * @param makeGetSet A function that returns a tuple containing the getter and optional setter.
 * @example
 * defineLazyProperty(MyClass.prototype, "myProperty", function() {
 *   // Some computing that will only run once, on first access.
 *   return [
 *     () => this._myProperty,
 *     (value) => { this._myProperty = value; }
 *   ];
 * });
 */
export function defineLazyProperty<T, V>(
  object: object,
  property: string,
  makeGetSet: MakeGetSet<T, V>
) {
  function makeAndRedefineProperty(obj: T) {
    const tuple = makeGetSet(obj);
    Object.defineProperty(obj, property, { get: tuple[0], set: tuple[1] });
    return tuple;
  }
  Object.defineProperty(object, property, {
    get() {
      const get = makeAndRedefineProperty(this as T)[0];
      return get();
    },
    set(value) {
      const set = makeAndRedefineProperty(this as T)[1];
      set?.call(this as T, value);
    },
    configurable: true,
  });
}

/**
 * Get the field of the related model that relates back to this model.
 *
 * @param fieldName The field name in this model.
 */
function getRelatedFieldName(Mod: typeof Model, fieldName: string) {
  // Could be already set by the related model.
  if (Mod.relatedFields[fieldName]) return Mod.relatedFields[fieldName];
  const def = Mod.fields[fieldName] as X2ManyFieldDefinition;
  const RelatedModel = Models[def.modelId];
  const modelId = Mod.id;
  switch (def.type) {
    case "one2many":
      const relatedFieldName =
        def.relatedField ||
        Object.values(RelatedModel.fields).find(
          (d) => d.type === "many2one" && d.modelId === modelId
        )?.fieldName;
      if (!relatedFieldName) {
        return;
      }
      Mod.relatedFields[fieldName] = relatedFieldName;
      RelatedModel.relatedFields[relatedFieldName] = fieldName;
      return relatedFieldName;
    case "many2many": {
      const { relationTableName } = def;
      const relatedFieldName = Object.values(RelatedModel.fields).find(
        (d) =>
          d.type === "many2many" &&
          d.modelId === modelId &&
          (!relationTableName || d.relationTableName === relationTableName)
      )?.fieldName;
      if (!relatedFieldName) {
        return;
      }
      Mod.relatedFields[fieldName] = relatedFieldName;
      RelatedModel.relatedFields[relatedFieldName] = fieldName;
      return relatedFieldName;
    }
    case "many2one": {
      for (const fieldName of Object.keys(RelatedModel.fields)) {
        getRelatedFieldName(RelatedModel, fieldName);
        // The many2one is set by the one2many field.
      }
      const relatedFieldName = Mod.relatedFields[fieldName];
      if (!relatedFieldName) {
        return;
      }
      return relatedFieldName;
    }
  }
}

function setMany2One(
  m2oFieldName: string,
  m2oRecord: Model,
  o2mFieldName: string,
  o2mRecordFrom?: Model,
  o2mRecordTo?: Model
) {
  if (o2mRecordFrom === o2mRecordTo) return;
  if (o2mRecordFrom) recordArrayDelete(o2mRecordFrom, o2mFieldName, m2oRecord.data.id!);
  if (o2mRecordTo) recordArrayAdd(o2mRecordTo, o2mFieldName, m2oRecord.data.id!);
  m2oRecord.reactiveChanges[m2oFieldName] = o2mRecordTo ? o2mRecordTo.data.id! : null;
}
function recordArrayDelete(record: Model, fieldName: string, value: any) {
  const [deleteList, addList] = getChanges(record, fieldName);
  arrayDelete(addList, value);
  deleteList.push(value);
}
function recordArrayAdd(record: Model, fieldName: string, value: any) {
  const [deleteList, addList] = getChanges(record, fieldName);
  arrayDelete(deleteList, value);
  addList.push(value);
}

function getBaseFieldValue(record: Model, fieldName: string) {
  return record.parentRecord
    ? (record.parentRecord as any)[fieldName] // get the computed field
    : record.reactiveData[fieldName];
}
function getBaseManyFieldValue(record: Model, fieldName: string) {
  return record.parentRecord
    ? (record.parentRecord as any)[fieldName].ids() // get the computed field
    : record.reactiveData[fieldName];
}
function getRelatedList(
  record: Model,
  fieldName: string,
  RelatedModel: typeof Model
): ManyFn<Model> {
  const draftContext = record.draftContext;
  const getInstance = (id: InstanceId) => RelatedModel.get(id, draftContext);
  const getIds = derived(() => {
    const source = getBaseManyFieldValue(record, fieldName) as InstanceId[];
    const changes = record.reactiveChanges[fieldName] as [InstanceId[], InstanceId[]];
    const [deleteList, addList] = changes || [[], []];
    return combineLists(source, deleteList, addList);
  });
  const getInstances = derived(() => {
    return getIds().map(getInstance);
  }) as ManyFn<Model>;
  getInstances.ids = getIds;
  return getInstances;
}
function arrayDelete(array: any[], value: any) {
  const index = array.indexOf(value);
  if (index !== -1) {
    array.splice(index, 1);
  }
}
function getChanges(record: Model, fieldName: string) {
  const allChanges = record.reactiveChanges;
  let changes = allChanges[fieldName] as [InstanceId[], InstanceId[]];
  if (!changes) {
    changes = [[], []];
    allChanges[fieldName] = changes;
  }
  return changes;
}
export function combineLists(listA: InstanceId[], deleteList: InstanceId[], addList: InstanceId[]) {
  const set = new Set<InstanceId>(listA);
  for (const id of deleteList) {
    set.delete(id);
  }
  for (const id of addList) {
    set.add(id);
  }
  return Array.from(set);
}

// Drafts helpers

let CurrentDraftContext: DraftContext | null = null;

export function ensureContext(context: DraftContext | null, record: Model) {
  if (record.draftContext === context) return record;
  if (!context) return (record.constructor as typeof Model).getGlobalInstance(record.id!);
  return (record.constructor as typeof Model).getContextInstance(record.id!, context);
}
export function withDraftContext<T>(context: DraftContext | null, fn: () => T): T {
  const previousContext = CurrentDraftContext;
  CurrentDraftContext = context;
  try {
    return fn();
  } finally {
    CurrentDraftContext = previousContext;
  }
}
export function saveDraftContext(context: DraftContext) {
  for (const modelId of Object.keys(context.store)) {
    const recordModelStore = context.store[modelId];
    for (const instance of Object.values(recordModelStore)) {
      instance.saveDraft();
    }
  }
}

// Id helpers

let lastId = 0;
function getNextId() {
  lastId += 1;
  return formatId(lastId);
}
export function formatId(number: number) {
  return `newRecord-${number}`;
}
export function resetIdCounter() {
  lastId = 0;
}
