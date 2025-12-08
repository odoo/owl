import { derived } from "./reactivity/derived";
import { signal, Signal } from "./reactivity/signal";
import { TypeDescription, validateType } from "./validation";

export class Resource<T> {
  _items: Signal<[number, T][]> = signal([]);
  _name: string;
  _type?: TypeDescription;

  constructor(name?: string, type?: TypeDescription) {
    this._name = name || "registry";
    this._type = type;
  }

  items = derived(() => {
    return this._items()
      .sort((el1, el2) => el1[0] - el2[0])
      .map((elem) => elem[1]);
  });

  add(item: T, sequence: number = 50): Resource<T> {
    if (this._type) {
      const error = validateType("item", item as any, this._type as any);
      if (error) {
        throw new Error("Invalid type: " + error);
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
}
