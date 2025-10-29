import { Model } from "./model";

export type FieldTypes = FieldDefinition["type"];
export type ModelId = string;
export type NormalizedDomain = string;
export type InstanceId = number | string;
export type FieldName = string;
export type ItemData = Record<string, any>;
export type RecordItem = {
  data: ItemData;
  reactiveData: ItemData;
  instance: Model;

  // This data is stored here in case we load data before a model or a related
  // model is defined.
  dataToLoad?: ItemData;
};
export type RelationChanges = Record<FieldName, null | InstanceId | [InstanceId[], InstanceId[]]>;

export interface FieldDefinitionBase {
  fieldName: string;
}
export interface FieldDefinitionAny extends FieldDefinitionBase {
  type: "any";
}
export interface FieldDefinitionString extends FieldDefinitionBase {
  type: "string";
}
export interface FieldDefinitionNumber extends FieldDefinitionBase {
  type: "number";
}
export interface FieldDefinitionX2Many extends FieldDefinitionBase {
  modelId: ModelId;
}
export interface FieldDefinitionOne2Many extends FieldDefinitionX2Many {
  type: "one2many";
  relatedField?: string;
}
export interface FieldDefinitionMany2One extends FieldDefinitionX2Many {
  type: "many2one";
}
export interface FieldDefinitionMany2Many extends FieldDefinitionX2Many {
  type: "many2many";
  relationTableName?: string;
}
export type X2ManyFieldDefinition =
  | FieldDefinitionOne2Many
  | FieldDefinitionMany2One
  | FieldDefinitionMany2Many;
export type FieldDefinition =
  | FieldDefinitionAny
  | FieldDefinitionString
  | FieldDefinitionNumber
  | X2ManyFieldDefinition;

export type ManyFn<T extends Model> = (() => T[]) & {
  add: (m: T) => void;
  delete: (m: T) => void;
  ids: () => InstanceId[];
};

export type SearchEntry = {
  ids: InstanceId[];
};

export type DraftContext = {
  store: Record<ModelId, Record<InstanceId, Model>>;
};
