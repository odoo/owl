import { combineLists, Model } from "./model";
import { Models } from "./modelRegistry";
import { isMany2OneField, isX2ManyField } from "./modelUtils";
import { InstanceId, ModelId, RelationChanges } from "./types";

export type DataToSave = Record<ModelId, Record<InstanceId, RelationChanges>>;

const lastModelIds: Record<ModelId, number> = {};

export const saveHooks = {
  onSave: (data: DataToSave) => {},
};

export const x2ManyCommands = {
  // (0, virtualID | false, { values })
  CREATE: 0,
  // (1, id, { values })
  UPDATE: 1,
  // (2, id[, _])
  DELETE: 2,
  // (3, id[, _]) removes relation, but not linked record itself
  UNLINK: 3,
  // (4, id[, _])
  LINK: 4,
  // (5[, _[, _]])
  CLEAR: 5,
  // (6, _, ids) replaces all linked records with provided ids
  SET: 6,
};

export function getRecordChanges(
  record: Model,
  dataToSave: DataToSave = {},
  processedRecords = new Set<Model>()
) {
  const Mod = record.constructor as typeof Model;
  if (processedRecords.has(record)) return dataToSave;

  let itemChanges: Record<string, any> = {};
  for (const key of Object.keys(record.changes)) {
    if (key === "id") continue; // we can't change the id field
    const fieldDef = Mod.fields[key];
    if (!fieldDef) continue;
    const fieldType = fieldDef.type;
    if (isX2ManyField(fieldType)) {
      const relatedRecords: Model[] = (record as any)[key]();
      const relatedChanges: any[] = [];
      for (const record of relatedRecords) {
        const changes = getRecordChanges(record, dataToSave, processedRecords);
        delete changes.id;
        if (Object.keys(changes).length < 1) continue;
        const isNew = record.isNew();
        relatedChanges.push(
          isNew
            ? [x2ManyCommands.CREATE, record.id, changes]
            : [x2ManyCommands.UPDATE, record.id, changes]
        );
      }
      if (relatedChanges.length < 1) continue;
      itemChanges[key] = relatedChanges;
      continue;
    }
    if (isMany2OneField(fieldType)) {
      // const relatedRecord: Model = (record as any)[key];
      // const relatedChanges = getRecordChanges(relatedRecord, dataToSave, processedRecords);
      // if (Object.keys(relatedChanges).length > 0) {
      //   // there are changes to save in the related record
      //   delete relatedChanges.id;
      //   const isNew = relatedRecord.isNew();
      //   itemChanges[key] = isNew
      //     ? [x2ManyCommands.CREATE, null, relatedChanges]
      //     : [x2ManyCommands.UPDATE, relatedRecord.id, relatedChanges];
      // }

      continue;
    }
    const { changes } = record;
    if (!(key in changes)) continue;
    itemChanges[key] = deepClone(changes[key]);
  }
  if (Object.keys(itemChanges).length > 0) itemChanges.id = record.id;
  return itemChanges;
}

export function saveModels() {
  const dataToSave: DataToSave = {};
  for (const Model of Object.values(Models)) {
    for (const item of Object.values(Model.recordsItems)) {
      const instance = item.instance;
      if (!instance) continue;
      let itemChanges: Record<string, any> = {};
      for (const key of Object.keys(instance.changes)) {
        // skip one2many fields
        if (Model.fields[key]?.type === "one2many") continue;
        itemChanges[key] = deepClone(instance.changes[key]);
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
      if (Object.keys(itemChanges).length > 0) {
        dataToSave[Model.id] = dataToSave[Model.id] || {};
        dataToSave[Model.id][instance.id!] = itemChanges;
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

export function commitRecordChanges(record: Model) {
  const Mod = record.constructor as typeof Model;
  for (const key of Object.keys(record.changes)) {
    const field = Mod.fields[key];
    if (!field) continue;
    const change = record.changes[key];
    const reactiveData = record.reactiveData;
    if (Array.isArray(change)) {
      // many2many or one2many field
      const [deleteList, addList] = change;
      const currentList = record.data[key] as InstanceId[];
      reactiveData[key] = combineLists(currentList, deleteList, addList);
      delete record.reactiveChanges[key];
    } else {
      // many2one or simple field
      reactiveData[key] = change;
      delete record.reactiveChanges[key];
    }
  }
}

function deepClone(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}
