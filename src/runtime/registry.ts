import { reactive } from "./reactivity";
import { derived } from "./signals";
import { TypeDescription, validateType } from "./validation";
// to discuss with nby: how to make the registry reactive (with items/entries
// derived value, but without forcing the items themselves to be reactive,
// which is the case right now with this implementation)

type Fn<T> = () => T;

export class Registry<T> {
  _map: { [key: string]: [number, T] } = reactive(Object.create(null));
  _name: string;
  _type?: TypeDescription;
  items!: Fn<T[]>;
  entries!: Fn<[string, T][]>;

  constructor(name?: string, type?: TypeDescription) {
    this._name = name || "registry";
    this._type = type;

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
    if (this._type) {
      const error = validateType(key, value as any, this._type as any);
      // todo: move error handling in validation.js
      if (error) {
        throw new Error("Invalid type: " + error);
      }
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
