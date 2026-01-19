import { OwlError } from "../../common/owl_error";
import { onReadAtom, onWriteAtom, Atom } from "./computations";

// Special key to subscribe to, to be notified of key creation/deletion
const KEYCHANGES = Symbol("Key changes");

// The following types only exist to signify places where objects are expected
// to be proxy or not, they provide no type checking benefit over "object"
type Target = object;
type Reactive<T extends Target> = T;

type Collection = Set<any> | Map<any, any> | WeakMap<any, any>;
type CollectionRawType = "Set" | "Map" | "WeakMap";

const objectToString = Object.prototype.toString;
const objectHasOwnProperty = Object.prototype.hasOwnProperty;

// Use arrays because Array.includes is faster than Set.has for small arrays
const SUPPORTED_RAW_TYPES = ["Object", "Array", "Set", "Map", "WeakMap"];
const COLLECTION_RAW_TYPES = ["Set", "Map", "WeakMap"];

/**
 * extract "RawType" from strings like "[object RawType]" => this lets us ignore
 * many native objects such as Promise (whose toString is [object Promise])
 * or Date ([object Date]), while also supporting collections without using
 * instanceof in a loop
 *
 * @param obj the object to check
 * @returns the raw type of the object
 */
function rawType(obj: any) {
  return objectToString.call(toRaw(obj)).slice(8, -1);
}
/**
 * Checks whether a given value can be made into a proxy object.
 *
 * @param value the value to check
 * @returns whether the value can be made proxy
 */
function canBeMadeReactive(value: any): boolean {
  if (typeof value !== "object") {
    return false;
  }
  return SUPPORTED_RAW_TYPES.includes(rawType(value));
}
/**
 * Creates a proxy from the given object/callback if possible and returns it,
 * returns the original object otherwise.
 *
 * @param value the value make proxy
 * @returns a proxy for the given object when possible, the original otherwise
 */
function possiblyReactive(val: any, atom: Atom | null) {
  return !atom && canBeMadeReactive(val) ? proxy(val) : val;
}

const skipped = new WeakSet<Target>();
/**
 * Mark an object or array so that it is ignored by the reactivity system
 *
 * @param value the value to mark
 * @returns the object itself
 */
export function markRaw<T extends Target>(value: T): T {
  skipped.add(value);
  return value;
}

/**
 * Given a proxy objet, return the raw (non proxy) underlying object
 *
 * @param value a proxy value
 * @returns the underlying value
 */
export function toRaw<T extends Target, U extends Reactive<T>>(value: U | T): T {
  return targets.has(value) ? (targets.get(value) as T) : value;
}

const targetToKeysToAtomItem = new WeakMap<Target, Map<PropertyKey, Atom>>();

function getTargetKeyAtom(target: Target, key: PropertyKey): Atom {
  let keyToAtomItem: Map<PropertyKey, Atom> = targetToKeysToAtomItem.get(target)!;
  if (!keyToAtomItem) {
    keyToAtomItem = new Map();
    targetToKeysToAtomItem.set(target, keyToAtomItem);
  }
  let atom = keyToAtomItem.get(key)!;
  if (!atom) {
    atom = {
      value: undefined,
      observers: new Set(),
    };
    keyToAtomItem.set(key, atom);
  }
  return atom;
}

/**
 * Observes a given key on a target with an callback. The callback will be
 * called when the given key changes on the target.
 *
 * @param target the target whose key should be observed
 * @param key the key to observe (or Symbol(KEYCHANGES) for key creation
 *  or deletion)
 * @param callback the function to call when the key changes
 */
function onReadTargetKey(target: Target, key: PropertyKey, atom: Atom | null): void {
  onReadAtom(atom ?? getTargetKeyAtom(target, key));
}

/**
 * Notify Reactives that are observing a given target that a key has changed on
 * the target.
 *
 * @param target target whose Reactives should be notified that the target was
 *  changed.
 * @param key the key that changed (or Symbol `KEYCHANGES` if a key was created
 *   or deleted)
 */
function onWriteTargetKey(target: Target, key: PropertyKey, atom: Atom | null): void {
  if (!atom) {
    const keyToAtomItem = targetToKeysToAtomItem.get(target)!;
    if (!keyToAtomItem) {
      return;
    }
    if (!keyToAtomItem.has(key)) {
      return;
    }
    atom = keyToAtomItem.get(key)!;
  }
  onWriteAtom(atom);
}

// Maps proxy objects to the underlying target
export const targets = new WeakMap<Reactive<Target>, Target>();
const proxyCache = new WeakMap<Target, Reactive<Target>>();

export function proxifyTarget<T extends Target>(target: T, atom: Atom | null): T {
  if (!canBeMadeReactive(target)) {
    throw new OwlError(`Cannot make the given value reactive`);
  }
  if (skipped.has(target)) {
    return target;
  }
  if (targets.has(target)) {
    // target is reactive, create a reactive on the underlying object instead
    return target;
  }
  const reactive = proxyCache.get(target)!;
  if (reactive) {
    return reactive as T;
  }

  const targetRawType = rawType(target);
  const handler = COLLECTION_RAW_TYPES.includes(targetRawType)
    ? collectionsProxyHandler(target as Collection, targetRawType as CollectionRawType, atom)
    : basicProxyHandler<T>(atom);
  const proxy = new Proxy(target, handler as ProxyHandler<T>) as Reactive<T>;

  proxyCache.set(target, proxy);
  targets.set(proxy, target);

  return proxy;
}

/**
 * Creates a reactive proxy for an object. Reading data on the proxy object
 * subscribes to changes to the data. Writing data on the object will cause the
 * notify callback to be called if there are suscriptions to that data. Nested
 * objects and arrays are automatically made reactive as well.
 *
 * Whenever you are notified of a change, all subscriptions are cleared, and if
 * you would like to be notified of any further changes, you should go read
 * the underlying data again. We assume that if you don't go read it again after
 * being notified, it means that you are no longer interested in that data.
 *
 * Subscriptions:
 * + Reading a property on an object will subscribe you to changes in the value
 *    of that property.
 * + Accessing an object's keys (eg with Object.keys or with `for..in`) will
 *    subscribe you to the creation/deletion of keys. Checking the presence of a
 *    key on the object with 'in' has the same effect.
 * - getOwnPropertyDescriptor does not currently subscribe you to the property.
 *    This is a choice that was made because changing a key's value will trigger
 *    this trap and we do not want to subscribe by writes. This also means that
 *    Object.hasOwnProperty doesn't subscribe as it goes through this trap.
 *
 * @param target the object for which to create a proxy proxy
 * @param callback the function to call when an observed property of the
 *  proxy has changed
 * @returns a proxy that tracks changes to it
 */
export function proxy<T extends Target>(target: T): T {
  return proxifyTarget(target, null);
}

/**
 * Creates a basic proxy handler for regular objects and arrays.
 *
 * @param callback @see proxy
 * @returns a proxy handler object
 */
function basicProxyHandler<T extends Target>(atom: Atom | null): ProxyHandler<T> {
  return {
    get(target, key, receiver) {
      // non-writable non-configurable properties cannot be made proxy
      const desc = Object.getOwnPropertyDescriptor(target, key);
      if (desc && !desc.writable && !desc.configurable) {
        return Reflect.get(target, key, receiver);
      }
      onReadTargetKey(target, key, atom);
      return possiblyReactive(Reflect.get(target, key, receiver), atom);
    },
    set(target, key, value, receiver) {
      const hadKey = objectHasOwnProperty.call(target, key);
      const originalValue = Reflect.get(target, key, receiver);
      const ret = Reflect.set(target, key, toRaw(value), receiver);
      if (!hadKey && objectHasOwnProperty.call(target, key)) {
        onWriteTargetKey(target, KEYCHANGES, atom);
      }
      // While Array length may trigger the set trap, it's not actually set by this
      // method but is updated behind the scenes, and the trap is not called with the
      // new value. We disable the "same-value-optimization" for it because of that.
      if (
        originalValue !== Reflect.get(target, key, receiver) ||
        (key === "length" && Array.isArray(target))
      ) {
        onWriteTargetKey(target, key, atom);
      }
      return ret;
    },
    deleteProperty(target, key) {
      const ret = Reflect.deleteProperty(target, key);
      // TODO: only notify when something was actually deleted
      onWriteTargetKey(target, KEYCHANGES, atom);
      onWriteTargetKey(target, key, atom);
      return ret;
    },
    ownKeys(target) {
      onReadTargetKey(target, KEYCHANGES, atom);
      return Reflect.ownKeys(target);
    },
    has(target, key) {
      // TODO: this observes all key changes instead of only the presence of the argument key
      // observing the key itself would observe value changes instead of presence changes
      // so we may need a finer grained system to distinguish observing value vs presence.
      onReadTargetKey(target, KEYCHANGES, atom);
      return Reflect.has(target, key);
    },
  } as ProxyHandler<T>;
}
/**
 * Creates a function that will observe the key that is passed to it when called
 * and delegates to the underlying method.
 *
 * @param methodName name of the method to delegate to
 * @param target @see proxy
 * @param callback @see proxy
 */
function makeKeyObserver(methodName: "has" | "get", target: any, atom: Atom | null) {
  return (key: any) => {
    key = toRaw(key);
    onReadTargetKey(target, key, atom);
    return possiblyReactive(target[methodName](key), atom);
  };
}
/**
 * Creates an iterable that will delegate to the underlying iteration method and
 * observe keys as necessary.
 *
 * @param methodName name of the method to delegate to
 * @param target @see proxy
 * @param callback @see proxy
 */
function makeIteratorObserver(
  methodName: "keys" | "values" | "entries" | typeof Symbol.iterator,
  target: any,
  atom: Atom | null
) {
  return function* () {
    onReadTargetKey(target, KEYCHANGES, atom);
    const keys = target.keys();
    for (const item of target[methodName]()) {
      const key = keys.next().value;
      onReadTargetKey(target, key, atom);
      yield possiblyReactive(item, atom);
    }
  };
}
/**
 * Creates a forEach function that will delegate to forEach on the underlying
 * collection while observing key changes, and keys as they're iterated over,
 * and making the passed keys/values proxy.
 *
 * @param target @see proxy
 * @param callback @see proxy
 */
function makeForEachObserver(target: any, atom: Atom | null) {
  return function forEach(forEachCb: (val: any, key: any, target: any) => void, thisArg: any) {
    onReadTargetKey(target, KEYCHANGES, atom);
    target.forEach(function (val: any, key: any, targetObj: any) {
      onReadTargetKey(target, key, atom);
      forEachCb.call(
        thisArg,
        possiblyReactive(val, atom),
        possiblyReactive(key, atom),
        possiblyReactive(targetObj, atom)
      );
    }, thisArg);
  };
}
/**
 * Creates a function that will delegate to an underlying method, and check if
 * that method has modified the presence or value of a key, and notify the
 * proxys appropriately.
 *
 * @param setterName name of the method to delegate to
 * @param getterName name of the method which should be used to retrieve the
 *  value before calling the delegate method for comparison purposes
 * @param target @see proxy
 */
function delegateAndNotify(
  setterName: "set" | "add" | "delete",
  getterName: "has" | "get",
  target: any,
  atom: Atom | null
) {
  return (key: any, value: any) => {
    key = toRaw(key);
    const hadKey = target.has(key);
    const originalValue = target[getterName](key);
    const ret = target[setterName](key, value);
    const hasKey = target.has(key);
    if (hadKey !== hasKey) {
      onWriteTargetKey(target, KEYCHANGES, atom);
    }
    if (originalValue !== target[getterName](key)) {
      onWriteTargetKey(target, key, atom);
    }
    return ret;
  };
}
/**
 * Creates a function that will clear the underlying collection and notify that
 * the keys of the collection have changed.
 *
 * @param target @see proxy
 */
function makeClearNotifier(target: Map<any, any> | Set<any>, atom: Atom | null) {
  return () => {
    const allKeys = [...target.keys()];
    target.clear();
    onWriteTargetKey(target, KEYCHANGES, atom);
    for (const key of allKeys) {
      onWriteTargetKey(target, key, atom);
    }
  };
}
/**
 * Maps raw type of an object to an object containing functions that can be used
 * to build an appropritate proxy handler for that raw type. Eg: when making a
 * proxy set, calling the has method should mark the key that is being
 * retrieved as observed, and calling the add or delete method should notify the
 * proxys that the key which is being added or deleted has been modified.
 */
const rawTypeToFuncHandlers = {
  Set: (target: any, atom: Atom | null) => ({
    has: makeKeyObserver("has", target, atom),
    add: delegateAndNotify("add", "has", target, atom),
    delete: delegateAndNotify("delete", "has", target, atom),
    keys: makeIteratorObserver("keys", target, atom),
    values: makeIteratorObserver("values", target, atom),
    entries: makeIteratorObserver("entries", target, atom),
    [Symbol.iterator]: makeIteratorObserver(Symbol.iterator, target, atom),
    forEach: makeForEachObserver(target, atom),
    clear: makeClearNotifier(target, atom),
    get size() {
      onReadTargetKey(target, KEYCHANGES, atom);
      return target.size;
    },
  }),
  Map: (target: any, atom: Atom | null) => ({
    has: makeKeyObserver("has", target, atom),
    get: makeKeyObserver("get", target, atom),
    set: delegateAndNotify("set", "get", target, atom),
    delete: delegateAndNotify("delete", "has", target, atom),
    keys: makeIteratorObserver("keys", target, atom),
    values: makeIteratorObserver("values", target, atom),
    entries: makeIteratorObserver("entries", target, atom),
    [Symbol.iterator]: makeIteratorObserver(Symbol.iterator, target, atom),
    forEach: makeForEachObserver(target, atom),
    clear: makeClearNotifier(target, atom),
    get size() {
      onReadTargetKey(target, KEYCHANGES, atom);
      return target.size;
    },
  }),
  WeakMap: (target: any, atom: Atom | null) => ({
    has: makeKeyObserver("has", target, atom),
    get: makeKeyObserver("get", target, atom),
    set: delegateAndNotify("set", "get", target, atom),
    delete: delegateAndNotify("delete", "has", target, atom),
  }),
};
/**
 * Creates a proxy handler for collections (Set/Map/WeakMap)
 *
 * @param callback @see proxy
 * @param target @see proxy
 * @returns a proxy handler object
 */
function collectionsProxyHandler<T extends Collection>(
  target: T,
  targetRawType: CollectionRawType,
  atom: Atom | null
): ProxyHandler<T> {
  // TODO: if performance is an issue we can create the special handlers lazily when each
  // property is read.
  const specialHandlers = rawTypeToFuncHandlers[targetRawType](target, atom);
  return Object.assign(basicProxyHandler(atom), {
    // FIXME: probably broken when part of prototype chain since we ignore the receiver
    get(target: any, key: PropertyKey) {
      if (objectHasOwnProperty.call(specialHandlers, key)) {
        return (specialHandlers as any)[key];
      }
      onReadTargetKey(target, key, atom);
      return possiblyReactive(target[key], atom);
    },
  }) as ProxyHandler<T>;
}
