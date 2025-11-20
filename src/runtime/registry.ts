import { reactive } from "./reactivity";
import { derived } from "./signals";
import { Schema, validate } from "./validation";
// to discuss with nby: how to make the registry reactive (with items/entries
// derived value, but without forcing the items themselves to be reactive,
// which is the case right now with this implementation)

type Fn<T> = () => T;

export class Registry<T> {
  _map: { [key: string]: [number, T] } = reactive(Object.create(null));
  _name: string;
  _schema?: Schema;
  items!: Fn<T[]>;
  entries!: Fn<[string, T][]>;

  constructor(name?: string, schema?: Schema) {
    this._name = name || "registry";
    this._schema = schema;

    const entries = derived(() => {
      return Object.entries(this._map)
        .sort((el1, el2) => el1[1][0] - el2[1][0])
        .map(([str, elem]) => [str, elem[1]]);
    });
    const items = derived(() => entries().map((e) => e[1]));

    Object.defineProperty(this, "items", {
      get() {
        return items;
      },
    });
    Object.defineProperty(this, "entries", {
      get() {
        return entries;
      },
    });
  }

  set(key: string, value: T, sequence: number = 50) {
    if (this._schema) {
      validate(value as any, this._schema as any);
    }
    this._map[key] = [sequence, value];
  }

  get(key: string, defaultValue?: T): T {
    const hasKey = key in this._map;
    if (!hasKey && arguments.length < 2) {
      throw new Error(`KeyNotFoundError: Cannot find key "${key}" in this registry`);
    }
    return hasKey ? this._map[key][1] : defaultValue!;
  }
}
