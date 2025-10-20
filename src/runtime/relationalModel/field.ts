import { FieldDefinition, FieldTypes, ModelId } from "./types";

export function fieldString(): FieldDefinition {
  return field("string", {});
}

export function fieldMany2Many(
  modelId: ModelId,
  opts: { relationTableName?: string } = {}
): FieldDefinition {
  return field("many2many", { modelId, ...opts });
}
export function fieldOne2Many(
  modelId: ModelId,
  { relatedField }: { relatedField?: string } = {}
): FieldDefinition {
  return field("one2many", { modelId, relatedField });
}
export function fieldMany2One(modelId: ModelId): FieldDefinition {
  return field("many2one", { modelId });
}
export function field(type: FieldTypes, opts: any = {}): FieldDefinition {
  const def: FieldDefinition = {
    fieldName: undefined,
    type,
    ...opts,
  };
  return def;
}
