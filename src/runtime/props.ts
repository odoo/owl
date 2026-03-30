import { getContext } from "./context";
import { GetOptionalEntries, KeyedObject, PrettifyShape, ResolveObjectType, types } from "./types";
import { assertType, ValidationContext } from "./validation";

function validateObjectWithDefaults(
  schema: Record<string, any> | string[],
  defaultValues: Record<string, any>
) {
  const keys: string[] = Array.isArray(schema) ? schema : Object.keys(schema);
  const mandatoryDefaultedKeys = keys.filter((key) => !key.endsWith("?") && key in defaultValues);
  return (context: ValidationContext) => {
    if (mandatoryDefaultedKeys.length) {
      context.addIssue({
        message: "props have default values on mandatory keys",
        keys: mandatoryDefaultedKeys,
      });
    }
    context.validate(types.object(schema));
  };
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

export function props(): Props<Record<string, any>>;
export function props<const Keys extends string[]>(keys: Keys): Props<ResolveObjectType<Keys>>;
export function props<const Keys extends string[], Defaults>(
  keys: Keys,
  defaults: Defaults & GetPropsDefaults<KeyedObject<Keys>>
): Props<WithDefaults<ResolveObjectType<Keys>, Defaults>>;
export function props<Shape extends {}>(shape: Shape): Props<ResolveObjectType<Shape>>;
export function props<Shape extends {}, Defaults>(
  shape: Shape,
  defaults: Defaults & GetPropsDefaults<Shape>
): Props<WithDefaults<ResolveObjectType<Shape>, Defaults>>;
export function props(type?: any, defaults?: any): Props<{}> {
  const { node, app, componentName } = getContext("component");
  Object.assign(node.defaultProps, defaults);

  function getProp(key: string) {
    if (node.props[key] === undefined && defaults) {
      return (defaults as any)[key];
    }
    return node.props[key];
  }

  const result = Object.create(null);
  function applyPropGetters(keys: string[]) {
    for (const key of keys) {
      Reflect.defineProperty(result, key, {
        enumerable: true,
        get: getProp.bind(null, key),
      });
    }
  }

  if (type) {
    const keys: string[] = (Array.isArray(type) ? type : Object.keys(type)).map((key: string) =>
      key.endsWith("?") ? key.slice(0, -1) : key
    );
    applyPropGetters(keys);

    if (app.dev) {
      const validation = defaults ? validateObjectWithDefaults(type, defaults) : types.object(type);
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
    applyPropGetters(keys);
    node.willUpdateProps.push((np: any) => {
      for (const key of keys) {
        Reflect.deleteProperty(result, key);
      }
      keys = getKeys(np);
      applyPropGetters(keys);
    });
  }

  return result;
}
