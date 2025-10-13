import { RawStore } from "../../../tests/model.test";
import { reactive } from "../reactivity";
import { modelRegistry } from "./model";
import { ModelId, InstanceId, ItemStuff } from "./types";

export type StoreData = Record<ModelId, Record<InstanceId, ItemStuff>>;
class Store {
  data: Record<ModelId, Record<InstanceId, ItemStuff>> = {};
  set<T>(modelId: ModelId, id: InstanceId, data: T) {
    const storedata = this.getItemSuff(modelId, id).data;
    Object.assign(storedata, data);
  }
  setReactive<T>(modelId: ModelId, id: InstanceId, data: T) {
    const storedata = this.getItemSuff(modelId, id).reactiveData;
    Object.assign(storedata, data);
  }
  getItemSuff(modelId: ModelId, id: InstanceId) {
    const modelData = (this.data[modelId] ??= {});
    let stuff = modelData[id];
    if (stuff) {
      return stuff;
    }
    stuff = modelData[id] = { data: {} } as ItemStuff;
    const reactiveData = reactive(stuff.data);
    stuff.reactiveData = reactiveData;
    stuff.model = undefined!;
    return stuff;
  }
  getModelInstance(modelId: ModelId, id: InstanceId) {
    const stuff = this.getItemSuff(modelId, id);
    const model = stuff.model;
    if (model) return model;

    const ModelClass = modelRegistry[modelId];
    if (!ModelClass) {
      throw new Error(`Model with id ${modelId} not found in registry`);
    }
    const newmodel = new ModelClass(id);
    stuff.model = newmodel;
    return newmodel;
  }
}

export const globalStore = new Store();

export function setStore(store: RawStore) {
  for (const modelId of Object.keys(store)) {
    for (const id of Object.keys(store[modelId])) {
      globalStore.set(modelId, Number(id), store[modelId][id as unknown as number]);
    }
  }
}
