import { derived, Signal, signal } from "./signals";
import { TypeDescription, validateType } from "./validation";

type Fn<T> = () => T;

export class Registry<T> {
  _map: Signal<{ [key: string]: [number, T] }> = signal(Object.create(null));
  _name: string;
  _type?: TypeDescription;

  constructor(name?: string, type?: TypeDescription) {
    this._name = name || "registry";
    this._type = type;
  }

  entries: Fn<[string, T][]> = derived(() => {
    return Object.entries(this._map.get())
      .sort((el1, el2) => el1[1][0] - el2[1][0])
      .map(([str, elem]) => [str, elem[1]]);
  });
  items: Fn<T[]> = derived(() => this.entries().map((e) => e[1]));

  addById<U extends { id: string } & T>(item: U, sequence: number = 50) {
    if (!item.id) {
      throw new Error(`Item should have an id key`);
    }
    return this.set(item.id, item, sequence);
  }

  set(key: string, value: T, sequence: number = 50) {
    if (this._type) {
      const error = validateType(key, value as any, this._type as any);
      // todo: move error handling in validation.js
      if (error) {
        throw new Error("Invalid type: " + error);
      }
    }
    this._map.set({ ...this._map.get(), [key]: [sequence, value] });
  }

  get(key: string, defaultValue?: T): T {
    const hasKey = key in this._map.get();
    if (!hasKey && arguments.length < 2) {
      throw new Error(`KeyNotFoundError: Cannot find key "${key}" in this registry`);
    }
    return hasKey ? this._map.get()[key][1] : defaultValue!;
  }
}
