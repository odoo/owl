import {
  fieldAny,
  fieldChar,
  fieldDate,
  fieldDatetime,
  fieldMany2Many,
  fieldMany2One,
  fieldNumber,
  fieldOne2Many,
  fieldProperties,
  fieldSelection,
} from "../field";
import { Model } from "../model";
import { Models } from "../modelRegistry";
import { ModelId } from "../types";
import { WebModelConfig } from "./webModelTypes";

// function foo(test) {}

export function getOrMakeModel(modelId: ModelId): typeof Model {
  let Mod = Models[modelId];
  if (Mod) return Mod;
  Mod = makeNewModel(modelId);
  Mod.register();
  return Mod;
}

function makeNewModel(modelId: ModelId): typeof Model {
  const Mod = {
    [modelId]: class extends Model {
      static id = modelId;
    },
  }[modelId];
  return Mod;
}

export function makeModelFromWeb(
  config: WebModelConfig,
  processedModel = new Set<string>()
): typeof Model {
  if (processedModel.has(config.resModel!)) {
    return Models[config.resModel!];
  }
  const modelId = config.resModel!;
  processedModel.add(modelId);
  const Mod = Models[modelId] || makeNewModel(modelId);

  const fields = mapObject(config.fields, (fieldInfo) => {
    switch (fieldInfo.type) {
      case "many2one":
        return fieldMany2One(fieldInfo.relation!);
      case "one2many":
        return fieldOne2Many(fieldInfo.relation!, {
          relatedField: fieldInfo.relation_field,
        });
      case "many2many":
        return fieldMany2Many(fieldInfo.relation!);
      case "integer":
        return fieldNumber();
      case "char":
        return fieldChar();
      // case "boolean":
      //   return fieldBoolean();
      case "selection":
        return fieldSelection(fieldInfo.selection || []);
      case "date":
        return fieldDate();
      case "datetime":
        return fieldDatetime();
      case "properties":
        return fieldProperties();
      case "binary":
      case "html":
      case "json":
      case "datetime":
      case "float":
      case "monetary":
      case "text":
      default:
        return fieldAny();
    }
  });

  Mod.fields = { ...Mod.fields, ...fields };
  Mod.register();
  createRelatedModelsFromWeb(config, processedModel);
  return Mod;
}
// make related models
function createRelatedModelsFromWeb(config: WebModelConfig, processedModel: Set<string>) {
  const fields = config.fields;

  const relatedConfigs: Record<ModelId, WebModelConfig> = {};
  for (const fieldName in fields) {
    const fieldInfo = fields[fieldName];
    if (!["many2one", "one2many", "many2many"].includes(fieldInfo.type!)) {
      continue;
    }
    const relatedModelName = fieldInfo.relation!;
    // produce a fieldInfo for the related model
    relatedConfigs[relatedModelName] ||= {
      resModel: relatedModelName,
      fields: {},
    } as any;
    const config = relatedConfigs[relatedModelName];
    if (fieldInfo.type === "one2many") {
      // add the inverse many2one field
      config.fields[fieldInfo.relation_field!] = {
        type: "many2one",
        relation: config.resModel,
      };
    } else if (fieldInfo.type === "many2many") {
      // add a many2many field back to this model
      // config.fields[`${config.resModel.toLowerCase()}_ids`] = {
      //   type: "many2many",
      //   relation: config.resModel,
      // };
    } else if (fieldInfo.type === "many2one") {
      // add a one2many field back to this model
      // config.fields[`${config.resModel.toLowerCase()}_ids`] = {
      //   type: "one2many",
      //   relation: config.resModel,
      //   relation_field: fieldName,
      // };
    }
  }
  for (const relatedModelName in relatedConfigs) {
    makeModelFromWeb(relatedConfigs[relatedModelName], processedModel);
  }
}

function mapObject<T, U>(object: Record<string, T>, fn: (value: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(object).map(([k, v]) => [k, fn(v)]));
}
