import {
  FieldDefinition,
  FieldDefinitionAny,
  FieldDefinitionChar,
  FieldDefinitionDate,
  FieldDefinitionDatetime,
  FieldDefinitionHtml,
  FieldDefinitionMany2One,
  FieldDefinitionMany2OneReference,
  FieldDefinitionNumber,
  FieldDefinitionOne2Many,
  FieldDefinitionProperties,
  FieldDefinitionReference,
  FieldDefinitionSelection,
  FieldDefinitionText,
  FieldTypes,
  ModelId,
} from "./types";

export const fieldAny = () => field("any", {}) as FieldDefinitionAny;

export const fieldNumber = () => field("number", {}) as FieldDefinitionNumber;
export const fieldChar = () => field("char", {}) as FieldDefinitionChar;
export const fieldText = () => field("text", {}) as FieldDefinitionText;
export const fieldHtml = () => field("html", {}) as FieldDefinitionHtml;
export const fieldDate = () => field("date", {}) as FieldDefinitionDate;
export const fieldDatetime = () => field("datetime", {}) as FieldDefinitionDatetime;
export const fieldSelection = (selection: any) =>
  field("selection", { selection }) as FieldDefinitionSelection;
export const fieldReference = () => field("reference", {}) as FieldDefinitionReference;

export const fieldProperties = () => field("properties", {}) as FieldDefinitionProperties;

export const fieldOne2Many = (modelId: ModelId, { relatedField }: { relatedField?: string } = {}) =>
  field("one2many", { modelId, relatedField }) as FieldDefinitionOne2Many;
export const fieldMany2One = (modelId: ModelId) =>
  field("many2one", { modelId }) as FieldDefinitionMany2One;
export const fieldMany2Many = (modelId: ModelId, opts: { relationTableName?: string } = {}) =>
  field("many2many", { modelId, ...opts });

export const fieldMany2OneReference = () =>
  field("many2one_reference", {}) as FieldDefinitionMany2OneReference;

export const field = (type: FieldTypes, opts: any = {}): FieldDefinition => ({
  fieldName: undefined,
  type,
  ...opts,
});
