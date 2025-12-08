import { OwlError } from "../common/owl_error";
import { getCurrent } from "./component_node";
import { validateSchema } from "./validation";

type ConstructorTypedPropsValidation<T = any> = new (...args: any[]) => T;

type UnionTypedPropsValidation = ReadonlyArray<TypedPropsValidation>;

interface SchemaTypedPropsValidation<O extends boolean = boolean> {
  optional?: O;
  validate?(value: any): boolean;
}

interface TypeSchemaTypedPropsValidation<T = any, O extends boolean = boolean>
  extends SchemaTypedPropsValidation<O> {
  type: new (...args: any[]) => T;
}

interface MapSchemaTypedPropsValidation<O extends boolean = boolean>
  extends TypeSchemaTypedPropsValidation<ObjectConstructor, O> {
  shape: PropsValidation;
}

interface RecordSchemaTypedPropsValidation<O extends boolean = boolean>
  extends TypeSchemaTypedPropsValidation<ObjectConstructor, O> {
  values: TypedPropsValidation;
}

interface ArraySchemaTypedPropsValidation<O extends boolean = boolean>
  extends TypeSchemaTypedPropsValidation<ArrayConstructor, O> {
  element: TypedPropsValidation;
}

type ValueTypedPropsValidation<T = any> = {
  value: T;
};

type TypedPropsValidation =
  | true
  | ConstructorTypedPropsValidation
  | UnionTypedPropsValidation
  | SchemaTypedPropsValidation
  | TypeSchemaTypedPropsValidation
  | MapSchemaTypedPropsValidation
  | RecordSchemaTypedPropsValidation
  | ArraySchemaTypedPropsValidation
  | ValueTypedPropsValidation;

export type RecordPropsValidation = Record<string, TypedPropsValidation>;

export type KeysPropsValidation = readonly string[];

export type PropsValidation = RecordPropsValidation | KeysPropsValidation;

//-----------------------------------------------------------------------------

type Optional<T, O> = O extends true ? T | undefined : T;

type ConvertConstructorTypedPropsValidation<V extends ConstructorTypedPropsValidation> =
  V extends ConstructorTypedPropsValidation<infer I> ? I : never;

type ConvertUnionTypedPropsValidation<V extends UnionTypedPropsValidation> = V[number];

type ConvertMapSchemaTypedPropsValidation<V extends MapSchemaTypedPropsValidation> =
  V extends MapSchemaTypedPropsValidation<infer O>
    ? Optional<ConvertPropsValidation<V["shape"]>, O>
    : never;

type ConvertRecordSchemaTypedPropsValidation<V extends RecordSchemaTypedPropsValidation> =
  V extends RecordSchemaTypedPropsValidation<infer O>
    ? Optional<{ [K: string]: ConvertTypedPropsValidation<V["values"]> }, O>
    : never;

type ConvertArraySchemaTypedPropsValidation<V extends ArraySchemaTypedPropsValidation> =
  V extends ArraySchemaTypedPropsValidation<infer O>
    ? Optional<ConvertTypedPropsValidation<V["element"]>[], O>
    : never;

type ConvertTypeSchemaTypedPropsValidation<V extends TypeSchemaTypedPropsValidation> =
  V extends TypeSchemaTypedPropsValidation<infer I, infer O> ? Optional<I, O> : never;

type ConvertSchemaTypedPropsValidation<V extends SchemaTypedPropsValidation> =
  V extends SchemaTypedPropsValidation ? any : never;

type ConvertValueTypedPropsValidation<V extends ValueTypedPropsValidation> =
  V extends ValueTypedPropsValidation<infer T> ? T : never;

type ConvertTypedPropsValidation<V extends TypedPropsValidation> = V extends true
  ? any
  : V extends ConstructorTypedPropsValidation
  ? ConvertConstructorTypedPropsValidation<V>
  : V extends UnionTypedPropsValidation
  ? ConvertUnionTypedPropsValidation<V>
  : V extends MapSchemaTypedPropsValidation
  ? ConvertMapSchemaTypedPropsValidation<V>
  : V extends RecordSchemaTypedPropsValidation
  ? ConvertRecordSchemaTypedPropsValidation<V>
  : V extends ArraySchemaTypedPropsValidation
  ? ConvertArraySchemaTypedPropsValidation<V>
  : V extends TypeSchemaTypedPropsValidation
  ? ConvertTypeSchemaTypedPropsValidation<V>
  : V extends SchemaTypedPropsValidation
  ? ConvertSchemaTypedPropsValidation<V>
  : V extends ValueTypedPropsValidation
  ? ConvertValueTypedPropsValidation<V>
  : never;

type ConvertRecordPropsValidation<V extends RecordPropsValidation> = {
  [K in keyof V]: ConvertTypedPropsValidation<V[K]>;
};

type ConvertKeysPropsValidation<V extends KeysPropsValidation> = { [K in V[number]]: any };

type ConvertPropsValidation<V extends PropsValidation> = V extends KeysPropsValidation
  ? ConvertKeysPropsValidation<V>
  : V extends RecordPropsValidation
  ? ConvertRecordPropsValidation<V>
  : never;

//-----------------------------------------------------------------------------

type Props<T extends Record<string, any>, V extends PropsValidation> = T &
  ConvertPropsValidation<V>;

export function props<T extends Record<string, any>, V extends PropsValidation = PropsValidation>(
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
