import { OwlError } from "../common/owl_error";
import { computed } from "./reactivity/computed";
import { signal } from "./reactivity/signal";
import { TypeDescription, validateType } from "./validation";

interface RegistryOptions {
  name?: string;
  validation?: TypeDescription;
}

export class Registry<T> {
  private _map = signal.Object<Record<string, [number, T]>>(Object.create(null));
  private _name: string;
  private _validation?: TypeDescription;

  constructor(options: RegistryOptions = {}) {
    this._name = options.name || "registry";
    this._validation = options.validation;
  }

  entries = computed(() => {
    const entries: [string, T][] = Object.entries(this._map())
      .sort((el1, el2) => el1[1][0] - el2[1][0])
      .map(([str, elem]) => [str, elem[1]]);
    return entries;
  });

  items = computed(() => this.entries().map((e) => e[1]));

  addById<U extends { id: string } & T>(item: U, sequence: number = 50): Registry<T> {
    if (!item.id) {
      throw new OwlError(`Item should have an id key (registry '${this._name}')`);
    }
    return this.add(item.id, item, sequence);
  }

  add(key: string, value: T, sequence: number = 50): Registry<T> {
    if (this._validation) {
      const error = validateType(key, value, this._validation);
      // todo: move error handling in validation.js
      if (error) {
        throw new Error("Invalid type: " + error);
      }
    }
    this._map()[key] = [sequence, value];
    return this;
  }

  get(key: string, defaultValue?: T): T {
    const hasKey = key in this._map();
    if (!hasKey && arguments.length < 2) {
      throw new Error(`KeyNotFoundError: Cannot find key "${key}" (registry '${this._name}')`);
    }
    return hasKey ? this._map()[key][1] : defaultValue!;
  }

  remove(key: string) {
    delete this._map()[key];
  }

  has(key: string): boolean {
    return key in this._map();
  }
}
