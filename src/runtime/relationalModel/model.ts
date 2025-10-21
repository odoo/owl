import { MakeGetSet } from "../../common/types";
import { reactive } from "../reactivity";
import { derived } from "../signals";
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
} from "./types";

export class Model {
  static id: ModelId;
  static fields: Record<string, FieldDefinition> = Object.create(null);
  static relatedFields: Record<string, string> = Object.create(null);
  static recordsItems: Record<InstanceId, RecordItem>;

  static get<T extends typeof Model>(this: T, id: InstanceId): InstanceType<T> {
    const recordItem = this.getRecordItem(id);
    const instance = recordItem.instance as InstanceType<T> | undefined;
    if (instance) return instance;

    return new this(id) as InstanceType<T>;
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
        case "string":
        case "number":
          attachBaseField(this, fieldName);
          break;
        case "many2many":
          attachMany2ManyField(this, fieldName, def.modelId);
          break;
        case "one2many":
          attachOne2ManyField(this, fieldName, def.modelId);
          break;
        case "many2one":
          attachMany2OneField(this, fieldName, def.modelId);
          break;
      }
    }
    return this;
  }
  static getRecordItem(id: InstanceId): RecordItem {
    const modelData = this.recordsItems;
    let recordItem = modelData[id];
    if (recordItem) {
      return recordItem;
    }
    recordItem = modelData[id] = { data: {} } as RecordItem;
    const reactiveData = reactive(recordItem.data);
    recordItem.reactiveData = reactiveData;
    recordItem.instance = undefined!;
    return recordItem;
  }

  // Instance properties and methods

  id?: InstanceId;
  data!: RecordItem["data"];
  reactiveData!: RecordItem["reactiveData"];
  changes: RelationChanges = {};
  reactiveChanges: RelationChanges = reactive(this.changes);

  constructor(id?: InstanceId) {
    const C = this.constructor as typeof Model;
    const recordItem = C.getRecordItem(id!);
    this.data = recordItem.data;
    this.reactiveData = recordItem.reactiveData;
    recordItem.instance = this;

    // todo: this should not be store in data, change it when using proper
    // signals.
    this.data.id = id === 0 || id ? id : getNextId();
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
}

function attachBaseField(target: typeof Model, fieldName: string) {
  defineLazyProperty(target.prototype, fieldName, function (this: Model) {
    return [
      () => {
        return fieldName in this.reactiveChanges
          ? this.reactiveChanges[fieldName]
          : this.reactiveData[fieldName];
      },
      (value: any) => {
        this.reactiveChanges[fieldName] = value;
      },
    ] as const;
  });
}
function attachOne2ManyField(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  const fieldInfos = getFieldInfos(target, fieldName, relatedModelId);
  defineLazyProperty(target.prototype, fieldName, function (this: Model) {
    const { relatedFieldName, RelatedModel } = fieldInfos;
    const get = getRelatedList(this, fieldName, RelatedModel);
    get.add = (m2oRecord: Model) => {
      const o2MRecordIdFrom = m2oRecord.reactiveData[relatedFieldName] as number | undefined;
      const o2MRecordFrom = o2MRecordIdFrom ? target.get(o2MRecordIdFrom) : undefined;
      setMany2One(relatedFieldName, m2oRecord, fieldName, o2MRecordFrom, this);
    };
    get.delete = (m2oRecord: Model) => {
      setMany2One(relatedFieldName, m2oRecord, fieldName, this, undefined);
    };
    return [() => get] as const;
  });
}
function attachMany2ManyField(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  const fieldInfos = getFieldInfos(target, fieldName, relatedModelId);
  defineLazyProperty(target.prototype, fieldName, function (this: Model) {
    const { relatedFieldName, RelatedModel } = fieldInfos;
    const get = getRelatedList(this, fieldName, RelatedModel);
    get.add = (m2mRecord: Model) => {
      recordArrayPush(this, fieldName, m2mRecord.id!);
      recordArrayPush(m2mRecord, relatedFieldName, this.id!);
    };
    get.delete = (m2mRecord: Model) => {
      recordArrayDelete(this, fieldName, m2mRecord.id!);
      recordArrayDelete(m2mRecord, relatedFieldName, this.id!);
    };
    return [() => get] as const;
  });
}
function attachMany2OneField(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  const fieldInfos = getFieldInfos(target, fieldName, relatedModelId);

  defineLazyProperty(target.prototype, fieldName, function (this: Model) {
    const get = derived(() => {
      const { RelatedModel } = fieldInfos;
      const id =
        fieldName in this.reactiveChanges
          ? this.reactiveChanges[fieldName]
          : this.reactiveData[fieldName];
      if (id === undefined || id === null) {
        return null;
      }
      return RelatedModel.get(id);
    });
    const set = (o2mRecordTo: Model | number) => {
      const { relatedFieldName, RelatedModel } = fieldInfos;
      if (typeof o2mRecordTo === "number") {
        o2mRecordTo = RelatedModel.get(o2mRecordTo);
      }
      const o2mRecordIdFrom = this.reactiveData[fieldName] as number | undefined;
      const o2mRecordFrom = o2mRecordIdFrom ? RelatedModel.get(o2mRecordIdFrom) : undefined;
      setMany2One(fieldName, this, relatedFieldName, o2mRecordFrom, o2mRecordTo);
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
function defineLazyProperty<T, V>(object: object, property: string, makeGetSet: MakeGetSet<T, V>) {
  function makeAndRedefineProperty(this: T) {
    const tuple = makeGetSet.call(this);
    Object.defineProperty(this, property, { get: tuple[0], set: tuple[1] });
    return tuple;
  }
  Object.defineProperty(object, property, {
    get() {
      const get = makeAndRedefineProperty.call(this as T)[0];
      return get();
    },
    set(value) {
      const set = makeAndRedefineProperty.call(this as T)[1];
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
        throw new Error(
          `Related field not found for one2many field ${fieldName} in model ${Mod.id}`
        );
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
        throw new Error(
          `Related field not found for many2many field ${fieldName} in model ${Mod.id}`
        );
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
        throw new Error(
          `Related field not found for many2one field ${fieldName} in model ${Mod.id}`
        );
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
  if (o2mRecordFrom === o2mRecordTo) {
    return;
  }
  if (o2mRecordFrom) {
    recordArrayDelete(o2mRecordFrom, o2mFieldName, m2oRecord.data.id!);
  }
  if (o2mRecordTo) {
    recordArrayPush(o2mRecordTo, o2mFieldName, m2oRecord.data.id!);
  }
  m2oRecord.reactiveChanges[m2oFieldName] = o2mRecordTo ? o2mRecordTo.data.id! : null;
}
function recordArrayDelete(record: Model, fieldName: string, value: any) {
  const [deleteList, addList] = getChanges(record, fieldName);
  arrayDelete(addList, value);
  deleteList.push(value);
}
function recordArrayPush(record: Model, fieldName: string, value: any) {
  const [deleteList, addList] = getChanges(record, fieldName);
  arrayDelete(deleteList, value);
  addList.push(value);
}

function getRelatedList(
  record: Model,
  fieldName: string,
  RelatedModel: typeof Model
): ManyFn<Model> {
  return derived(() => {
    const source = record.reactiveData[fieldName];
    const changes = record.reactiveChanges[fieldName] as [InstanceId[], InstanceId[]];
    const [deleteList, addList] = changes || [[], []];
    const list = combineLists(source, deleteList, addList);
    return list.map(RelatedModel.get.bind(RelatedModel));
  }) as ManyFn<Model>;
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
