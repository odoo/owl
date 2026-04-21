import { computed } from "./computed";
import { OwlError } from "./owl_error";
import { signal } from "./signal";
import { ResourceAddOptions } from "./resource";
import { useScope } from "./scope";
import { assertType } from "./validation";

interface RegistryOptions<T> {
  name?: string;
  validation?: T;
}

interface RegistryAddOptions extends ResourceAddOptions {
  force?: boolean;
}

export class Registry<T> {
  private _map = signal.Object<Record<string, [number, T]>>(Object.create(null));
  private _name: string;
  private _validation?: T;

  constructor(options: RegistryOptions<T> = {}) {
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

  addById<U extends { id: string } & T>(item: U, options: RegistryAddOptions = {}): Registry<T> {
    if (!item.id) {
      throw new OwlError(`Item should have an id key (registry '${this._name}')`);
    }
    return this.add(item.id, item, options);
  }

  add(key: string, value: T, options: RegistryAddOptions = {}): Registry<T> {
    if (!options.force && key in this._map()) {
      throw new OwlError(
        `Key "${key}" is already registered (registry '${this._name}'). Use { force: true } to overwrite.`
      );
    }
    if (this._validation) {
      const info = this._name ? ` (registry '${this._name}', key: '${key}')` : ` (key: '${key}')`;
      assertType(value, this._validation, `Registry entry does not match the type${info}`);
    }
    this._map()[key] = [options.sequence ?? 50, value];
    return this;
  }

  get(key: string, defaultValue?: T): T {
    const hasKey = key in this._map();
    if (!hasKey && arguments.length < 2) {
      throw new OwlError(`Cannot find key "${key}" (registry '${this._name}')`);
    }
    return hasKey ? this._map()[key][1] : defaultValue!;
  }

  delete(key: string) {
    delete this._map()[key];
  }

  has(key: string): boolean {
    return key in this._map();
  }

  use(key: string, value: T, options: RegistryAddOptions = {}): Registry<T> {
    const scope = useScope();
    this.add(key, value, options);
    scope.onDestroy(() => {
      if (this._map()[key]?.[1] === value) {
        this.delete(key);
      }
    });
    return this;
  }

  useById<U extends { id: string } & T>(item: U, options: RegistryAddOptions = {}): Registry<T> {
    if (!item.id) {
      throw new OwlError(`Item should have an id key (registry '${this._name}')`);
    }
    return this.use(item.id, item, options);
  }
}
