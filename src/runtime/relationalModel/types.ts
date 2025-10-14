import { Model } from "./model";

export type FieldTypes = "one2Many" | "many2One" | "string" | "number";
export type ModelId = string;
export type NormalizedDomain = string;
export type InstanceId = number;
export type ItemData = Record<string, any>;
export type ItemStuff = {
  data: ItemData;
  reactiveData: ItemData;
  model: Model;
};

export type FieldDefinitionOne2Many = {
  type: "one2Many";
  modelId: ModelId;
  relatedField?: string;
};
export type FieldDefinitionMany2One = {
  type: "many2One";
  modelId: ModelId;
};
export type FieldDefinitionString = { type: "string" };
export type FieldDefinitionNumber = { type: "number" };
export type FieldDefinition =
  | FieldDefinitionOne2Many
  | FieldDefinitionMany2One
  | FieldDefinitionString
  | FieldDefinitionNumber;

export type One2Many<T extends Model> = (() => T[]) & {
  push: (m: T) => void;
};
export type SearchEntry = {
  ids: InstanceId[];
};
