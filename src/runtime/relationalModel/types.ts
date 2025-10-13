import { Model } from "./model";

export type FieldTypes = "one2Many" | "many2One" | "string" | "number";
export type ModelId = string;
export type InstanceId = number;
export type ItemData = Record<string, any>;
export type ItemStuff = {
  data: ItemData;
  reactiveData: ItemData;
  model: Model;
};
export type FieldDefinition =
  | { type: "one2Many"; modelId: ModelId }
  | { type: "many2One"; modelId: ModelId }
  | { type: "string" }
  | { type: "number" };

export type One2Many<T extends Model> = (() => T[]) & {
  push: (m: T) => void;
};
