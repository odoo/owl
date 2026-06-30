import {
  assertType,
  getDefault,
  getShape,
  GetDefaultedKeys,
  ResolveObjectType,
  ResolveReaderObjectType,
  signal,
  Signal,
  Type,
} from "@odoo/owl-core";
import { getComponentScope } from "./component_node";
import { staticProp } from "./prop";
import { types } from "./types";

export declare const isProps: unique symbol;

// The brand stores the defaulted key names: those keys are required for the
// component reading the props (the default fills them), but may be omitted by
// the parent providing them. The props type itself is the flat reader view,
// so editors display it expanded.
export type Props<T extends {}> = T & { [isProps]: never };
export type PropsWithDefaults<T extends {}, DK extends PropertyKey> = T & { [isProps]: DK };

// Recovers the parent view from the branded reader view: keys with a default
// become optional again.
type GetPropsWithOptionals<T> = T extends { [isProps]: infer DK extends PropertyKey }
  ? Omit<T, typeof isProps | (DK & keyof T)> & Partial<Pick<T, DK & keyof T>>
  : never;
export type GetProps<T> = {
  [K in keyof T]: T[K] extends { [isProps]: PropertyKey }
    ? (x: GetPropsWithOptionals<T[K]>) => void
    : never;
}[keyof T] extends (x: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

type ResolveProps<Shape> = [GetDefaultedKeys<Shape>] extends [never]
  ? Props<ResolveReaderObjectType<Shape>>
  : PropsWithDefaults<ResolveReaderObjectType<Shape>, GetDefaultedKeys<Shape> & PropertyKey>;

export interface PropsFunction {
  (): Props<Record<string, any>>;
  <const Keys extends string[]>(keys: Keys): Props<ResolveObjectType<Keys>>;
  // A schema given as a type validator (`t.object(...)`, `t.and(...)`, ...),
  // so a reusable/composed schema can drive the props. The reader view is the
  // type carried by the validator; keys with a schema default appear optional
  // here even though the default fills them (the default/optional distinction
  // is erased once a schema is built into a `Type`).
  <S extends {}>(schema: Type<S>): Props<S>;
  <Shape extends {}>(shape: Shape): ResolveProps<Shape>;
  static: typeof staticProp;
}

function makeProps(type?: any): Props<{}> {
  const node = getComponentScope();
  const { app, componentName } = node;

  // A schema may be given as a type validator (`t.object(...)`, `t.and(...)`):
  // its key → type map lives under a private shape, recovered with `getShape`,
  // so it drives defaults and declared keys like a plain shape object does.
  // The validator is then used as-is for validation. A shapeless validator
  // (e.g. `t.record`) still validates, but its keys come from the props.
  const isValidator = typeof type === "function";
  const shape: Record<string, any> | undefined = isValidator
    ? getShape(type)
    : type && !Array.isArray(type)
      ? type
      : undefined;
  // Keys known ahead of time, or undefined when they must be read from the
  // props (no schema, or a shapeless validator).
  const staticKeys: string[] | undefined = Array.isArray(type)
    ? type
    : shape
      ? Object.keys(shape)
      : undefined;

  // defaults declared in the schema (.optional(value)). Factories are resolved once
  // per component instance, so the value identity is stable across prop
  // updates of that instance.
  let defaults: Record<string, any> | null = null;
  if (shape) {
    for (const key in shape) {
      const factory = getDefault(shape[key]);
      if (factory) {
        (defaults ||= {})[key] = factory();
      }
    }
  }
  if (defaults) {
    node.defaultProps = Object.assign(node.defaultProps || {}, defaults);
  }

  function resolveValue(props: Record<string, any>, key: string) {
    if (props[key] === undefined && defaults && key in defaults) {
      return defaults[key];
    }
    return props[key];
  }

  const signals: Record<string, Signal<any>> = Object.create(null);
  const result = Object.create(null);
  function defineProp(key: string) {
    signals[key] = signal(resolveValue(node.props, key));
    Reflect.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      get: signals[key],
    });
  }

  function defineProps(keys: string[]) {
    for (const key of keys) {
      defineProp(key);
    }
  }

  function updateSignals(keys: string[]) {
    for (const key of keys) {
      signals[key].set(resolveValue(node.props, key));
    }
  }

  if (app.dev && type) {
    if (defaults) {
      const defaultedShape: Record<string, any> = {};
      for (const key in defaults) {
        defaultedShape[key] = shape![key];
      }
      assertType(
        defaults,
        types.object(defaultedShape),
        `Invalid component default props (${componentName})`
      );
    }

    // A validator schema is its own validation; a plain shape/array is wrapped.
    const validation = isValidator ? type : types.object(type);
    assertType(node.props, validation, `Invalid component props (${componentName})`);
    node.willUpdateProps.push((np: Record<string, any>) => {
      assertType(np, validation, `Invalid component props (${componentName})`);
    });
  }

  if (staticKeys) {
    defineProps(staticKeys);
    node.propsUpdated.push(() => updateSignals(staticKeys));
  } else {
    const getKeys = (props: Record<string, any>) => {
      const keys: string[] = [];
      for (const k in props) {
        if (k.charCodeAt(0) !== 1) {
          keys.push(k);
        }
      }
      return keys;
    };

    let keys = getKeys(node.props);
    defineProps(keys);
    node.propsUpdated.push(() => {
      const nextKeys = getKeys(node.props);
      const nextKeySet = new Set(nextKeys);
      for (const key of keys) {
        if (!nextKeySet.has(key)) {
          Reflect.deleteProperty(result, key);
          delete signals[key];
        }
      }
      for (const key of nextKeys) {
        if (!(key in signals)) {
          defineProp(key);
        }
      }
      updateSignals(nextKeys);
      keys = nextKeys;
    });
  }

  return result;
}

export const props = Object.assign(makeProps, { static: staticProp }) as PropsFunction;
