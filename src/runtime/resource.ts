import { onWillDestroy } from "./lifecycle_hooks";
import { computed } from "./reactivity/computed";
import { signal } from "./reactivity/signal";
import { assertType } from "./validation";

interface ResourceOptions<T> {
  name?: string;
  validation?: T;
}

export class Resource<T> {
  private _items = signal.Array<[number, T]>([]);
  private _name?: string;
  private _validation?: T;

  constructor(options: ResourceOptions<T> = {}) {
    this._name = options.name;
    this._validation = options.validation;
  }

  items = computed(() => {
    return this._items()
      .sort((el1, el2) => el1[0] - el2[0])
      .map((elem) => elem[1]);
  });

  add(item: T, options: { sequence?: number } = {}): Resource<T> {
    if (this._validation) {
      const info = this._name ? ` (resource '${this._name}')` : "";
      assertType(item, this._validation, `Resource item does not match the type${info}`);
    }
    this._items().push([options.sequence ?? 50, item]);
    return this;
  }

  delete(item: T): Resource<T> {
    const items = this._items().filter(([seq, val]) => val !== item);
    this._items.set(items);
    return this;
  }

  has(item: T): boolean {
    return this._items().some(([s, value]) => value === item);
  }
}

export function useResource<T>(r: Resource<T>, elements: T[]) {
  for (let elem of elements) {
    r.add(elem);
  }
  onWillDestroy(() => {
    for (let elem of elements) {
      r.delete(elem);
    }
  });
}
