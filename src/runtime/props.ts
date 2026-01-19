import { getCurrent } from "./component_node";
import { GetOptionalEntries, KeyedObject, ResolveOptionalEntries, types } from "./types";
import { assertType } from "./validation";

declare const isProps: unique symbol;
type IsPropsObj = { [isProps]: true };
export type Props<T extends Record<string, any>, D extends Record<string, any>> = IsPropsObj & T & Required<D>;

type GetPropsWithOptionals<T> = T extends Props<infer P, any> ? P : never;
export type GetProps<T> = {
  [K in keyof T]: T[K] extends IsPropsObj ? (x: GetPropsWithOptionals<T[K]>) => void : never;
}[keyof T] extends (x: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

export function props<const P extends string[] = string[], D extends GetOptionalEntries<KeyedObject<P[number]>> = {}>(type?: P, defaults?: D): Props<ResolveOptionalEntries<KeyedObject<P[number]>>, D>;
export function props<P extends Record<string, any> = Record<string, any>, D extends GetOptionalEntries<P> = {}>(type?: P, defaults?: D): Props<ResolveOptionalEntries<P>, D>;
export function props<P extends Record<string, any> = Record<string, any>, D extends GetOptionalEntries<P> = {}>(type?: P, defaults = {} as D): Props<ResolveOptionalEntries<P>, D> {
  const node = getCurrent();

  function getProp(key: string) {
    if (node.props[key] === undefined) {
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
    const isSchemaValidated = type && !Array.isArray(type);
    const keys: string[] = (isSchemaValidated ? Object.keys(type) : type).map((key) =>
      key.endsWith("?") ? key.slice(0, -1) : key
    );
    applyPropGetters(keys);

    if (node.app.dev) {
      const validation = isSchemaValidated ? types.object(type) : types.keys(type);
      assertType(node.props, validation, `Invalid component props (${node.name})`);
      node.willUpdateProps.push((np: Record<string, any>) => {
        assertType(np, validation, `Invalid component props (${node.name})`);
      });
    }
  } else {
    applyPropGetters(Object.keys(node.props));
    node.willUpdateProps.push((np: Record<string, any>) => {
      for (let key in result) {
        Reflect.deleteProperty(result, key);
      }
      applyPropGetters(Object.keys(np));
    });
  }

  return result;
}
