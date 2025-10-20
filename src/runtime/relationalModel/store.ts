import { RawStore } from "../../../tests/model.test";
import { reactive } from "../reactivity";
import { Models } from "./modelRegistry";
import { ModelId, InstanceId, RecordItem, NormalizedDomain, SearchEntry } from "./types";

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
