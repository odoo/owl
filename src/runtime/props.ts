import { OwlError } from "../common/owl_error";
import type { Component } from "./component";
import { getCurrent } from "./component_node";
import { validateSchema } from "./validation";

type ConstructorTypedPropsValidation<T = any> = new (...args: any) => T;

type UnionTypedPropsValidation = ReadonlyArray<TypedPropsValidation>;

type OptionalSchemaTypedPropsValidation<O extends boolean> = {
  optional: O;
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

export function props<T = unknown, V extends PropsValidation = PropsValidation>(
  validation?: V
): Props<T, V> {
  const node = getCurrent();

  const result = Object.create(null);
  const definePropGetters = (keys: string[]) => {
    for (let key in result) {
      Reflect.deleteProperty(result, key);
    }
    for (const key of keys) {
      Reflect.defineProperty(result, key, {
        enumerable: true,
        get() {
          return node.props[key];
        },
      });
    }
  };

  if (validation) {
    const keys = Array.isArray(validation) ? validation : Object.keys(validation);
    definePropGetters(keys.map((key) => key.replace(/(.+)\?/, "$1")));

    if (node.app.dev) {
      const validate = (props: Record<string, any>) => {
        const propsToValidate = Object.create(null);
        for (const key of keys) {
          if (key in props) {
            propsToValidate[key] = props[key];
          }
        }
        const errors = validateSchema(propsToValidate, validation as any);
        if (errors.length) {
          throw new OwlError(`Invalid props for component '${node.name}': ` + errors.join(", "));
          // node.app.handleError({
          //   error: new OwlError(`Invalid props for component '${node.name}': ` + errors.join(", ")),
          //   node,
          // });
        }
      };
      validate(node.props);
      node.willUpdateProps.push((np: Record<string, any>) => {
        validate(np);
      });
    }
  } else {
    definePropGetters(Object.keys(node.props));
    node.willUpdateProps.push((np: Record<string, any>) => {
      definePropGetters(Object.keys(np));
    });
  }

  return result as any;
}
