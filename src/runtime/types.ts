import { ReactiveValue, Signal } from "./reactivity/signal";
import { validateType } from "./validation";

type Constructor = { new (...args: any[]): any };

export type GetOptionalEntries<T> = {
  [K in keyof T as K extends `${infer P}?` ? P : never]?: T[K];
};
export type GetRequiredEntries<T> = {
  [K in keyof T as K extends `${string}?` ? never : K]: T[K];
};
type PrettifyShape<T> = T extends Function ? T : { [K in keyof T]: T[K] };
export type ResolveOptionalEntries<T> = PrettifyShape<GetOptionalEntries<T> & GetRequiredEntries<T>>;

export type KeyedObject<K extends string> = {
  [P in K]: any;
};

export type ValidationIssue = { message: string; };
export type Validator = (value: any) => ValidationIssue[];

// REMOVE ME WHEN API IS DECIDED
const ISSUE: ValidationIssue[] = [{ message: "Validation issue" }];
const NO_ISSUE: ValidationIssue[] = [];

const anyType: any = function () {
  return NO_ISSUE;
} as any;

const booleanType: boolean = function validateBoolean(value: any) {
  if (typeof value !== "boolean") {
    return ISSUE;
  }
  return NO_ISSUE;
} as any;

const numberType: number = function validateNumber(value: any) {
  if (typeof value !== "number") {
    return ISSUE;
  }
  return NO_ISSUE;
} as any;

const stringType: string = function validateString(value: any) {
  if (typeof value !== "string") {
    return ISSUE;
  }
  return NO_ISSUE;
} as any;

function arrayType<T = any>(elementType?: T): T[] {
  return function validateArray(value: any) {
    if (!Array.isArray(value)) {
      return ISSUE;
    }
    if (elementType) {
      return value.flatMap((element) => validateType(element, elementType));
    }
    return NO_ISSUE;
  } as any;
}

function constructorType<T extends Constructor>(constructor: T): T {
  return function validateConstructor(value: any) {
    if (!(typeof value === "function") || !(value === constructor || value.prototype instanceof constructor)) {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function functionType<const P extends any[] = [], R = void>(parameters: P = [] as any, result: R = undefined as any): (...parameters: P) => R {
  return function validateFunction(value: any) {
    if (typeof value !== "function") {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function instanceType<T extends Constructor>(constructor: T): InstanceType<T> {
  return function validateInstanceType(value: any) {
    if (!(value instanceof constructor)) {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function keyedType<const K extends string>(keys: K[]): ResolveOptionalEntries<KeyedObject<K>> {
  return function validateKeys(value: any) {
    if (typeof value !== "object") {
      return ISSUE;
    }
    const valueKeys = Object.keys(value);
    const missingKeys = keys.filter((key) => {
      if (key.endsWith("?")) {
        return false;
      }
      return !valueKeys.includes(key);
    });
    if (missingKeys.length) {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function literalType<const T>(literal: T): T {
  return function validateLiteral(value: any) {
    if (value !== literal) {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function objectType<T extends Record<PropertyKey, any>>(shape = {} as T): ResolveOptionalEntries<T> {
  return function validateObject(value: any) {
    if (typeof value !== "object" || Array.isArray(value) || value === null) {
      return ISSUE;
    }

    if (shape) {
      const missingKeys: string[] = [];
      const issues: ValidationIssue[] = [];
      for (let key in shape) {
        if (value[key] === undefined && key.endsWith("?")) {
          continue;
        }
        const subIssues = validateType(value[key], shape[key]);
        if (key in value) {
          issues.push(...subIssues);
        } else {
          missingKeys.push(key);
        }
      }
      if (missingKeys.length) {
        issues.push(...ISSUE);
      }
      return issues;
    }

    return NO_ISSUE;
  } as any;
}

function promiseType<T = void>(type?: T): Promise<T> {
  return function validatePromise(value: any) {
    if (!(value instanceof Promise)) {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function recordType<V>(valueType: V): Record<PropertyKey, V> {
  return function validateRecord(value: any) {
    if (typeof value !== "object") {
      return ISSUE;
    }

    const issues: ValidationIssue[] = [];
    for (let key in value) {
      issues.push(...validateType(value[key], valueType));
    }
    return issues;
  } as any;
}

function tuple<const T extends any[]>(types: T): T {
  return function validateTuple(value: any) {
    if (!Array.isArray(value)) {
      return ISSUE;
    }
    if (value.length !== types.length) {
      return ISSUE;
    }
    return types.flatMap((type, index) => validateType(value[index], type));
  } as any;
}

function union<T extends any[]>(types: T): (T extends Array<infer E> ? E : never) {
  return function validateUnion(value: any) {
    const valids = types.filter((type) => !validateType(value, type).length);
    if (valids.length) {
      return NO_ISSUE;
    }
    return ISSUE;
  } as any;
}

function signalType<T>(type: T): Signal<T> {
  return function validateSignal(value: any) {
    if (typeof value !== "function") {
      return ISSUE;
    }
    if (typeof value.set !== "function") {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function reactiveValueType<T>(type: T): ReactiveValue<T> {
  return function validateReactiveValue(value: any) {
    if (typeof value !== "function") {
      return ISSUE;
    }
    return NO_ISSUE;
  } as any;
}

function customValidator<T>(validator: (value: T) => boolean, errorMessage: string = "Validation issue"): T {
  return function customValidation(value: any) {
    if (!validator(value)) {
      return [{ message: errorMessage }];
    }
    return NO_ISSUE;
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
  keys: keyedType,
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
