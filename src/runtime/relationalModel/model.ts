import { derived } from "../signals";
import { globalStore } from "./store";
import { ModelId, InstanceId, FieldDefinition, ItemStuff, One2Many } from "./types";

export const modelRegistry: Record<string, typeof Model> = {};

export class Model {
  static id: ModelId;
  static fields: Record<string, FieldDefinition> = {};
  id?: InstanceId;
  data!: ItemStuff["data"];
  reactiveData!: ItemStuff["reactiveData"];

  static get<T extends typeof Model>(this: T, id: InstanceId): InstanceType<T> {
    return globalStore.getModelInstance(this.id, id) as InstanceType<T>;
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
        const Model = modelRegistry[relatedModelId];
        if (!Model) {
          throw new Error(`Model with id ${relatedModelId} not found in registry`);
        }
        // todo: should be configurable rather than taking the first one2many field
        const relatedFieldName = Object.entries(Model.fields).find(([, d]) => {
          return d.type === "one2Many" && d.modelId === constructor.id;
        })?.[0]!;
        const store = globalStore; // todo: remove
        console.warn(`store:`, store); // todo: remove
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
function setOne2ManyField(
  target: typeof Model,
  fieldName: string,
  fromModelId: ModelId,
  toModelId: ModelId
) {
  let fn: One2Many<Model>;

  Object.defineProperty(target.prototype, fieldName, {
    get() {
      if (fn) return fn;
      fn = derived(() => {
        const list = globalStore.getItemSuff(fromModelId, this.id!).reactiveData[fieldName];
        return list.map((id: InstanceId) => {
          return globalStore.getModelInstance(toModelId, id);
        });
      }) as One2Many<Model>;
      Object.defineProperty(fn, "name", { value: fieldName });
      for (const [key, method] of Object.entries(mutableArrayMethods)) {
        Object.defineProperty(fn, key, {
          value: (method as any).bind(this, fieldName),
        });
      }
      for (const [key, method] of Object.entries(immutableMethods)) {
        let derrived: any;
        Object.defineProperty(fn, key, {
          get() {
            derrived = (method as any).bind(this, fieldName);
            return derrived;
          },
        });
      }
      return fn;
    },
  });
}
// function setMany2ManyField() {}

const mutableArrayMethods = {
  push(this: Model, fieldName: string, m: Model) {
    const id = m.id;
    m.delete(); // to avoid duplicates
    this.reactiveData[fieldName].push(id);
  },
  shift(this: Model, fieldName: string) {
    if (!this.data[fieldName].length) return;
    const instance = (this as any)[fieldName]()[0];
    instance.delete();
    this.reactiveData[fieldName].shift();
  },
  pop(this: Model, fieldName: string) {
    if (!this.data[fieldName].length) return;
    const instance = (this as any)[fieldName]()[this.data[fieldName].length - 1];
    instance.delete();
    this.reactiveData[fieldName].pop();
  },
  unshift(this: Model, fieldName: string, m: Model) {
    const id = m.id;
    m.delete(); // to avoid duplicates
    this.reactiveData[fieldName].unshift(id);
  },
  splice(this: Model, fieldName: string, start: number, deleteCount?: number) {
    const instances = (this as any)[fieldName]();
    const toDelete = instances.slice(start, start + (deleteCount || instances.length));
    toDelete.forEach((instance: Model) => instance.delete());
    this.reactiveData[fieldName].splice(start, deleteCount);
  },
  sort(this: Model, fieldName: string) {
    this.reactiveData[fieldName].sort();
  },
};

const immutableMethods = [
  "at",
  "find",
  "findLast",
  "findIndex",
  "findLastIndex",
  "indexOf",
  "lastIndexOf",
  "includes",
  "some",
  "every",
  "map",
  "filter",
  "concat",
  "with",
  "slice",
  "toSpliced",
  "toReversed",
  "toSorted",
  "reduce",
  "reduceRight",
]
  .map((methodName) => {
    return {
      [methodName]: function (this: Model, fieldName: string, ...args: any[]) {
        const instances = (this as any)[fieldName]();
        return (instances as any)[methodName](...args);
      },
    };
  })
  .reduce((acc, cur) => ({ ...acc, ...cur }), {});

function setMany2OneField(
  target: typeof Model,
  fieldName: string,
  fromModelId: ModelId,
  toModelId: ModelId
) {
  let instance: Model;
  let fn = derived(() => {
    const id = globalStore.getItemSuff(fromModelId, instance.id!).reactiveData[fieldName];
    if (id === undefined || id === null) {
      return null;
    }
    return globalStore.getModelInstance(toModelId, id);
  });
  (target as any).prototype[fieldName] = function (this: Model) {
    instance = this;
    return fn();
  };
}
