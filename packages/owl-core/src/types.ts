import { atomSymbol, type ReactiveValue } from "./computations";
import { ValidationContext, ValidationIssue } from "./validation";

export type Constructor<T = any> = { new (...args: any[]): T };

// Runtime metadata attached to validators by `.optional(value)`. The default
// is normalized to a factory: an explicit factory produces a fresh value per
// consumer, a plain value is wrapped in a constant factory (so it is shared).
const defaultSymbol = Symbol("default");
// The wrapped type, so that `applyDefaults` can recurse through a default.
const innerTypeSymbol = Symbol("innerType");
// Attached to object/tuple validators, so that `applyDefaults` can walk them.
const shapeSymbol = Symbol("shape");
// Attached to array validators, so that `applyDefaults` can visit elements.
const elementTypeSymbol = Symbol("elementType");
// Attached to validators created by `.optional()`: an object key with an
// optional type may be omitted.
const optionalSymbol = Symbol("optional");

// Type-level brand carried by `.optional(value)`. It is phantom (declare):
// nothing exists at runtime under this key. The brand stores the wrapped type
// so it can be recovered with `infer`. Exported so that dependent
// declarations (e.g. a `Resource<T>` field) can be emitted across modules.
export declare const hasDefault: unique symbol;
export type WithDefault<T> = T & { [hasDefault]: T };

// Type-level brand carried by `.optional()`, phantom like `hasDefault`.
export declare const isOptional: unique symbol;
export type Optional<T> = T & { [isOptional]: T };

// Type-level brand carried by every type built by the `types` factories. It
// is phantom: at runtime, only the `optional` method exists on the validator.
export declare const typeBrand: unique symbol;
export type Type<T> = T & {
  [typeBrand]: T;
  /**
   * Marks the type as optional: `undefined` passes validation, and an object
   * key with an optional type may be omitted.
   */
  optional(): Optional<T>;
  /**
   * Marks the type as optional, with a default value to fill it: the reader
   * of the value always gets one (the default replaces an omitted value). The
   * default can be given as a factory (`() => value`), which is called once
   * per consumer, so mutable defaults ([], {}) are not shared. A default for
   * a function type must use the factory form.
   */
  optional(value: T extends Function ? () => T : T | (() => T)): WithDefault<T>;
};

type IsAny<T> = 0 extends 1 & T ? true : false;
type HasDefault<T> = IsAny<T> extends true ? false : T extends { [hasDefault]: any } ? true : false;
type IsOptional<T> = IsAny<T> extends true ? false : T extends { [isOptional]: any } ? true : false;
type StripDefault<T> = T extends { [hasDefault]: infer U } ? U : T;
type StripOptional<T> = T extends { [isOptional]: infer U } ? U | undefined : T;
type StripType<T> = T extends { [typeBrand]: infer U } ? U : T;
// Recovers the value type carried by a validator: brands are removed, and an
// optional type resolves to `T | undefined`.
export type StripBrands<T> = StripType<StripDefault<StripOptional<T>>>;
type StripBrandsAll<T extends any[]> = { [K in keyof T]: StripBrands<T[K]> };

// Keys whose type carries a default. The distributive conditional makes the
// union resolve eagerly, so editors display the plain union of key names
// (`"p" | "q"`) instead of the unevaluated alias.
export type GetDefaultedKeys<T> = keyof T extends infer K
  ? K extends keyof T
    ? HasDefault<T[K]> extends true
      ? K
      : never
    : never
  : never;

export type GetOptionalEntries<T> = {
  [K in keyof T as IsOptional<T[K]> extends true
    ? K
    : HasDefault<T[K]> extends true
      ? K
      : never]?: StripBrands<T[K]>;
};
type GetRequiredEntries<T> = {
  [K in keyof T as IsOptional<T[K]> extends true
    ? never
    : HasDefault<T[K]> extends true
      ? never
      : K]: StripBrands<T[K]>;
};
export type PrettifyShape<T> = T extends Function ? T : { [K in keyof T]: T[K] };
export type ResolveOptionalEntries<T> = PrettifyShape<GetRequiredEntries<T> & GetOptionalEntries<T>>;

// Object type as seen by the reader of the values once defaults are applied:
// defaulted keys are required (the default fills them), only optional keys
// may be absent. Resolves to a flat object type, so editors display it
// expanded.
export type ResolveReaderObjectType<T> = PrettifyShape<
  {
    [K in keyof T as IsOptional<T[K]> extends true ? never : K]: StripBrands<T[K]>;
  } & {
    [K in keyof T as IsOptional<T[K]> extends true ? K : never]?: StripBrands<T[K]>;
  }
>;

export type KeyedObject<K extends string[]> = {
  [P in K[number]]: any;
};

type ResolveShapedObject<T extends {}> = PrettifyShape<ResolveOptionalEntries<T>>;
export type ResolveObjectType<T extends {}> = ResolveShapedObject<
  T extends string[] ? KeyedObject<T> : T
>;

export type UnionToIntersection<U> = (U extends any ? (_: U) => any : never) extends (
  _: infer I
) => void
  ? I
  : never;

/**
 * Returns the default value factory attached to a type by `.optional(value)`,
 * if any. This is how consumers (props, config, ...) resolve defaults at
 * runtime: validation only runs in dev mode, so defaults are metadata on the
 * schema, not a validation side-effect.
 */
export function getDefault(type: any): (() => any) | undefined {
  return typeof type === "function" ? type[defaultSymbol] : undefined;
}

// Runtime implementation of the `optional` method declared on `Type`. With a
// `value` argument, the type also carries a default: it fills the value for
// the reader when it is omitted.
function makeOptional(type: any, value?: any): any {
  const validate = function validateOptional(context: ValidationContext) {
    if (context.value === undefined) {
      return;
    }
    context.validate(type);
  } as any;
  validate[optionalSymbol] = true;
  validate[innerTypeSymbol] = type;
  if (value !== undefined) {
    validate[defaultSymbol] = typeof value === "function" ? value : () => value;
  }
  return validate;
}

function isOptionalType(type: any): boolean {
  return typeof type === "function" && optionalSymbol in type;
}

// Attaches the `optional` method to a validator: every `types` factory
// funnels its validator through this.
function makeType(validate: (context: ValidationContext) => void): any {
  (validate as any).optional = (value?: any) => makeOptional(validate, value);
  return validate;
}

/**
 * Returns `value` with defaults from the schema filled in, at any depth: a
 * default fires when the value at its schema position is `undefined`. The
 * input is never mutated; objects are copied along the changed paths only, so
 * if nothing is filled in, `value` is returned as is.
 *
 * Note that this only recurses through object shapes, tuples and arrays
 * (unions are ambiguous, records have no fixed keys).
 */
export function applyDefaults<T>(value: unknown, type: T): StripBrands<T> {
  return applyDefaultsRec(value, type);
}

function applyDefaultsRec(value: any, type: any): any {
  if (typeof type !== "function") {
    return value;
  }
  if (value === undefined) {
    const factory = type[defaultSymbol];
    if (!factory) {
      return value;
    }
    value = factory();
  }
  const inner = type[innerTypeSymbol] || type;
  if (typeof inner !== "function" || !value || typeof value !== "object") {
    return value;
  }
  const elementType = inner[elementTypeSymbol];
  if (elementType && Array.isArray(value)) {
    let result = value;
    for (let index = 0; index < value.length; index++) {
      const newValue = applyDefaultsRec(value[index], elementType);
      if (newValue !== value[index]) {
        if (result === value) {
          result = [...value];
        }
        result[index] = newValue;
      }
    }
    return result;
  }
  const shape = inner[shapeSymbol];
  if (!shape) {
    return value;
  }
  let result = value;
  for (const key in shape) {
    const subValue = result[key];
    const newValue = applyDefaultsRec(subValue, shape[key]);
    if (newValue !== subValue) {
      if (result === value) {
        result = Array.isArray(value) ? [...value] : { ...value };
      }
      result[key] = newValue;
    }
  }
  return result;
}

function anyType(): Type<any> {
  return makeType(function validateAny() {});
}

function booleanType(): Type<boolean> {
  return makeType(function validateBoolean(context: ValidationContext) {
    if (typeof context.value !== "boolean") {
      context.addIssue({ message: "value is not a boolean" });
    }
  });
}

function numberType<T extends number = number>(): Type<T> {
  return makeType(function validateNumber(context: ValidationContext) {
    if (typeof context.value !== "number") {
      context.addIssue({ message: "value is not a number" });
    }
  });
}

function stringType<T extends string = string>(): Type<T> {
  return makeType(function validateString(context: ValidationContext) {
    if (typeof context.value !== "string" && !(context.value instanceof String)) {
      context.addIssue({ message: "value is not a string" });
    }
  });
}

function arrayType(): Type<any[]>;
function arrayType<T>(): Type<T[]>;
function arrayType<T>(elementType: T): Type<StripBrands<T>[]>;
function arrayType(elementType?: any): any {
  const validate = makeType(function validateArray(context: ValidationContext) {
    if (!Array.isArray(context.value)) {
      context.addIssue({ message: "value is not an array" });
      return;
    }
    if (!elementType) {
      return;
    }

    for (let index = 0; index < context.value.length; index++) {
      context.withKey(index).validate(elementType);
    }
  });
  if (elementType) {
    validate[elementTypeSymbol] = elementType;
  }
  return validate;
}

export function constructorType<T extends Constructor>(constructor: T): Type<T> {
  return makeType(function validateConstructor(context: ValidationContext) {
    if (
      !(typeof context.value === "function") ||
      !(context.value === constructor || context.value.prototype instanceof constructor)
    ) {
      context.addIssue({ message: `value is not '${constructor.name}' or an extension` });
    }
  });
}

function customValidator<T>(
  type: T,
  validator: (value: StripBrands<T>) => boolean,
  errorMessage: string = "value does not match custom validation"
): Type<StripBrands<T>> {
  return makeType(function validateCustom(context: ValidationContext) {
    context.validate(type);
    if (!context.isValid) {
      return;
    }

    if (!validator(context.value)) {
      context.addIssue({ message: errorMessage });
    }
  });
}

function functionType(): Type<(...parameters: any[]) => any>;
function functionType<const P extends any[]>(
  parameters: P
): Type<(...parameters: StripBrandsAll<P>) => void>;
function functionType<const P extends any[], R>(): Type<(...parameters: P) => R>;
function functionType<const P extends any[], R>(
  parameters: P,
  result: R
): Type<(...parameters: StripBrandsAll<P>) => StripBrands<R>>;
function functionType(parameters = [], result = undefined): any {
  return makeType(function validateFunction(context: ValidationContext) {
    if (typeof context.value !== "function") {
      context.addIssue({ message: "value is not a function" });
    }
  });
}

function instanceType<T extends Constructor>(constructor: T): Type<InstanceType<T>> {
  return makeType(function validateInstanceType(context: ValidationContext) {
    if (!(context.value instanceof constructor)) {
      context.addIssue({ message: `value is not an instance of '${constructor.name}'` });
    }
  });
}

function intersection<T extends any[]>(types: T): Type<UnionToIntersection<StripBrands<T[number]>>> {
  return makeType(function validateIntersection(context: ValidationContext) {
    for (const type of types) {
      context.validate(type);
    }
  });
}

export type LiteralTypes = number | string | boolean | null | undefined;
function literalType<const T extends LiteralTypes>(literal: T): Type<T> {
  return makeType(function validateLiteral(context: ValidationContext) {
    if (context.value !== literal) {
      context.addIssue({
        message: `value is not equal to ${typeof literal === "string" ? `'${literal}'` : literal}`,
      });
    }
  });
}

function literalSelection<const T extends LiteralTypes>(literals: T[]): Type<T> {
  return union(literals.map(literalType)) as any;
}

function validateObject(context: ValidationContext, schema: any, isStrict: boolean) {
  if (typeof context.value !== "object" || Array.isArray(context.value) || context.value === null) {
    context.addIssue({ message: "value is not an object" });
    return;
  }
  if (!schema) {
    return;
  }

  const isShape = !Array.isArray(schema);
  let shape: Record<string, any>;
  let keys: string[];
  if (isShape) {
    keys = Object.keys(schema);
    shape = schema;
  } else {
    keys = schema;
    shape = {};
    for (const key of keys) {
      shape[key] = null;
    }
  }

  const missingKeys: string[] = [];
  for (const key of keys) {
    if (context.value[key] === undefined) {
      // optional keys (with or without a default) may be omitted
      if (!isOptionalType(shape[key])) {
        missingKeys.push(key);
      }
      continue;
    }
    if (isShape) {
      context.withKey(key).validate(shape[key]);
    }
  }
  if (missingKeys.length) {
    context.addIssue({
      message: "object value has missing keys",
      missingKeys,
    });
  }
  if (isStrict) {
    const unknownKeys: string[] = [];
    for (const key in context.value) {
      if (!keys.includes(key)) {
        unknownKeys.push(key);
      }
    }
    if (unknownKeys.length) {
      context.addIssue({
        message: "object value has unknown keys",
        unknownKeys,
      });
    }
  }
}

function objectType(): Type<Record<string, any>>;
function objectType<const Keys extends string[]>(
  keys: Keys
): Type<ResolveOptionalEntries<KeyedObject<Keys>>>;
function objectType<Shape extends {}>(): Type<ResolveOptionalEntries<Shape>>;
function objectType<Shape extends {}>(shape: Shape): Type<ResolveOptionalEntries<Shape>>;
function objectType(schema = {}): any {
  const validate = makeType(function validateLooseObject(context: ValidationContext) {
    validateObject(context, schema, false);
  });
  if (!Array.isArray(schema)) {
    validate[shapeSymbol] = schema;
  }
  return validate;
}

function strictObjectType<const Keys extends string[]>(
  keys: Keys
): Type<ResolveOptionalEntries<KeyedObject<Keys>>>;
function strictObjectType<Shape extends {}>(shape: Shape): Type<ResolveOptionalEntries<Shape>>;
function strictObjectType(schema: any): any {
  const validate = makeType(function validateStrictObject(context: ValidationContext) {
    validateObject(context, schema, true);
  });
  if (!Array.isArray(schema)) {
    validate[shapeSymbol] = schema;
  }
  return validate;
}

function promiseType(): Type<Promise<void>>;
function promiseType<T>(type: T): Type<Promise<StripBrands<T>>>;
function promiseType(type?: any): any {
  return makeType(function validatePromise(context: ValidationContext) {
    if (!(context.value instanceof Promise)) {
      context.addIssue({ message: "value is not a promise" });
    }
  });
}

function recordType(): Type<Record<PropertyKey, any>>;
function recordType<V>(valueType: V): Type<Record<PropertyKey, StripBrands<V>>>;
function recordType(valueType?: any): any {
  return makeType(function validateRecord(context: ValidationContext) {
    if (
      typeof context.value !== "object" ||
      Array.isArray(context.value) ||
      context.value === null
    ) {
      context.addIssue({ message: "value is not an object" });
      return;
    }
    if (!valueType) {
      return;
    }
    for (const key in context.value) {
      context.withKey(key).validate(valueType);
    }
  });
}

function tuple<const T extends any[]>(types: T): Type<StripBrandsAll<T>> {
  const validate = makeType(function validateTuple(context: ValidationContext) {
    if (!Array.isArray(context.value)) {
      context.addIssue({ message: "value is not an array" });
      return;
    }
    if (context.value.length !== types.length) {
      context.addIssue({ message: "tuple value does not have the correct length" });
      return;
    }
    for (let index = 0; index < types.length; index++) {
      context.withKey(index).validate(types[index]);
    }
  });
  validate[shapeSymbol] = types;
  return validate;
}

function union<T extends any[]>(types: T): Type<StripBrands<T[number]>> {
  return makeType(function validateUnion(context: ValidationContext) {
    let firstIssueIndex = 0;
    const subIssues: ValidationIssue[] = [];
    for (const type of types) {
      const subContext = context.withIssues(subIssues);
      subContext.validate(type);
      if (subIssues.length === firstIssueIndex || subContext.issueDepth > 0) {
        context.mergeIssues(subIssues.slice(firstIssueIndex));
        return;
      }
      firstIssueIndex = subIssues.length;
    }
    context.addIssue({
      message: "value does not match union type",
      subIssues,
    });
  });
}

function reactiveValueType(): Type<ReactiveValue<any>>;
function reactiveValueType<T>(): Type<ReactiveValue<T>>;
function reactiveValueType<T>(type: T): Type<ReactiveValue<StripBrands<T>>>;
function reactiveValueType(type?: any): any {
  return makeType(function validateReactiveValue(context: ValidationContext) {
    if (typeof context.value !== "function" || !context.value[atomSymbol]) {
      context.addIssue({ message: "value is not a reactive value" });
    }
  });
}

function ref(): Type<HTMLElement | null>;
function ref<T extends Constructor<HTMLElement>>(type: T): Type<InstanceType<T> | null>;
function ref(type?: any): any {
  if (typeof HTMLElement === "undefined") {
    throw new Error("Cannot use ref in a non-DOM environment");
  }
  return union([literalType(null), instanceType(type || HTMLElement)]);
}

export const types = {
  and: intersection,
  any: anyType,
  array: arrayType,
  boolean: booleanType,
  constructor: constructorType,
  customValidator: customValidator,
  function: functionType,
  instanceOf: instanceType,
  literal: literalType,
  number: numberType,
  object: objectType,
  or: union,
  promise: promiseType,
  record: recordType,
  ref,
  selection: literalSelection,
  signal: reactiveValueType,
  strictObject: strictObjectType,
  string: stringType,
  tuple: tuple,
};
