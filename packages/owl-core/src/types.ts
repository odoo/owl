import { atomSymbol, type ReactiveValue } from "./computations";
import { ValidationContext, ValidationIssue, Validator } from "./validation";

export type Constructor<T = any> = { new (...args: any[]): T };

export type GetOptionalEntries<T> = {
  [K in keyof T as K extends `${infer P}?` ? P : never]?: T[K];
};
type GetRequiredEntries<T> = {
  [K in keyof T as K extends `${string}?` ? never : K]: T[K];
};
export type PrettifyShape<T> = T extends Function ? T : { [K in keyof T]: T[K] };
export type ResolveOptionalEntries<T> = PrettifyShape<GetRequiredEntries<T> & GetOptionalEntries<T>>;

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
 * Wraps a validator function so it can stand in for the TS type it accepts.
 * The body is fully type-checked against {@link ValidationContext}; the return
 * type is erased to `any` so each factory can advertise its phantom type (e.g.
 * `numberType(): number`) without a cast at every call site.
 */
function validator(validate: Validator): any {
  return validate;
}

function anyType(): any {
  return validator(() => {});
}

function booleanType(): boolean {
  return validator((context) => {
    if (typeof context.value !== "boolean") {
      context.addIssue({ message: "value is not a boolean" });
    }
  });
}

function numberType(): number {
  return validator((context) => {
    if (typeof context.value !== "number") {
      context.addIssue({ message: "value is not a number" });
    }
  });
}

function stringType(): string {
  return validator((context) => {
    if (typeof context.value !== "string" && !(context.value instanceof String)) {
      context.addIssue({ message: "value is not a string" });
    }
  });
}

function arrayType(): any[];
function arrayType<T>(elementType: T): T[];
function arrayType(elementType?: any): any {
  return validator((context) => {
    if (!Array.isArray(context.value)) {
      context.addIssue({ message: "value is not an array" });
      return;
    }
    if (elementType) {
      for (let index = 0; index < context.value.length; index++) {
        context.validateKey(index, elementType);
      }
    }
  });
}

export function constructorType<T extends Constructor>(constructor: T): T {
  return validator((context) => {
    if (
      typeof context.value !== "function" ||
      !(context.value === constructor || context.value.prototype instanceof constructor)
    ) {
      context.addIssue({ message: `value is not '${constructor.name}' or an extension` });
    }
  });
}

function customValidator<T>(
  type: T,
  predicate: (value: T) => boolean,
  errorMessage: string = "value does not match custom validation"
): T {
  return validator((context) => {
    const issueCount = context.issues.length;
    context.validate(type as Validator);
    if (context.issues.length > issueCount) {
      return;
    }
    if (!predicate(context.value)) {
      context.addIssue({ message: errorMessage });
    }
  });
}

function functionType(): (...parameters: any[]) => any;
function functionType<const P extends any[]>(parameters: P): (...parameters: P) => void;
function functionType<const P extends any[], R>(parameters: P, result: R): (...parameters: P) => R;
function functionType(parameters = [], result = undefined): (...parameters: any[]) => any {
  return validator((context) => {
    if (typeof context.value !== "function") {
      context.addIssue({ message: "value is not a function" });
    }
  });
}

function instanceType<T extends Constructor>(constructor: T): InstanceType<T> {
  return validator((context) => {
    if (!(context.value instanceof constructor)) {
      context.addIssue({ message: `value is not an instance of '${constructor.name}'` });
    }
  });
}

function intersection<T extends any[]>(types: T): UnionToIntersection<T[number]> {
  return validator((context) => {
    for (const type of types) {
      context.validate(type);
    }
  });
}

export type LiteralTypes = number | string | boolean | null | undefined;
function literalType<const T extends LiteralTypes>(literal: T): T {
  return validator((context) => {
    if (context.value !== literal) {
      context.addIssue({
        message: `value is not equal to ${typeof literal === "string" ? `'${literal}'` : literal}`,
      });
    }
  });
}

function literalSelection<const T extends LiteralTypes>(literals: T[]): T {
  return union(literals.map(literalType)) as any;
}

function validateObject(context: ValidationContext, schema: any, isStrict: boolean) {
  const value = context.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    context.addIssue({ message: "value is not an object" });
    return;
  }
  if (!schema) {
    return;
  }

  // A schema is either a shape (a record of validators keyed by property name)
  // or a plain list of property names. Either way, an optional property is
  // marked with a trailing "?" in its key.
  const isShape = !Array.isArray(schema);
  const keys: string[] = isShape ? Object.keys(schema) : schema;

  const missingKeys: string[] = [];
  for (const key of keys) {
    const isOptional = key.endsWith("?");
    const property = isOptional ? key.slice(0, -1) : key;
    if (value[property] === undefined) {
      if (!isOptional) {
        missingKeys.push(property);
      }
    } else if (isShape) {
      context.validateKey(property, schema[key]);
    }
  }
  if (missingKeys.length) {
    context.addIssue({ message: "object value has missing keys", missingKeys, expectedKeys: keys });
  }
  if (isStrict) {
    const unknownKeys: string[] = [];
    for (const key in value) {
      if (!keys.includes(key) && !keys.includes(`${key}?`)) {
        unknownKeys.push(key);
      }
    }
    if (unknownKeys.length) {
      context.addIssue({ message: "object value has unknown keys", unknownKeys, expectedKeys: keys });
    }
  }
}

function objectType(): Record<string, any>;
function objectType<const Keys extends string[]>(
  keys: Keys
): ResolveOptionalEntries<KeyedObject<Keys>>;
function objectType<Shape extends {}>(shape: Shape): ResolveOptionalEntries<Shape>;
function objectType(schema = {}): Record<string, any> {
  return validator((context) => validateObject(context, schema, false));
}

function strictObjectType<const Keys extends string[]>(
  keys: Keys
): ResolveOptionalEntries<KeyedObject<Keys>>;
function strictObjectType<Shape extends {}>(shape: Shape): ResolveOptionalEntries<Shape>;
function strictObjectType(schema: any): Record<string, any> {
  return validator((context) => validateObject(context, schema, true));
}

function promiseType(): Promise<void>;
function promiseType<T>(type: T): Promise<T>;
function promiseType(type?: any): any {
  return validator((context) => {
    if (!(context.value instanceof Promise)) {
      context.addIssue({ message: "value is not a promise" });
    }
  });
}

function recordType(): Record<PropertyKey, any>;
function recordType<V>(valueType: V): Record<PropertyKey, V>;
function recordType(valueType?: any): any {
  return validator((context) => {
    if (typeof context.value !== "object" || context.value === null || Array.isArray(context.value)) {
      context.addIssue({ message: "value is not an object" });
      return;
    }
    if (valueType) {
      for (const key in context.value) {
        context.validateKey(key, valueType);
      }
    }
  });
}

function tuple<const T extends any[]>(types: T): T {
  return validator((context) => {
    if (!Array.isArray(context.value)) {
      context.addIssue({ message: "value is not an array" });
      return;
    }
    if (context.value.length !== types.length) {
      context.addIssue({ message: "tuple value does not have the correct length" });
      return;
    }
    for (let index = 0; index < types.length; index++) {
      context.validateKey(index, types[index]);
    }
  });
}

function union<T extends any[]>(types: T): T[number] {
  return validator((context) => {
    const basePath = context.path.join(" > ");
    const subIssues: ValidationIssue[] = [];
    for (const type of types) {
      const branchIssues = context.runIsolated(type);
      if (branchIssues.length === 0) {
        // The value matches this branch: the union is satisfied.
        return;
      }
      // A branch that fails below the union's own level (e.g. it matched the
      // outer shape but a nested property was wrong) is the branch the user
      // most likely intended, so report its issues rather than a generic one.
      if (branchIssues.some((issue) => issue.path !== basePath)) {
        context.issues.push(...branchIssues);
        return;
      }
      subIssues.push(...branchIssues);
    }
    context.addIssue({ message: "value does not match union type", subIssues });
  });
}

function reactiveValueType(): ReactiveValue<any>;
function reactiveValueType<T>(type: T): ReactiveValue<T>;
function reactiveValueType(type?: any): ReactiveValue<any> {
  return validator((context) => {
    if (typeof context.value !== "function" || !context.value[atomSymbol]) {
      context.addIssue({ message: "value is not a reactive value" });
    }
  });
}

function ref(): HTMLElement | null;
function ref<T extends Constructor<HTMLElement>>(type: T): InstanceType<T> | null;
function ref(type?: any): any {
  return union([literalType(null), instanceType(type)]);
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
