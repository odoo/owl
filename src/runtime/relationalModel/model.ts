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
} from "./types";

export class Model {
  static id: ModelId;
  static fields: Record<string, FieldDefinition> = Object.create(null);
  static relatedFields: Record<string, string> = Object.create(null);
  static recordsData: Record<InstanceId, RecordItem>;

  static get<T extends typeof Model>(this: T, id: InstanceId): InstanceType<T> {
    const recordItem = this.getRecordItem(id);
    const instance = recordItem.instance as InstanceType<T> | undefined;
    if (instance) return instance;

    const newInstance = new this(id) as InstanceType<T>;
    recordItem.instance = newInstance;
    return newInstance;
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
    this.recordsData = globalStore.getModelData(targetModelId);
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
    const modelData = this.recordsData;
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

  constructor(id?: InstanceId) {
    this.id = id;
    const C = this.constructor as typeof Model;
    const recordItem = C.getRecordItem(id!);
    this.data = recordItem.data;
    this.reactiveData = recordItem.reactiveData;
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
  //define getter and setter
  Object.defineProperty(target.prototype, fieldName, {
    get() {
      return this.reactiveData[fieldName];
    },
    set(value) {
      this.reactiveData[fieldName] = value;
    },
  });
}
function attachOne2ManyField(target: typeof Model, fieldName: string, relatedModelId: ModelId) {
  const fieldInfos = getFieldInfos(target, fieldName, relatedModelId);
  defineLazyProperty(target.prototype, fieldName, function (this: Model) {
    const { relatedFieldName, RelatedModel } = fieldInfos;
    const get = derived(() => {
      const list = this.reactiveData[fieldName];
      return list.map((id: InstanceId) => RelatedModel.get(id));
    }) as ManyFn<Model>;
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
    const get = derived(() => {
      const list = this.reactiveData[fieldName];
      return list.map((id: InstanceId) => RelatedModel.get(id));
    }) as ManyFn<Model>;

    get.add = (m2mRecord: Model) => {
      this.reactiveData[fieldName].push(m2mRecord.id!);
      m2mRecord.reactiveData[relatedFieldName].push(this.id!);
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
      const id = this.reactiveData[fieldName];
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

function defineLazyProperty<T, V>(
  object: object,
  property: string,
  makeGetterAndSetter: (
    this: T
  ) => readonly [() => V | null] | readonly [() => V | null, (this: T, value: V) => void]
) {
  function makeAndRedefine(this: T) {
    const tuple = makeGetterAndSetter.call(this);
    Object.defineProperty(this, property, { get: tuple[0], set: tuple[1] });
    return tuple;
  }
  Object.defineProperty(object, property, {
    get() {
      const get = makeAndRedefine.call(this as T)[0];
      return get();
    },
    set(value) {
      const set = makeAndRedefine.call(this as T)[1];
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
    recordArrayDelete(o2mRecordFrom, o2mFieldName, m2oRecord.id!);
  }
  if (o2mRecordTo) {
    o2mRecordTo.reactiveData[o2mFieldName].push(m2oRecord.id!);
  }
  m2oRecord.reactiveData[m2oFieldName] = o2mRecordTo ? o2mRecordTo.id! : null;
}
function recordArrayDelete(record: Model, fieldName: string, value: any) {
  const index = record.data[fieldName].indexOf(value);
  if (index !== -1) {
    record.reactiveData[fieldName].splice(index, 1);
  }
}
