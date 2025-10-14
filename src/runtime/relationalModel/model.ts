import { derived } from "../signals";
import { modelRegistry } from "./modelRegistry";
import { globalStore } from "./store";
import {
  ModelId,
  InstanceId,
  FieldDefinition,
  ItemStuff,
  One2Many,
  FieldDefinitionOne2Many,
} from "./types";

export class Model {
  static id: ModelId;
  static fields: Record<string, FieldDefinition> = {};
  id?: InstanceId;
  data!: ItemStuff["data"];
  reactiveData!: ItemStuff["reactiveData"];

  static get<T extends typeof Model>(this: T, id: InstanceId): InstanceType<T> {
    return globalStore.getModelInstance(this.id, id) as InstanceType<T>;
  }
  static _getAllDerived: typeof Model["getAll"];
  static getAll<T extends typeof Model>(this: T): InstanceType<T>[] {
    if (this._getAllDerived) return this._getAllDerived();
    const modelId = this.id;
    const ids = globalStore.searches[modelId]?.["[]"]!.ids;
    this._getAllDerived = derived(() => {
      return ids.map((id) => this.get(id)) as InstanceType<T>[];
    });
    return this._getAllDerived();
  }

  static register<T extends typeof Model>(this: T) {
    const targetModelId = this.id;
    modelRegistry[targetModelId] = this;
    for (const [fieldName, def] of Object.entries(this.fields)) {
      switch (def.type) {
        case "string":
        case "number":
          setBaseField(this, fieldName);
          break;
        case "one2Many":
          setOne2ManyField(this, fieldName, targetModelId, def.modelId);
          break;
        case "many2One":
          setMany2OneField(this, fieldName, targetModelId, def.modelId);
          break;
      }
    }
  }
  constructor(id?: InstanceId) {
    this.id = id;
    const C = this.constructor as typeof Model;
    const stuff = globalStore.getItemSuff(C.id, this.id!);
    this.data = stuff.data;
    this.reactiveData = stuff.reactiveData;
  }

  delete() {
    // get all many2one fields in the static fields
    const constructor = this.constructor as typeof Model;
    for (const [fieldName, def] of Object.entries(constructor.fields)) {
      if (def.type === "many2One") {
        // do something with the many2one field
        const relatedModelId = def.modelId;
        const RelatedModel = modelRegistry[relatedModelId];
        if (!RelatedModel) {
          throw new Error(`Model with id ${relatedModelId} not found in registry`);
        }
        // todo: should be configurable rather than taking the first one2many field
        const relatedFieldName = getRelatedOne2manyFieldName(
          RelatedModel,
          constructor.id,
          fieldName
        );
        const relatedId = this.reactiveData[fieldName] as InstanceId;
        const stuff = globalStore.getItemSuff(relatedModelId, relatedId);
        const arr = stuff.data[relatedFieldName] as number[];
        const reactiveArr = stuff.reactiveData[relatedFieldName] as number[];
        const indexOfId = arr.findIndex((id: InstanceId) => id === this.id);
        // splice
        if (indexOfId !== -1) {
          reactiveArr.splice(indexOfId, 1);
        }
        // set the many2one field to null
        this.reactiveData[fieldName] = null;
      }
    }
  }
}

function getRelatedOne2manyFieldName(
  RelatedModel: typeof Model,
  modelId: string,
  fieldName: string
) {
  return Object.entries(RelatedModel.fields).find(([, d]) => {
    return (
      d.type === "one2Many" &&
      d.modelId === modelId &&
      (!d.relatedField || d.relatedField === fieldName)
    );
  })?.[0]!;
}

// Base field
function setBaseField(target: typeof Model, fieldName: string) {
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

// One2Many field
function setOne2ManyField(
  target: typeof Model,
  fieldName: string,
  fromModelId: ModelId,
  toModelId: ModelId
) {
  Object.defineProperty(target.prototype, fieldName, {
    get() {
      const ToModel = modelRegistry[toModelId];
      const def = (this.constructor as typeof Model).fields[fieldName] as FieldDefinitionOne2Many;
      const relatedField = def.relatedField || fromModelId;

      const fn: One2Many<Model> = derived(() => {
        const list = globalStore.getItemSuff(fromModelId, this.id!).reactiveData[fieldName];
        return list.map((id: InstanceId) => {
          return globalStore.getModelInstance(toModelId, id);
        });
      }) as One2Many<Model>;
      for (const [key, method] of Object.entries(mutableArrayMethods)) {
        Object.defineProperty(fn, key, {
          value: (method as any).bind(this, ToModel, relatedField, fieldName),
        });
      }
      (target as any)[fieldName] = fn;
      return fn;
    },
  });
}
const mutableArrayMethods = {
  // eg. Partner, Messages, partner, messages, record
  push(this: Model, ToModel: typeof Model, relatedField: string, fieldName: string, record: Model) {
    const currentId = this.data[fieldName];
    if (currentId === this.id) return;
    setMany2One(
      record.id!,
      ToModel,
      fieldName,
      this.reactiveData,

      this.constructor as typeof Model,
      relatedField,
      record.data[relatedField],
      this.id,
      record.reactiveData
    );
  },
  shift(this: Model, ToModel: typeof Model, relatedField: string, fieldName: string) {
    if (!this.data[fieldName].length) return;
    // const firstId = (this as any).data[fieldName][0];
    // setMany2One(ToModel, firstId, fieldName, this.id, undefined, this.reactiveData);
  },
  pop(this: Model, ToModel: typeof Model, relatedField: string, fieldName: string) {
    if (!this.data[fieldName].length) return;
    // const lastId = (this as any).data[fieldName][this.data[fieldName].length - 1];
    // setMany2One(ToModel, lastId, fieldName, this.id, undefined, this.reactiveData);
  },
  unshift(
    this: Model,
    ToModel: typeof Model,
    relatedField: string,
    fieldName: string,
    record: Model
  ) {
    // const id = m.id;
    // if (this.data[fieldName].includes(id)) return;
    // const currentId = this.data[fieldName];
    // setMany2One(ToModel, id!, fieldName, currentId, this.id, this.reactiveData);
  },
  splice(
    this: Model,
    ToModel: typeof Model,
    relatedField: string,
    fieldName: string,
    start: number,
    deleteCount?: number
  ) {
    // const ids: InstanceId[] = this.data[fieldName];
    // const toDelete = ids.slice(start, start + (deleteCount ?? ids.length - start));
    // for (const id of toDelete) {
    //   setMany2One(ToModel, id, fieldName, this.id, undefined, this.reactiveData);
    // }
  },
  sort(this: Model, ToModel: typeof Model, relatedField: string, fieldName: string) {
    this.reactiveData[fieldName].sort();
  },
};

function setMany2One(
  recordId: InstanceId, // eg. message id 1
  ToModel: typeof Model, // eg. Messages
  fieldName: string, // eg. partner
  toReactiveData: ItemStuff["reactiveData"], // eg. partner.reactiveData

  RelatedModel: typeof Model, // eg. Partner
  relatedField: string, // eg. partner
  relatedIdFrom: InstanceId | undefined, // eg. partner id 1
  relatedIdTo: InstanceId | undefined, // eg. partner id 2
  relatedReactiveData: ItemStuff["reactiveData"] // eg. message.reactiveData
) {
  if (relatedIdFrom === relatedIdTo) return;
  const relatedModelId = RelatedModel.id;

  if (typeof relatedIdFrom === "number") {
    // remove from related record array
    const relatedStuffFrom = globalStore.getItemSuff(relatedModelId, relatedIdFrom);
    // could be optimized when called from mutableArrayMethods
    const index = (relatedStuffFrom.data[fieldName] as number[]).indexOf(relatedIdFrom);
    (relatedStuffFrom.reactiveData[fieldName] as number[]).splice(index, 1);
  }

  if (typeof relatedIdTo === "number") {
    toReactiveData[fieldName].push(recordId);
    relatedReactiveData[relatedField] = relatedIdTo;
  }
}

// Many2One field
function setMany2OneField(
  target: typeof Model,
  fieldName: string,
  fromModelId: ModelId,
  toModelId: ModelId
) {
  // const RelatedModel = modelRegistry[toModelId];
  const setter = function (this: Model, value: Model | number) {
    if (typeof value !== "number") {
      value = value.id!;
    }
    setMany2One(
      this.id!,
      modelRegistry[toModelId],
      fieldName,
      this.reactiveData,

      target,
      fieldName,
      this.reactiveData[fieldName],
      value,
      this.reactiveData
    );
  };
  Object.defineProperty(target.prototype, fieldName, {
    get() {
      const fn = derived(() => {
        const id = globalStore.getItemSuff(fromModelId, this.id!).reactiveData[fieldName];
        if (id === undefined || id === null) {
          return null;
        }
        return globalStore.getModelInstance(toModelId, id);
      });
      // (fn as any).
      Object.defineProperty(target, fieldName, { set: setter });
      return fn;
    },
    set: setter,
    configurable: true,
  });
}
