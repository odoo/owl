import { OwlError } from "../common/owl_error";
import type { Component } from "./component";
import { getCurrent } from "./component_node";
import { validateSchema } from "./validation";

type ConstructorTypedPropsValidation<T = any> = new (...args: any) => T;

type UnionTypedPropsValidation = ReadonlyArray<TypedPropsValidation>;

type OptionalSchemaTypedPropsValidation<O extends boolean> = {
  optional: O;
};

type DefaultValuedSchemaTypedPropsValidation<T> = {
  defaultValue: T;
};

type ValidableSchemaTypedPropsValidation = {
  validate(value: any): boolean;
};

type TypeSchemaTypedPropsValidation<T> = {
  type: new (...args: any) => T;
};

type MapSchemaTypedPropsValidation = {
  type: ObjectConstructor;
  shape: PropsValidation;
};

type RecordSchemaTypedPropsValidation = {
  type: ObjectConstructor;
  values: TypedPropsValidation;
};

type ArraySchemaTypedPropsValidation = {
  type: ArrayConstructor;
  element: TypedPropsValidation;
};

type SchemaTypedPropsValidation<T, O extends boolean> = {
  type?: new (...args: any) => T;
  optional?: O;
  defaultValue?: T;
  validate?(value: T): boolean;
  shape?: PropsValidation;
  values?: TypedPropsValidation;
  element?: TypedPropsValidation;
};

type ValueTypedPropsValidation<T = any> = {
  value: T;
};

type TypedPropsValidation =
  | true
  | ConstructorTypedPropsValidation
  | UnionTypedPropsValidation
  | SchemaTypedPropsValidation<any, boolean>
  | ValueTypedPropsValidation;

export type RecordPropsValidation = Record<string, TypedPropsValidation>;
export type KeysPropsValidation = readonly string[];

export type PropsValidation = RecordPropsValidation | KeysPropsValidation;

//-----------------------------------------------------------------------------

type ConvertTypedPropsValidation<V extends TypedPropsValidation> = V extends true
  ? any
  : V extends ConstructorTypedPropsValidation<infer I>
  ? I
  : V extends UnionTypedPropsValidation
  ? V[number]
  : V extends MapSchemaTypedPropsValidation
  ? ConvertPropsValidation<V["shape"]>
  : V extends RecordSchemaTypedPropsValidation
  ? Record<string, ConvertTypedPropsValidation<V["values"]>>
  : V extends ArraySchemaTypedPropsValidation
  ? ConvertTypedPropsValidation<V["element"]>[]
  : V extends TypeSchemaTypedPropsValidation<infer I>
  ? I
  : V extends ValueTypedPropsValidation<infer T>
  ? T
  : V extends DefaultValuedSchemaTypedPropsValidation<infer T>
  ? T
  : V extends OptionalSchemaTypedPropsValidation<boolean>
  ? any
  : V extends ValidableSchemaTypedPropsValidation
  ? any
  : never;

type ConvertPropsValidation<V extends PropsValidation> = V extends KeysPropsValidation
  ? { [K in V[number] as K extends `${infer N}?` ? N : never]?: any } & {
      [K in V[number] as K extends `${string}?` ? never : K]: any;
    }
  : V extends RecordPropsValidation
  ? {
      [K in keyof V as V[K] extends OptionalSchemaTypedPropsValidation<true>
        ? K
        : never]?: ConvertTypedPropsValidation<V[K]>;
    } & {
      [K in keyof V as V[K] extends OptionalSchemaTypedPropsValidation<true>
        ? never
        : K]: ConvertTypedPropsValidation<V[K]>;
    }
  : never;

//-----------------------------------------------------------------------------

declare const isProps: unique symbol;
type IsPropsObj = { [isProps]: true };
export type Props<T, V extends PropsValidation> = IsPropsObj &
  (unknown extends T ? ConvertPropsValidation<V> : T);

export type GetProps<T extends Component> = {
  [K in keyof T]: T[K] extends IsPropsObj ? (x: Omit<T[K], typeof isProps>) => void : never;
}[keyof T] extends (x: infer I) => void
  ? { [K in keyof I]: I[K] }
  : never;

export function validateProps(
  componentName: string,
  props: Record<string, any>,
  validation: PropsValidation,
  keys: string[]
) {
  const propsToValidate = Object.create(null);
  const errors: string[] = [];
  for (const key of keys) {
    if (key in props) {
      propsToValidate[key] = props[key];
    }
    if (
      propsToValidate[key] === undefined &&
      !Array.isArray(validation) &&
      (validation as any)[key].defaultValue !== undefined
    ) {
      if (!(validation as any)[key].optional) {
        errors.push(`A default value cannot be defined for the mandatory prop '${key}'`);
        continue;
      }
      propsToValidate[key] = (validation as any)[key].defaultValue;
    }
  }
  errors.push(...validateSchema(propsToValidate, validation as any));
  if (errors.length) {
    throw new OwlError(`Invalid props for component '${componentName}': ` + errors.join(", "));
    // node.app.handleError({
    //   error: new OwlError(`Invalid props for component '${componentName}': ` + errors.join(", ")),
    //   node,
    // });
  }
}

export function props<T = unknown, V extends PropsValidation = PropsValidation>(
  validation?: V
): Props<T, V> {
  const node = getCurrent();
  const isSchemaValidated = validation && !Array.isArray(validation);

  function getProp(key: string) {
    if (isSchemaValidated && node.props[key] === undefined) {
      return (validation as any)[key].defaultValue;
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

  if (validation) {
    const keys: string[] = (isSchemaValidated ? Object.keys(validation) : validation).map((key) =>
      key.endsWith("?") ? key.slice(0, -1) : key
    );
    applyPropGetters(keys);

    if (node.app.dev) {
      validateProps(node.name, node.props, validation, keys);
      node.willUpdateProps.push((np: Record<string, any>) => {
        validateProps(node.name, np, validation, keys);
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
