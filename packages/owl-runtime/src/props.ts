import {
  assertType,
  GetOptionalEntries,
  KeyedObject,
  PrettifyShape,
  ResolveObjectType,
  signal,
  Signal,
} from "@odoo/owl-core";
import { getComponentScope } from "./component_node";
import { staticProp } from "./prop";
import { types } from "./types";

function validateDefaults(schema: Record<string, any> | string[]) {
  const validation: Record<string, any> = {};
  if (Array.isArray(schema)) {
    for (const key of schema) {
      if (key.endsWith("?")) {
        validation[key] = types.any();
      }
    }
  } else {
    for (const key in schema) {
      if (key.endsWith("?")) {
        validation[key] = schema[key];
      }
    }
  }
  return types.strictObject(validation);
}

declare const isProps: unique symbol;

export type WithDefaults<T, D> = T & Required<D>;
export type Props<T extends {}> = T & { [isProps]: true };
type GetPropsDefaults<T extends object> = PrettifyShape<GetOptionalEntries<T>>;

type GetPropsWithOptionals<T> =
  T extends Props<infer P> ? (P extends WithDefaults<infer R, any> ? R : P) : never;
export type GetProps<T> = {
  [K in keyof T]: T[K] extends { [isProps]: true }
    ? (x: GetPropsWithOptionals<T[K]>) => void
    : never;
}[keyof T] extends (x: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

export interface PropsFunction {
  (): Props<Record<string, any>>;
  <const Keys extends string[]>(keys: Keys): Props<ResolveObjectType<Keys>>;
  <const Keys extends string[], Defaults>(
    keys: Keys,
    defaults: Defaults & GetPropsDefaults<KeyedObject<Keys>>
  ): Props<WithDefaults<ResolveObjectType<Keys>, Defaults>>;
  <Shape extends {}>(shape: Shape): Props<ResolveObjectType<Shape>>;
  <Shape extends {}, Defaults>(
    shape: Shape,
    defaults: Defaults & GetPropsDefaults<Shape>
  ): Props<WithDefaults<ResolveObjectType<Shape>, Defaults>>;
  static: typeof staticProp;
}

function makeProps(type?: any, defaults?: any): Props<{}> {
  const node = getComponentScope();
  const { app, componentName } = node;
  if (defaults) {
    node.defaultProps = Object.assign(node.defaultProps || {}, defaults);
  }

  function resolveValue(props: Record<string, any>, key: string) {
    if (props[key] === undefined && defaults) {
      return (defaults as any)[key];
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

  if (type) {
    const keys: string[] = (Array.isArray(type) ? type : Object.keys(type)).map((key: string) =>
      key.endsWith("?") ? key.slice(0, -1) : key
    );
    defineProps(keys);
    node.propsUpdated.push(() => updateSignals(keys));

    if (app.dev) {
      if (defaults) {
        assertType(
          defaults,
          validateDefaults(type),
          `Invalid component default props (${componentName})`
        );
      }

      const validation = types.object(type);
      assertType(node.props, validation, `Invalid component props (${componentName})`);
      node.willUpdateProps.push((np: Record<string, any>) => {
        assertType(np, validation, `Invalid component props (${componentName})`);
      });
    }
  } else {
    const getKeys = (props: Record<string, any>) => {
      const keys: string[] = [];
      for (const k in props) {
        if (k.charCodeAt(0) !== 1) {
          keys.push(k);
        }
      }
      if (defaults) {
        for (const k in defaults) {
          if (!(k in props)) {
            keys.push(k);
          }
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
