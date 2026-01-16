import { ReactiveValue, Signal } from "./reactivity/signal";
import { validateType } from "./validation";

export type ValidationIssue = {};
export type Validator = (value: any) => ValidationIssue[];

type Constructor = { new (...args: any[]): any };

export const any: any = function () {
  return [];
} as any;

export const boolean: boolean = function validateBoolean(value: any) {
  if (typeof value !== "boolean") {
    return [{ type: "type", expected: Boolean, received: value }];
  }
  return [];
} as any;

export const number: number = function validateNumber(value: any) {
  if (typeof value !== "number") {
    return [{ type: "type", expected: Number, received: value }];
  }
  return [];
} as any;

export const string: string = function validateString(value: any) {
  if (typeof value !== "string") {
    return [{ type: "type", expected: String, received: value }];
  }
  return [];
} as any;

export function array<T>(type?: T): T[] {
  return function validateArray(value: any) {
    if (!Array.isArray(value)) {
      return [{ type: "type", expected: Array, received: value }];
    }
    if (type) {
      return value.flatMap((element) => validateType(element, type));
    }
    return [];
  } as any;
}

export function func<P extends any[] = [], R = void>(
  parameters: P,
  result: R
): (...parameters: P) => R {
  return function validateFunction(value: any) {
    if (typeof value !== "function") {
      return [{ type: "type", expected: Function, received: value }];
    }
    return [];
  } as any;
}

export function instanceOf<T extends Constructor>(type: T): InstanceType<T> {
  return function validateInstanceOf(value: any) {
    if (!(value instanceof type)) {
      return [{ type: "type", expected: type, received: value }];
    }
    return [];
  } as any;
}

type OptionalKeyedObject<K extends string> = {
  [P in K as K extends `${infer Name}?` ? Name : never]?: any;
};
type RequiredKeyedObject<K extends string> = {
  [P in K as K extends `${string}?` ? never : K]: any;
};
type KeyedObject<K extends string> = OptionalKeyedObject<K> & RequiredKeyedObject<K>;
export function keys<K extends string>(...keys: K[]): KeyedObject<K> {
  return function validateKeys(value: any) {
    if (typeof value !== "object") {
      return [{ type: "type", expected: Object, received: value }];
    }
    const valueKeys = Object.keys(value);
    const missingKeys = keys.filter((key) => {
      if (key.endsWith("?")) {
        return true;
      }
      return !valueKeys.includes(key);
    });
    if (missingKeys.length) {
      return [{ type: "missing keys", value, missingKeys }];
    }
    return [];
  } as any;
}

export function literal<T>(literal: T): T {
  return function validateLiteral(value: any) {
    if (value !== literal) {
      return [{ type: "exact value", expected: literal, received: value }];
    }
    return [];
  } as any;
}

export function object<T extends Record<PropertyKey, any>>(shape?: T): T {
  return function validateObject(value: any) {
    if (typeof value !== "object") {
      return [{ type: "type", expected: Object, received: value }];
    }

    if (shape) {
      const missingKeys: string[] = [];
      const issues: ValidationIssue[] = [];
      for (let key in shape) {
        const subIssues = validateType(value[key], shape[key]);
        if (key in value) {
          issues.push(...subIssues);
        } else {
          missingKeys.push(key);
        }
      }
      if (missingKeys.length) {
        issues.push({ type: "missing keys", value, missingKeys });
      }
      return issues;
    }

    return [];
  } as any;
}

export function optional<T>(type: T): T | undefined {
  return function validateOptional(value: any) {
    if (value === undefined) {
      return [];
    }
    return validateType(value, type);
  } as any;
}

export function record<V>(valueType: V): Record<PropertyKey, V> {
  return function validateRecord(value: any) {
    if (typeof value !== "object") {
      return [{ type: "type", expected: Object, received: value }];
    }

    const issues: ValidationIssue[] = [];
    for (let key in value) {
      issues.push(...validateType(value[key], valueType));
    }
    return issues;
  } as any;
}

export function tuple<T extends any[]>(...types: T): T {
  return function validateTuple(value: any) {
    if (!Array.isArray(value)) {
      return [{ type: "type", expected: Array, received: value }];
    }
    if (value.length !== types.length) {
      return [{ type: "length", expected: types.length, received: value.length }];
    }
    return types.flatMap((type, index) => validateType(value[index], type));
  } as any;
}

export function constructor<T extends Constructor>(type: T): T {
  return function validateClass(value: any) {
    if (!(typeof value === "function") || !(value === type || value.prototype instanceof type)) {
      return [{ type: "type" }];
    }
    return [];
  } as any;
}

export function union<T extends any[]>(...types: T): T extends Array<infer E> ? E : never {
  return function validateUnion(value: any) {
    const validations = types.filter((type) => validateType(value, type).length);
    if (validations.length) {
      return [{ type: "union" }];
    }
    return [];
  } as any;
}

export function signal<T>(type: T): Signal<T> {
  return function validateSignal(value: any) {
    if (typeof value !== "function") {
      return [{ type: "type", expected: Function, received: value }];
    }
    if (typeof value.set !== "function") {
      return [{ type: "type", expected: Function, received: value.set }];
    }
    return [];
  } as any;
}

export function reactiveValue<T>(type: T): ReactiveValue<T> {
  return function validateReactiveValue(value: any) {
    if (typeof value !== "function") {
      return [{ type: "type", expected: Function, received: value }];
    }
    return [];
  } as any;
}
