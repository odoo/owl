import {
  assertType,
  getDefault,
  GetDefaultedKeys,
  ResolveObjectType,
  ResolveReaderObjectType,
  signal,
  Signal,
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
  <Shape extends {}>(shape: Shape): ResolveProps<Shape>;
  static: typeof staticProp;
}

type Captures = Record<string, Record<string, any>>;

// for each variable captured by an inline arrow function, the compiler emits a
// companion `\x01<prop>.<var>` prop holding its value. Group them by prop name.
function collectCaptures(props: Record<string, any>): Captures | null {
  let captures: Captures | null = null;
  for (const key in props) {
    if (key.charCodeAt(0) !== 1) {
      continue;
    }
    captures ||= Object.create(null) as Captures;
    const name = key.slice(1, key.indexOf("."));
    const propCaptures = (captures[name] ||= Object.create(null));
    propCaptures[key] = props[key];
  }
  return captures;
}

function makeProps(type?: any): Props<{}> {
  const node = getComponentScope();
  const { app, componentName } = node;

  // defaults declared in the schema (.optional(value)). Factories are resolved once
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

  // node.props is replaced as a whole before the propsUpdated hooks run, so by
  // the time we get to compare, the previous captures are already gone.
  const alikeProps = node.alikeProps;
  let captures = alikeProps ? collectCaptures(node.props) : null;

  // an alike prop is a new function on every render, but it does the same thing
  // unless one of the values it captured changed. `.alike` and `.bind` capture
  // nothing, so they always compare equal.
  function hasSameCaptures(key: string, nextCaptures: Captures | null) {
    const previous = captures?.[key];
    const next = nextCaptures?.[key];
    if (!previous || !next) {
      return !previous && !next;
    }
    for (const capture in next) {
      if (previous[capture] !== next[capture]) {
        return false;
      }
    }
    return true;
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
    const nextCaptures = alikeProps ? collectCaptures(node.props) : null;
    for (const key of keys) {
      if (alikeProps?.has(key) && hasSameCaptures(key, nextCaptures)) {
        continue;
      }
      signals[key].set(resolveValue(node.props, key));
    }
    captures = nextCaptures;
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

export const useProps = Object.assign(makeProps, { static: staticProp }) as PropsFunction;

/** @deprecated alias for {@link useProps} */
export const props = useProps;
