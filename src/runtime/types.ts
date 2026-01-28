import { ReactiveValue } from "./reactivity/computations";
import { Signal } from "./reactivity/signal";
import { ValidationContext, ValidationIssue } from "./validation";

type Constructor = { new (...args: any[]): any };

export type GetOptionalEntries<T> = {
  [K in keyof T as K extends `${infer P}?` ? P : never]?: T[K];
};
export type GetRequiredEntries<T> = {
  [K in keyof T as K extends `${string}?` ? never : K]: T[K];
};
export type PrettifyShape<T> = T extends Function ? T : { [K in keyof T]: T[K] };
type ResolveOptionalEntries<T> = PrettifyShape<GetRequiredEntries<T> & GetOptionalEntries<T>>;

export type KeyedObject<K extends string[]> = {
  [P in K[number]]: any;
};

type ResolveShapedObject<T extends {}> = PrettifyShape<ResolveOptionalEntries<T>>;
export type ResolveObjectType<T extends {}> = ResolveShapedObject<
  T extends string[] ? KeyedObject<T> : T
>;

const anyType: any = function validateAny() {} as any;

const booleanType: boolean = function validateBoolean(context: ValidationContext) {
  if (typeof context.value !== "boolean") {
    context.addIssue({ message: "value is not a boolean" });
  }
} as any;

const numberType: number = function validateNumber(context: ValidationContext) {
  if (typeof context.value !== "number") {
    context.addIssue({ message: "value is not a number" });
  }
} as any;

const stringType: string = function validateString(context: ValidationContext) {
  if (typeof context.value !== "string") {
    context.addIssue({ message: "value is not a string" });
  }
} as any;

function arrayType(): any[];
function arrayType<T>(elementType: T): T[];
function arrayType(elementType?: any): any {
  return function validateArray(context: ValidationContext) {
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
  } as any;
}

function constructorType<T extends Constructor>(constructor: T): T {
  return function validateConstructor(context: ValidationContext) {
    if (
      !(typeof context.value === "function") ||
      !(context.value === constructor || context.value.prototype instanceof constructor)
    ) {
      context.addIssue({ message: `value is not '${constructor.name}' or an extension` });
    }
  } as any;
}

function customValidator<T>(
  type: T,
  validator: (value: T) => boolean,
  errorMessage: string = "value does not match custom validation"
): T {
  return function validateCustom(context: ValidationContext) {
    context.validate(type);
    if (!context.isValid) {
      return;
    }

    if (!validator(context.value)) {
      context.addIssue({ message: errorMessage });
    }
  } as any;
}

function functionType(): (...parameters: any[]) => any;
function functionType<const P extends any[]>(parameters: P): (...parameters: P) => void;
function functionType<const P extends any[], R>(parameters: P, result: R): (...parameters: P) => R;
function functionType(parameters = [], result = undefined): (...parameters: any[]) => any {
  return function validateFunction(context: ValidationContext) {
    if (typeof context.value !== "function") {
      context.addIssue({ message: "value is not a function" });
    }
  } as any;
}

function instanceType<T extends Constructor>(constructor: T): InstanceType<T> {
  return function validateInstanceType(context: ValidationContext) {
    if (!(context.value instanceof constructor)) {
      context.addIssue({ message: `value is not an instance of '${constructor.name}'` });
    }
  } as any;
}

type LiteralTypes = number | string | boolean | null | undefined;
function literalType<const T extends LiteralTypes>(literal: T): T {
  return function validateLiteral(context: ValidationContext) {
    if (context.value !== literal) {
      context.addIssue({
        message: `value is not equal to ${typeof literal === "string" ? `'${literal}'` : literal}`,
      });
    }
  } as any;
}

function validateObjectShape(context: ValidationContext, shape: Record<string, any>) {
  const missingKeys: string[] = [];
  for (const key in shape) {
    const property = key.endsWith("?") ? key.slice(0, -1) : key;
    if (context.value[property] === undefined) {
      if (!key.endsWith("?")) {
        missingKeys.push(property);
      }
      continue;
    }
    context.withKey(property).validate(shape[key]);
  }
  if (missingKeys.length) {
    context.addIssue({
      message: "object value have missing keys",
      missingKeys,
    });
  }
}

function validateObjectKeys(context: ValidationContext, keys: string[]) {
  const missingKeys = keys.filter((key) => {
    if (key.endsWith("?")) {
      return false;
    }
    return !(key in context.value);
  });
  if (missingKeys.length) {
    context.addIssue({
      message: "object value have missing keys",
      missingKeys,
    });
  }
}

function objectType(): Record<string, any>;
function objectType<const Keys extends string[]>(
  keys: Keys
): ResolveOptionalEntries<KeyedObject<Keys>>;
function objectType<Shape extends {}>(shape: Shape): ResolveOptionalEntries<Shape>;
function objectType(schema = {}): Record<string, any> {
  return function validateObject(context: ValidationContext) {
    if (
      typeof context.value !== "object" ||
      Array.isArray(context.value) ||
      context.value === null
    ) {
      context.addIssue({ message: "value is not an object" });
      return;
    }
    if (!schema) {
      return;
    }

    if (Array.isArray(schema)) {
      validateObjectKeys(context, schema);
    } else {
      validateObjectShape(context, schema);
    }
  } as any;
}

function promiseType(): Promise<void>;
function promiseType<T>(type: T): Promise<T>;
function promiseType(type?: any): any {
  return function validatePromise(context: ValidationContext) {
    if (!(context.value instanceof Promise)) {
      context.addIssue({ message: "value is not a promise" });
    }
  } as any;
}

function recordType(): Record<PropertyKey, any>;
function recordType<V>(valueType: V): Record<PropertyKey, V>;
function recordType(valueType?: any): any {
  return function validateRecord(context: ValidationContext) {
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
  } as any;
}

function tuple<const T extends any[]>(types: T): T {
  return function validateTuple(context: ValidationContext) {
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
  } as any;
}

function union<T extends any[]>(types: T): T extends Array<infer E> ? E : never {
  return function validateUnion(context: ValidationContext) {
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
  } as any;
}

function signalType(): Signal<any>;
function signalType<T>(type: T): Signal<T>;
function signalType(type?: any): Signal<any> {
  return function validateSignal(context: ValidationContext) {
    if (typeof context.value !== "function") {
      context.addIssue({ message: "value is not a signal (it should be function)" });
    }
    if (typeof context.value.set !== "function") {
      context.addIssue({
        message: "value is not a signal (method 'set' should be defined as a function)",
      });
    }
  } as any;
}

function reactiveValueType(): ReactiveValue<any>;
function reactiveValueType<T>(type: T): ReactiveValue<T>;
function reactiveValueType(type?: any): ReactiveValue<any> {
  return function validateReactiveValue(context: ValidationContext) {
    if (typeof context.value !== "function") {
      context.addIssue({ message: "value is not a reactive (it should be function)" });
    }
  } as any;
}

export const types = {
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
  promise: promiseType,
  reactiveValue: reactiveValueType,
  record: recordType,
  signal: signalType,
  string: stringType,
  tuple: tuple,
  union: union,
};
