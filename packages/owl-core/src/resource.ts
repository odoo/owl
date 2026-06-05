import { computed } from "./computed";
import { type ReactiveValue } from "./computations";
import { signal } from "./signal";
import { useScope } from "./scope";
import { type StripBrands } from "./types";
import { assertType } from "./validation";

interface ResourceOptions<T> {
  name?: string;
  validation?: T;
}

export interface ResourceAddOptions {
  sequence?: number;
}

// T is the validation type; items carry the value type it describes.
type Item<T> = StripBrands<T>;

export class Resource<T> {
  private _items = signal.Array<[number, Item<T>]>([]);
  private _name?: string;
  private _validation?: T;

  constructor(options: ResourceOptions<T> = {}) {
    this._name = options.name;
    this._validation = options.validation;
  }

  items: ReactiveValue<Item<T>[]> = computed(() => {
    return this._items()
      .sort((el1, el2) => el1[0] - el2[0])
      .map((elem) => elem[1]);
  });

  add(item: Item<T>, options: ResourceAddOptions = {}): Resource<T> {
    if (this._validation) {
      const info = this._name ? ` (resource '${this._name}')` : "";
      assertType(item, this._validation, `Resource item does not match the type${info}`);
    }
    this._items().push([options.sequence ?? 50, item]);
    return this;
  }

  delete(item: Item<T>): Resource<T> {
    const items = this._items().filter(([seq, val]) => val !== item);
    this._items.set(items);
    return this;
  }

  has(item: Item<T>): boolean {
    return this._items().some(([s, value]) => value === item);
  }

  use(item: Item<T>, options: ResourceAddOptions = {}): Resource<T> {
    const scope = useScope();
    this.add(item, options);
    scope.onDestroy(() => this.delete(item));
    return this;
  }
}
