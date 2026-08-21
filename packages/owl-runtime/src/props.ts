import {
  assertType,
  atomSymbol,
  computed,
  getDefault,
  GetDefaultedKeys,
  getSignalType,
  isStaticType,
  OwlError,
  ResolveObjectType,
  ResolveReaderObjectType,
  signal,
  Signal,
  SignalTypeMeta,
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

  function isReactiveValue(value: any): boolean {
    return typeof value === "function" && !!value[atomSymbol];
  }

  function defineValueProp(key: string, value: any) {
    Reflect.defineProperty(result, key, { enumerable: true, configurable: true, value });
  }

  function guardStaticProp(key: string, initial: any, message: string) {
    if (!app.dev) {
      return;
    }
    node.willUpdateProps.push((nextProps: Record<string, any>) => {
      if (resolveValue(nextProps, key) !== initial) {
        throw new OwlError(`Prop '${key}' in component '${componentName}' ${message}`);
      }
    });
  }

  function defineSignalProp(key: string, meta: SignalTypeMeta) {
    const raw = resolveValue(node.props, key);
    if (isReactiveValue(raw)) {
      defineValueProp(key, meta.settable || !raw.set ? raw : computed(raw));
      guardStaticProp(
        key,
        raw,
        "changed. A signal prop is static: pass the same signal (its inner value may change)."
      );
    } else if (meta.settable) {
      defineValueProp(key, raw);
    } else {
      const promoted = signal(raw);
      defineValueProp(key, computed(promoted));
      promotedUpdates.push(() => promoted.set(resolveValue(node.props, key)));
      if (app.dev) {
        node.willUpdateProps.push((nextProps: Record<string, any>) => {
          if (isReactiveValue(resolveValue(nextProps, key))) {
            throw new OwlError(
              `Prop '${key}' in component '${componentName}' changed from a plain value ` +
                `to a signal. Pass the signal from the start instead.`
            );
          }
        });
      }
    }
  }

  function defineStaticProp(key: string) {
    const value = resolveValue(node.props, key);
    defineValueProp(key, value);
    guardStaticProp(
      key,
      value,
      "changed. A static prop should not change. If the prop is a signal, pass the same " +
        "signal reference (its inner value may change)."
    );
  }

  const promotedUpdates: (() => void)[] = [];

  if (type) {
    const keys: string[] = Array.isArray(type) ? type : Object.keys(type);
    const reactiveKeys: string[] = [];
    for (const key of keys) {
      const keyType = Array.isArray(type) ? undefined : type[key];
      const signalMeta = keyType && getSignalType(keyType);
      if (signalMeta) {
        defineSignalProp(key, signalMeta);
      } else if (keyType && isStaticType(keyType)) {
        defineStaticProp(key);
      } else {
        defineProp(key);
        reactiveKeys.push(key);
      }
    }
    node.propsUpdated.push(() => {
      updateSignals(reactiveKeys);
      for (const update of promotedUpdates) {
        update();
      }
    });

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
