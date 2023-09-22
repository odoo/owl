import type { Callback } from "./utils";
import { OwlError } from "../common/owl_error";

// Special key to subscribe to, to be notified of key creation/deletion
const KEYCHANGES = Symbol("Key changes");
// Used to specify the absence of a callback, can be used as WeakMap key but
// should only be used as a sentinel value and never called.
const NO_CALLBACK = () => {
  throw new Error("Called NO_CALLBACK. Owl is broken, please report this to the maintainers.");
};

// The following types only exist to signify places where objects are expected
// to be reactive or not, they provide no type checking benefit over "object"
type Target = object;
type Reactive<T extends Target> = T;

type Collection = Set<any> | Map<any, any> | WeakMap<any, any>;
type CollectionRawType = "Set" | "Map" | "WeakMap";

const objectToString = Object.prototype.toString;
const objectHasOwnProperty = Object.prototype.hasOwnProperty;

const SUPPORTED_RAW_TYPES = new Set(["Object", "Array", "Set", "Map", "WeakMap"]);
const COLLECTION_RAWTYPES = new Set(["Set", "Map", "WeakMap"]);

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
 * Checks whether a given value can be made into a reactive object.
 *
 * @param value the value to check
 * @returns whether the value can be made reactive
 */
function canBeMadeReactive(value: any): boolean {
  if (typeof value !== "object") {
    return false;
  }
  return SUPPORTED_RAW_TYPES.has(rawType(value));
}
/**
 * Creates a reactive from the given object/callback if possible and returns it,
 * returns the original object otherwise.
 *
 * @param value the value make reactive
 * @returns a reactive for the given object when possible, the original otherwise
 */
function possiblyReactive(val: any, cb: Callback) {
  return canBeMadeReactive(val) ? reactive(val, cb) : val;
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
 * Given a reactive objet, return the raw (non reactive) underlying object
 *
 * @param value a reactive value
 * @returns the underlying value
 */
export function toRaw<T extends Target, U extends Reactive<T>>(value: U | T): T {
  return targets.has(value) ? (targets.get(value) as T) : value;
}

const targetToKeysToCallbacks = new WeakMap<Target, Map<PropertyKey, Set<Callback>>>();
/**
 * Observes a given key on a target with an callback. The callback will be
 * called when the given key changes on the target.
 *
 * @param target the target whose key should be observed
 * @param key the key to observe (or Symbol(KEYCHANGES) for key creation
 *  or deletion)
 * @param callback the function to call when the key changes
 */
function observeTargetKey(target: Target, key: PropertyKey, callback: Callback): void {
  if (callback === NO_CALLBACK) {
    return;
  }
  if (!targetToKeysToCallbacks.get(target)) {
    targetToKeysToCallbacks.set(target, new Map());
  }
  const keyToCallbacks = targetToKeysToCallbacks.get(target)!;
  if (!keyToCallbacks.get(key)) {
    keyToCallbacks.set(key, new Set());
  }
  keyToCallbacks.get(key)!.add(callback);
  if (!callbacksToTargets.has(callback)) {
    callbacksToTargets.set(callback, new Set());
  }
  callbacksToTargets.get(callback)!.add(target);
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
function notifyReactives(target: Target, key: PropertyKey): void {
  const keyToCallbacks = targetToKeysToCallbacks.get(target);
  if (!keyToCallbacks) {
    return;
  }
  const callbacks = keyToCallbacks.get(key);
  if (!callbacks) {
    return;
  }
  // Loop on copy because clearReactivesForCallback will modify the set in place
  for (const callback of [...callbacks]) {
    clearReactivesForCallback(callback);
    callback();
  }
}

const callbacksToTargets = new WeakMap<Callback, Set<Target>>();
/**
 * Clears all subscriptions of the Reactives associated with a given callback.
 *
 * @param callback the callback for which the reactives need to be cleared
 */
export function clearReactivesForCallback(callback: Callback): void {
  const targetsToClear = callbacksToTargets.get(callback);
  if (!targetsToClear) {
    return;
  }
  for (const target of targetsToClear) {
    const observedKeys = targetToKeysToCallbacks.get(target);
    if (!observedKeys) {
      continue;
    }
    for (const [key, callbacks] of observedKeys.entries()) {
      callbacks.delete(callback);
      if (!callbacks.size) {
        observedKeys.delete(key);
      }
    }
  }
  targetsToClear.clear();
}

export function getSubscriptions(callback: Callback) {
  const targets = callbacksToTargets.get(callback) || [];
  return [...targets].map((target) => {
    const keysToCallbacks = targetToKeysToCallbacks.get(target);
    let keys = [];
    if (keysToCallbacks) {
      for (const [key, cbs] of keysToCallbacks) {
        if (cbs.has(callback)) {
          keys.push(key);
        }
      }
    }
    return { target, keys };
  });
}
// Maps reactive objects to the underlying target
export const targets = new WeakMap<Reactive<Target>, Target>();
const reactiveCache = new WeakMap<Target, WeakMap<Callback, Reactive<Target>>>();
/**
 * Creates a reactive proxy for an object. Reading data on the reactive object
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
 * @param target the object for which to create a reactive proxy
 * @param callback the function to call when an observed property of the
 *  reactive has changed
 * @returns a proxy that tracks changes to it
 */
export function reactive<T extends Target>(target: T, callback: Callback = NO_CALLBACK): T {
  if (!canBeMadeReactive(target)) {
    throw new OwlError(`Cannot make the given value reactive`);
  }
  if (skipped.has(target)) {
    return target;
  }
  if (targets.has(target)) {
    // target is reactive, create a reactive on the underlying object instead
    return reactive(targets.get(target) as T, callback);
  }
  if (!reactiveCache.has(target)) {
    reactiveCache.set(target, new WeakMap());
  }
  const reactivesForTarget = reactiveCache.get(target)!;
  if (!reactivesForTarget.has(callback)) {
    const targetRawType = rawType(target);
    const handler = COLLECTION_RAWTYPES.has(targetRawType)
      ? collectionsProxyHandler(target as Collection, callback, targetRawType as CollectionRawType)
      : basicProxyHandler<T>(callback);
    const proxy = new Proxy(target, handler as ProxyHandler<T>) as Reactive<T>;
    reactivesForTarget.set(callback, proxy);
    targets.set(proxy, target);
  }
  return reactivesForTarget.get(callback) as Reactive<T>;
}
/**
 * Creates a basic proxy handler for regular objects and arrays.
 *
 * @param callback @see reactive
 * @returns a proxy handler object
 */
function basicProxyHandler<T extends Target>(callback: Callback): ProxyHandler<T> {
  return {
    get(target, key, receiver) {
      // non-writable non-configurable properties cannot be made reactive
      const desc = Object.getOwnPropertyDescriptor(target, key);
      if (desc && !desc.writable && !desc.configurable) {
        return Reflect.get(target, key, receiver);
      }
      observeTargetKey(target, key, callback);
      return possiblyReactive(Reflect.get(target, key, receiver), callback);
    },
    set(target, key, value, receiver) {
      const hadKey = objectHasOwnProperty.call(target, key);
      const originalValue = Reflect.get(target, key, receiver);
      const ret = Reflect.set(target, key, value, receiver);
      if (!hadKey && objectHasOwnProperty.call(target, key)) {
        notifyReactives(target, KEYCHANGES);
      }
      // While Array length may trigger the set trap, it's not actually set by this
      // method but is updated behind the scenes, and the trap is not called with the
      // new value. We disable the "same-value-optimization" for it because of that.
      if (
        originalValue !== Reflect.get(target, key, receiver) ||
        (key === "length" && Array.isArray(target))
      ) {
        notifyReactives(target, key);
      }
      return ret;
    },
    deleteProperty(target, key) {
      const ret = Reflect.deleteProperty(target, key);
      // TODO: only notify when something was actually deleted
      notifyReactives(target, KEYCHANGES);
      notifyReactives(target, key);
      return ret;
    },
    ownKeys(target) {
      observeTargetKey(target, KEYCHANGES, callback);
      return Reflect.ownKeys(target);
    },
    has(target, key) {
      // TODO: this observes all key changes instead of only the presence of the argument key
      // observing the key itself would observe value changes instead of presence changes
      // so we may need a finer grained system to distinguish observing value vs presence.
      observeTargetKey(target, KEYCHANGES, callback);
      return Reflect.has(target, key);
    },
  } as ProxyHandler<T>;
}
/**
 * Creates a function that will observe the key that is passed to it when called
 * and delegates to the underlying method.
 *
 * @param methodName name of the method to delegate to
 * @param target @see reactive
 * @param callback @see reactive
 */
function makeKeyObserver(methodName: "has" | "get", target: any, callback: Callback) {
  return (key: any) => {
    key = toRaw(key);
    observeTargetKey(target, key, callback);
    return possiblyReactive(target[methodName](key), callback);
  };
}
/**
 * Creates an iterable that will delegate to the underlying iteration method and
 * observe keys as necessary.
 *
 * @param methodName name of the method to delegate to
 * @param target @see reactive
 * @param callback @see reactive
 */
function makeIteratorObserver(
  methodName: "keys" | "values" | "entries" | typeof Symbol.iterator,
  target: any,
  callback: Callback
) {
  return function* () {
    observeTargetKey(target, KEYCHANGES, callback);
    const keys = target.keys();
    for (const item of target[methodName]()) {
      const key = keys.next().value;
      observeTargetKey(target, key, callback);
      yield possiblyReactive(item, callback);
    }
  };
}
/**
 * Creates a forEach function that will delegate to forEach on the underlying
 * collection while observing key changes, and keys as they're iterated over,
 * and making the passed keys/values reactive.
 *
 * @param target @see reactive
 * @param callback @see reactive
 */
function makeForEachObserver(target: any, callback: Callback) {
  return function forEach(forEachCb: (val: any, key: any, target: any) => void, thisArg: any) {
    observeTargetKey(target, KEYCHANGES, callback);
    target.forEach(function (val: any, key: any, targetObj: any) {
      observeTargetKey(target, key, callback);
      forEachCb.call(
        thisArg,
        possiblyReactive(val, callback),
        possiblyReactive(key, callback),
        possiblyReactive(targetObj, callback)
      );
    }, thisArg);
  };
}
/**
 * Creates a function that will delegate to an underlying method, and check if
 * that method has modified the presence or value of a key, and notify the
 * reactives appropriately.
 *
 * @param setterName name of the method to delegate to
 * @param getterName name of the method which should be used to retrieve the
 *  value before calling the delegate method for comparison purposes
 * @param target @see reactive
 */
function delegateAndNotify(
  setterName: "set" | "add" | "delete",
  getterName: "has" | "get",
  target: any
) {
  return (key: any, value: any) => {
    key = toRaw(key);
    const hadKey = target.has(key);
    const originalValue = target[getterName](key);
    const ret = target[setterName](key, value);
    const hasKey = target.has(key);
    if (hadKey !== hasKey) {
      notifyReactives(target, KEYCHANGES);
    }
    if (originalValue !== target[getterName](key)) {
      notifyReactives(target, key);
    }
    return ret;
  };
}
/**
 * Creates a function that will clear the underlying collection and notify that
 * the keys of the collection have changed.
 *
 * @param target @see reactive
 */
function makeClearNotifier(target: Map<any, any> | Set<any>) {
  return () => {
    const allKeys = [...target.keys()];
    target.clear();
    notifyReactives(target, KEYCHANGES);
    for (const key of allKeys) {
      notifyReactives(target, key);
    }
  };
}
/**
 * Maps raw type of an object to an object containing functions that can be used
 * to build an appropritate proxy handler for that raw type. Eg: when making a
 * reactive set, calling the has method should mark the key that is being
 * retrieved as observed, and calling the add or delete method should notify the
 * reactives that the key which is being added or deleted has been modified.
 */
const rawTypeToFuncHandlers = {
  Set: (target: any, callback: Callback) => ({
    has: makeKeyObserver("has", target, callback),
    add: delegateAndNotify("add", "has", target),
    delete: delegateAndNotify("delete", "has", target),
    keys: makeIteratorObserver("keys", target, callback),
    values: makeIteratorObserver("values", target, callback),
    entries: makeIteratorObserver("entries", target, callback),
    [Symbol.iterator]: makeIteratorObserver(Symbol.iterator, target, callback),
    forEach: makeForEachObserver(target, callback),
    clear: makeClearNotifier(target),
    get size() {
      observeTargetKey(target, KEYCHANGES, callback);
      return target.size;
    },
  }),
  Map: (target: any, callback: Callback) => ({
    has: makeKeyObserver("has", target, callback),
    get: makeKeyObserver("get", target, callback),
    set: delegateAndNotify("set", "get", target),
    delete: delegateAndNotify("delete", "has", target),
    keys: makeIteratorObserver("keys", target, callback),
    values: makeIteratorObserver("values", target, callback),
    entries: makeIteratorObserver("entries", target, callback),
    [Symbol.iterator]: makeIteratorObserver(Symbol.iterator, target, callback),
    forEach: makeForEachObserver(target, callback),
    clear: makeClearNotifier(target),
    get size() {
      observeTargetKey(target, KEYCHANGES, callback);
      return target.size;
    },
  }),
  WeakMap: (target: any, callback: Callback) => ({
    has: makeKeyObserver("has", target, callback),
    get: makeKeyObserver("get", target, callback),
    set: delegateAndNotify("set", "get", target),
    delete: delegateAndNotify("delete", "has", target),
  }),
};
/**
 * Creates a proxy handler for collections (Set/Map/WeakMap)
 *
 * @param callback @see reactive
 * @param target @see reactive
 * @returns a proxy handler object
 */
function collectionsProxyHandler<T extends Collection>(
  target: T,
  callback: Callback,
  targetRawType: CollectionRawType
): ProxyHandler<T> {
  // TODO: if performance is an issue we can create the special handlers lazily when each
  // property is read.
  const specialHandlers = rawTypeToFuncHandlers[targetRawType](target, callback);
  return Object.assign(basicProxyHandler(callback), {
    // FIXME: probably broken when part of prototype chain since we ignore the receiver
    get(target: any, key: PropertyKey) {
      if (objectHasOwnProperty.call(specialHandlers, key)) {
        return (specialHandlers as any)[key];
      }
      observeTargetKey(target, key, callback);
      return possiblyReactive(target[key], callback);
    },
  }) as ProxyHandler<T>;
}
