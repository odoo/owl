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

export type FieldDefinitionBase = { fieldName: string };
export type FieldDefinitionAny = FieldDefinitionBase & { type: "any" };
export type FieldDefinitionString = FieldDefinitionBase & { type: "string" };
export type FieldDefinitionChar = FieldDefinitionBase & { type: "char" };
export type FieldDefinitionText = FieldDefinitionBase & { type: "text" };
export type FieldDefinitionHtml = FieldDefinitionBase & { type: "html" };
export type FieldDefinitionDate = FieldDefinitionBase & { type: "date" };
export type FieldDefinitionDatetime = FieldDefinitionBase & { type: "datetime" };
export type FieldDefinitionSelection = FieldDefinitionBase & {
  type: "selection";
  selection: any;
};
export type FieldDefinitionReference = FieldDefinitionBase & { type: "reference" };
export type FieldDefinitionMany2OneReference = FieldDefinitionBase & { type: "many2one_reference" };
// Removed duplicate FieldDefinitionMany2One definition (already defined as FieldDefinitionX2Many & { type: "many2one" })
export type FieldDefinitionProperties = FieldDefinitionBase & { type: "properties" };
export type FieldDefinitionNumber = FieldDefinitionBase & { type: "number" };
export type FieldDefinitionX2Many = FieldDefinitionBase & { modelId: ModelId };
export type FieldDefinitionOne2Many = FieldDefinitionX2Many & {
  type: "one2many";
  relatedField?: string;
};
export type FieldDefinitionMany2One = FieldDefinitionX2Many & { type: "many2one" };
export type FieldDefinitionMany2Many = FieldDefinitionX2Many & {
  type: "many2many";
  relationTableName?: string;
};
export type X2ManyFieldDefinition =
  | FieldDefinitionOne2Many
  | FieldDefinitionMany2One
  | FieldDefinitionMany2Many;
export type FieldDefinition =
  | FieldDefinitionAny
  | FieldDefinitionString
  | FieldDefinitionChar
  | FieldDefinitionText
  | FieldDefinitionHtml
  | FieldDefinitionDate
  | FieldDefinitionDatetime
  | FieldDefinitionSelection
  | FieldDefinitionReference
  | FieldDefinitionMany2OneReference
  | FieldDefinitionProperties
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
