import { derived } from "./reactivity/derived";
import { signal, Signal } from "./reactivity/signal";
import { TypeDescription, validateType } from "./validation";

export class Registry<T> {
  _map: Signal<{ [key: string]: [number, T] }> = signal(Object.create(null));
  _name: string;
  _type?: TypeDescription;

  constructor(name?: string, type?: TypeDescription) {
    this._name = name || "registry";
    this._type = type;
  }

  entries = derived(() => {
    const entries: [string, T][] = Object.entries(this._map())
      .sort((el1, el2) => el1[1][0] - el2[1][0])
      .map(([str, elem]) => [str, elem[1]]);
    return entries;
  });

  items = derived(() => this.entries().map((e) => e[1]));

  addById<U extends { id: string } & T>(item: U, sequence: number = 50): Registry<T> {
    if (!item.id) {
      throw new Error(`Item should have an id key`);
    }
    return this.add(item.id, item, sequence);
  }

  add(key: string, value: T, sequence: number = 50): Registry<T> {
    if (this._type) {
      const error = validateType(key, value as any, this._type as any);
      // todo: move error handling in validation.js
      if (error) {
        throw new Error("Invalid type: " + error);
      }
    }
    this._map()[key] = [sequence, value];
    this._map.update();
    return this;
  }

  get(key: string, defaultValue?: T): T {
    const hasKey = key in this._map();
    if (!hasKey && arguments.length < 2) {
      throw new Error(`KeyNotFoundError: Cannot find key "${key}" in this registry`);
    }
    return hasKey ? this._map()[key][1] : defaultValue!;
  }

  remove(key: string) {
    delete this._map()[key];
    this._map.update();
  }
}
