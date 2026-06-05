import {
  assertType,
  getDefault,
  GetDefaultedEntries,
  ResolveObjectType,
  signal,
  Signal,
} from "@odoo/owl-core";
import { getComponentScope } from "./component_node";
import { staticProp } from "./prop";
import { types } from "./types";

declare const isProps: unique symbol;

export type WithDefaults<T, D> = T & Required<D>;
export type Props<T extends {}> = T & { [isProps]: true };

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
  <Shape extends {}>(shape: Shape): Props<
    WithDefaults<ResolveObjectType<Shape>, GetDefaultedEntries<Shape>>
  >;
  static: typeof staticProp;
}

function makeProps(type?: any): Props<{}> {
  const node = getComponentScope();
  const { app, componentName } = node;

  // defaults declared in the schema (.default()). Factories are resolved once
  // per component instance, so the value identity is stable across prop
  // updates of that instance.
  let defaults: Record<string, any> | null = null;
  if (type && !Array.isArray(type)) {
    for (const key in type) {
      const factory = getDefault(type[key]);
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

  if (type) {
    const keys: string[] = Array.isArray(type) ? type : Object.keys(type);
    defineProps(keys);
    node.propsUpdated.push(() => updateSignals(keys));

    if (app.dev) {
      if (defaults) {
        const defaultedShape: Record<string, any> = {};
        for (const key in type) {
          if (key in defaults) {
            defaultedShape[key] = type[key];
          }
        }
        assertType(
          defaults,
          types.object(defaultedShape),
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
