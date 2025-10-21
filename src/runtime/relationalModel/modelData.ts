import { combineLists } from "./model";
import { Models } from "./modelRegistry";
import { InstanceId, ModelId, RelationChanges } from "./types";

export type DataToSave = Record<ModelId, Record<InstanceId, RelationChanges>>;

const lastModelIds: Record<ModelId, number> = {};

export const saveHooks = {
  onSave: (data: DataToSave) => {},
};

export function saveModels() {
  const dataToSave: DataToSave = {};
  for (const Model of Object.values(Models)) {
    for (const item of Object.values(Model.recordsItems)) {
      const instance = item.instance;
      if (!instance) continue;
      dataToSave[Model.id] = dataToSave[Model.id] || {};
      dataToSave[Model.id][instance.id!] = deepClone(instance.changes);
      for (const key of Object.keys(instance.changes)) {
        const change = instance.changes[key];
        if (Array.isArray(change)) {
          // many2many or one2many field
          const [deleteList, addList] = change;
          const currentList = instance.data[key] as InstanceId[];
          instance.reactiveData[key] = combineLists(currentList, deleteList, addList);
        } else {
          // many2one or simple field
          instance.reactiveData[key] = change;
        }
        delete instance.reactiveChanges[key];
      }
    }
  }
  saveHooks.onSave(dataToSave);
  // simulate what the server returning new ids for created records
  for (const Model of Object.values(Models)) {
    let lastId = lastModelIds[Model.id] || 1000;
    for (const item of Object.values(Model.recordsItems)) {
      const instance = item.instance;
      if (!instance || typeof instance.id !== "string") continue;
      lastId++;
      item.instance!.reactiveData.id = lastId;
    }
    lastModelIds[Model.id] = lastId;
  }
}

function deepClone(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}
