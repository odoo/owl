import { RawStore } from "../../../tests/model.test";
import { reactive } from "../reactivity";
import { Model } from "./model";
import { Models } from "./modelRegistry";
import {
  ModelId,
  InstanceId,
  RecordItem,
  NormalizedDomain,
  SearchEntry,
  X2ManyFieldDefinition,
} from "./types";

export type StoreData = Record<ModelId, Record<InstanceId, RecordItem>>;
class Store {
  searches: Record<ModelId, Record<NormalizedDomain, SearchEntry>> = {};
  data: Record<ModelId, Record<InstanceId, RecordItem>> = {};

  getModelData(modelId: ModelId) {
    return (this.data[modelId] ??= {});
  }
}

export const globalStore = new Store();

export function setStore(store: RawStore) {
  for (const modelId of Object.keys(store)) {
    const Model = Models[modelId];
    const recordIds = Object.keys(store[modelId]).map((id) => Number(id));
    for (const id of recordIds) {
      const newData = store[modelId][id as unknown as number];
      Object.assign(Model.getRecordItem(id).data, newData);
    }
    globalStore.searches[modelId] = {
      "[]": {
        ids: reactive(recordIds.map((id) => id)),
      },
    };
  }
}
export function destroyStore() {
  globalStore.data = {};
  globalStore.searches = {};
}

export function loadRecord(modelId: ModelId, instanceId: InstanceId, data: Record<string, any>) {
  const Model = Models[modelId];
  const instance = Model.get(instanceId);
  Object.assign(instance.reactiveData, data);
}

export function loadRecordWithRelated(Mod: typeof Model, instanceData: Record<string, any>) {
  console.warn(`Model.id, instanceData:`, Mod.id, instanceData);
  const id = instanceData.id;
  if (id === undefined) {
    throw new Error("Instance data must have an id field");
  }
  const instance = Mod.get(id);
  for (const fieldName in instanceData) {
    const field = Mod.fields[fieldName];
    const value = instanceData[fieldName];
    if (Array.isArray(value)) {
      const f = field as X2ManyFieldDefinition;
      const ids = value.map((itemOrId) => {
        if (typeof itemOrId !== "object") return itemOrId;
        const RelatedModel = Models[f.modelId];
        loadRecordWithRelated(RelatedModel, itemOrId);
        return itemOrId.id;
      });
      instance.reactiveData[fieldName] = ids;
    } else if (typeof value === "object" && value !== null) {
      const f = field as X2ManyFieldDefinition;
      const RelatedModel = Models[f.modelId];
      loadRecordWithRelated(RelatedModel, value);
      instance.reactiveData[fieldName] = value.id;
    } else {
      instance.reactiveData[fieldName] = value;
    }
  }
  return instance;
}
(window as any).globalStore = globalStore;
