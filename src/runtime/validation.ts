import { OwlError } from "../common/owl_error";
import { toRaw } from "./reactivity";

type BaseType = { new (...args: any[]): any } | true | "*";

interface TypeInfo {
  type?: TypeDescription;
  optional?: boolean;
  validate?: Function;
  shape?: Schema;
  element?: TypeDescription;
  values?: TypeDescription;
}

type ValueType = { value: any };

type TypeDescription = BaseType | TypeInfo | ValueType | TypeDescription[];
type SimplifiedSchema = string[];
type NormalizedSchema = { [key: string]: TypeDescription };
export type Schema = SimplifiedSchema | NormalizedSchema;

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
const isUnionType = (t: TypeDescription): t is TypeDescription[] => Array.isArray(t);
const isBaseType = (t: TypeDescription): t is BaseType => typeof t !== "object";
const isValueType = (t: TypeDescription): t is ValueType =>
  typeof t === "object" && t && "value" in t;

export function isOptional(t: TypeDescription): Boolean {
  return typeof t === "object" && "optional" in t ? t.optional || false : false;
}

function describeType(type: BaseType): string {
  return type === "*" || type === true ? "value" : type.name.toLowerCase();
}

function describe(info: TypeDescription): string {
  if (isBaseType(info)) {
    return describeType(info);
  } else if (isUnionType(info)) {
    return info.map(describe).join(" or ");
  } else if (isValueType(info)) {
    return String(info.value);
  }
  if ("element" in info) {
    return `list of ${describe({ type: info.element, optional: false })}s`;
  }
  if ("shape" in (info as TypeInfo)) {
    return `object`;
  }
  return describe(info.type || "*");
}

function toSchema(spec: SimplifiedSchema): NormalizedSchema {
  return Object.fromEntries(
    spec.map((e) =>
      e.endsWith("?") ? [e.slice(0, -1), { optional: true }] : [e, { type: "*", optional: false }]
    )
  );
}

const SCHEMA_KEYS = new Set(["element", "optional", "shape", "type", "validate", "values"]);

/**
 * Main validate function
 */
export function validate(obj: { [key: string]: any }, spec: Schema) {
  let errors = validateSchema(obj, spec);
  if (errors.length) {
    throw new OwlError("Invalid object: " + errors.join(", "));
  }
}

/**
 * Helper validate function, to get the list of errors. useful if one want to
 * manipulate the errors without parsing an error object
 */
export function validateSchema(obj: { [key: string]: any }, schema: Schema): string[] {
  if (Array.isArray(schema)) {
    schema = toSchema(schema);
  }
  obj = toRaw(obj);
  let errors = [];
  // check if each value in obj has correct shape
  for (let key in obj) {
    if (key in schema) {
      let result = validateType(key, obj[key], schema[key]);
      if (result) {
        errors.push(result);
      }
    } else if (!("*" in schema)) {
      errors.push(`unknown key '${key}'`);
    }
  }
  // check that all specified keys are defined in obj
  for (let key in schema) {
    const spec = schema[key];
    if (key !== "*" && !isOptional(spec) && !(key in obj)) {
      const isObj = typeof spec === "object" && !Array.isArray(spec);
      const isAny = spec === "*" || (isObj && "type" in spec ? spec.type === "*" : isObj);
      let detail = isAny ? "" : ` (should be a ${describe(spec)})`;
      errors.push(`'${key}' is missing${detail}`);
    }
  }
  return errors;
}

function validateBaseType(key: string, value: any, type: BaseType): string | null {
  if (typeof type === "function") {
    if (typeof value === "object") {
      if (!(value instanceof type)) {
        return `'${key}' is not a ${describeType(type)}`;
      }
    } else if (typeof value !== type.name.toLowerCase()) {
      return `'${key}' is not a ${describeType(type)}`;
    }
  }
  return null;
}

function validateArrayType(key: string, value: any, descr: TypeDescription): string | null {
  if (!Array.isArray(value)) {
    return `'${key}' is not a list of ${describe(descr)}s`;
  }
  for (let i = 0; i < value.length; i++) {
    const error = validateType(`${key}[${i}]`, value[i], descr);
    if (error) {
      return error;
    }
  }
  return null;
}

export function validateType(key: string, value: any, descr: TypeDescription): string | null {
  if (value === undefined) {
    return isOptional(descr) ? null : `'${key}' is undefined (should be a ${describe(descr)})`;
  } else if (isBaseType(descr)) {
    return validateBaseType(key, value, descr);
  } else if (isValueType(descr)) {
    return value === descr.value ? null : `'${key}' is not equal to '${descr.value}'`;
  } else if (isUnionType(descr)) {
    let validDescr = descr.find((p) => !validateType(key, value, p));
    return validDescr ? null : `'${key}' is not a ${describe(descr)}`;
  }
  const invalidKeys = Reflect.ownKeys(descr).filter((key) => !SCHEMA_KEYS.has(String(key)));
  if (invalidKeys.length) {
    return `invalid schema for '${key}': unknown keys ${invalidKeys
      .map((key) => `"${String(key)}"`)
      .join(", ")}`;
  }
  if ("element" in descr) {
    return validateArrayType(key, value, descr.element!);
  }
  if ("shape" in descr) {
    if (typeof value !== "object" || Array.isArray(value)) {
      return `'${key}' is not an object`;
    } else {
      const errors = validateSchema(value, descr.shape!);
      if (errors.length) {
        return `'${key}' doesn't have the correct shape (${errors.join(", ")})`;
      }
    }
  }
  if ("values" in descr) {
    if (typeof value !== "object" || Array.isArray(value)) {
      return `'${key}' is not an object`;
    } else {
      const errors = Object.entries(value)
        .map(([key, value]) => validateType(key, value, descr.values!))
        .filter(Boolean);
      if (errors.length) {
        return `some of the values in '${key}' are invalid (${errors.join(", ")})`;
      }
    }
  }
  if ("type" in descr) {
    return validateType(key, value, descr.type!);
  }
  if ("validate" in descr) {
    return !descr.validate!(value) ? `'${key}' is not valid` : null;
  }
  return null;
}
