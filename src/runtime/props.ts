import { getCurrent } from "./component_node";
import { keys as validateKeys, object } from "./types";
import { assertType } from "./validation";

export type Props = Record<string, any> | string[];

declare const isProps: unique symbol;
type IsPropsObj = { [isProps]: true };
export type AsProps<T extends Props, D extends Props> = IsPropsObj & T & Required<D>;

type GetPropsWithOptionals<T> = T extends AsProps<infer P, infer D> ? Partial<D> & Omit<P, keyof D> : never;
export type GetProps<T> = {
  [K in keyof T]: T[K] extends IsPropsObj ? (x: GetPropsWithOptionals<T[K]>) => void : never;
}[keyof T] extends (x: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

export type OptionalProps<T extends Props> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: NonNullable<T[K]>;
};

export function props<P extends Props = any, D extends OptionalProps<P> = any>(type?: P, defaults: D = {} as D): AsProps<P, D> {
  const node = getCurrent();

  const result = Object.create(null);
  function applyProps(keys: string[]) {
    for (const key of keys) {
      result[key] = (node.props === undefined) ? (defaults as any)[key] : node.props[key];
    }
  }

  if (type) {
    const isSchemaValidated = type && !Array.isArray(type);
    const keys: string[] = (isSchemaValidated ? Object.keys(type) : type).map((key) =>
      key.endsWith("?") ? key.slice(0, -1) : key
    );
    applyProps(keys);

    if (node.app.dev) {
      const validation = isSchemaValidated ? object(type) : validateKeys(...type);
      assertType(node.props, validation);
    }
  } else {
    applyProps(Object.keys(node.props));
  }

  return result;
}
