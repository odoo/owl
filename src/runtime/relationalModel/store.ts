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
  DraftContextStore,
} from "./types";
import { RawStore } from "../../../tests/model.test";

export type StoreData = Record<ModelId, Record<InstanceId, RecordItem>>;
class Store {
  searches: Record<ModelId, Record<NormalizedDomain, SearchEntry>> = {};
  data: Record<ModelId, Record<InstanceId, RecordItem>> = {};

  getModelData(modelId: ModelId) {
    return (this.data[modelId] ??= {});
  }
}

export const globalStore = new Store();

// store shoulde be RawStore
export function setStore(store: any) {
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
  const id = instanceData.id;
  if (id === undefined) {
    throw new Error("Instance data must have an id field");
  }
  const instance = Mod.get(id);
  let item: RecordItem;
  for (const fieldName in instanceData) {
    const field = Mod.fields[fieldName];
    if (!field) {
      item ??= Mod.getRecordItem(id);
      item.dataToLoad ??= {};
      item.dataToLoad[fieldName] = instanceData[fieldName];
      continue;
    }
    const win = window as any;
    instanceData[fieldName] = win.parseServerValue(field, instanceData[fieldName]);
    const value = instanceData[fieldName];
    if (Array.isArray(value) && (field.type === "one2many" || field.type === "many2many")) {
      const f = field as X2ManyFieldDefinition;
      const ids = value.map((itemOrId) => {
        if (typeof itemOrId !== "object") return itemOrId;
        const RelatedModel = Models[f.modelId];
        loadRecordWithRelated(RelatedModel, itemOrId);
        return itemOrId.id;
      });
      instance.reactiveData[fieldName] = ids;
    } else if (typeof value === "object" && value !== null && field.type === "many2one") {
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
export function flushDataToLoad() {
  for (const Model of Object.values(Models)) {
    for (const item of Object.values(Model.recordsItems)) {
      const dataToLoad = item.dataToLoad;
      if (!dataToLoad) continue;
      delete item.dataToLoad;
      loadRecordWithRelated(Model, dataToLoad);
    }
  }
}
(window as any).globalStore = globalStore;

export function getStoreChanges(store: DraftContextStore) {
  const changes: RawStore = {};
  for (const modelId of Object.keys(store)) {
    changes[modelId] = {};
    const modelStore = store[modelId];
    for (const instanceId of Object.keys(modelStore)) {
      changes[modelId][instanceId] = modelStore[instanceId].changes;
    }
  }
  return changes;
}
