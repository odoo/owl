import { onWillDestroy } from "./lifecycle_hooks";
import { computed } from "./reactivity/computed";
import { signal, Signal } from "./reactivity/signal";
import { TypeDescription, validateType } from "./validation";

export class Resource<T> {
  private _items: Signal<[number, T][]> = signal([]);
  private _name: string;
  private _type?: TypeDescription;

  constructor(name?: string, type?: TypeDescription) {
    this._name = name || "resource";
    this._type = type;
  }

  items = computed(() => {
    return this._items()
      .sort((el1, el2) => el1[0] - el2[0])
      .map((elem) => elem[1]);
  });

  add(item: T, sequence: number = 50): Resource<T> {
    if (this._type) {
      const error = validateType("item", item as any, this._type as any);
      if (error) {
        throw new Error(`Invalid type: ${error} (resource '${this._name}')`);
      }
    }
    this._items().push([sequence, item]);
    this._items.update();
    return this;
  }

  remove(item: T): Resource<T> {
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
      r.remove(elem);
    }
  });
}
