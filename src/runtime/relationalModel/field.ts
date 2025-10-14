import { FieldDefinition, FieldTypes, ModelId } from "./types";

export function fieldString(): FieldDefinition {
  return field("string", {});
}

export function fieldOne2Many(
  modelId: ModelId,
  { relatedField }: { relatedField?: string } = {}
): FieldDefinition {
  return field("one2Many", { modelId, relatedField });
}

export function fieldMany2One(modelId: ModelId): FieldDefinition {
  return field("many2One", { modelId });
}
export function field(type: FieldTypes, opts: any = {}): FieldDefinition {
  return { type, ...opts };
}
