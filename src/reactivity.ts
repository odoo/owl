import { onWillUnmount } from "./component/lifecycle_hooks";
import { ComponentNode, getCurrent } from "./component/component_node";
import { batched, Callback } from "./utils";

// Allows to get the target of a Reactive (used for making a new Reactive from the underlying object)
const TARGET = Symbol("Target");
// Special key to subscribe to, to be notified of key creation/deletion
const KEYCHANGES = Symbol("Key changes");

type ObjectKey = string | number | symbol;
type Target = object;
type Reactive<T extends Target = Target> = T & {
  [TARGET]: any;
};

/**
 * Checks whether a given value can be made into a reactive object.
 *
 * @param value the value to check
 * @returns whether the value can be made reactive
 */
function canBeMadeReactive(value: any): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Date) &&
    !(value instanceof Promise) &&
    !(value instanceof String) &&
    !(value instanceof Number)
  );
}

const targetToKeysToCallbacks = new WeakMap<Target, Map<ObjectKey, Set<Callback>>>();
/**
 * Observes a given key on a target with an callback. The callback will be
 * called when the given key changes on the target.
 *
 * @param target the target whose key should be observed
 * @param key the key to observe (or Symbol(KEYCHANGES) for key creation
 *  or deletion)
 * @param callback the function to call when the key changes
 */
function observeTargetKey(target: Target, key: ObjectKey, callback: Callback): void {
  if (!targetToKeysToCallbacks.get(target)) {
    targetToKeysToCallbacks.set(target, new Map());
  }
  const keyToCallbacks = targetToKeysToCallbacks.get(target)!;
  if (!keyToCallbacks.get(key)) {
    keyToCallbacks.set(key, new Set());
  }
  keyToCallbacks.get(key)!.add(callback);
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
function notifyReactives(target: Target, key: ObjectKey): void {
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
function clearReactivesForCallback(callback: Callback): void {
  const targetsToClear = callbacksToTargets.get(callback);
  if (!targetsToClear) {
    return;
  }
  for (const target of targetsToClear) {
    const observedKeys = targetToKeysToCallbacks.get(target);
    if (!observedKeys) {
      continue;
    }
    for (const callbacks of observedKeys.values()) {
      callbacks.delete(callback);
    }
  }
}

const reactiveCache = new WeakMap<Target, Map<Callback, Reactive>>();
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
 * + Accessing an object keys (eg with Object.keys or with `for..in`) will
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
export function reactive<T extends Target>(target: T, callback: Callback): Reactive<T> {
  if (!canBeMadeReactive(target)) {
    throw new Error(`Cannot make the given value reactive`);
  }
  const originalTarget = (target as Reactive)[TARGET];
  if (originalTarget) {
    return reactive(originalTarget, callback);
  }
  if (!reactiveCache.has(target)) {
    reactiveCache.set(target, new Map());
  }
  const reactivesForTarget = reactiveCache.get(target)!;
  if (!reactivesForTarget.has(callback)) {
    const proxy = new Proxy(target, {
      get(target: any, key: ObjectKey, proxy: Reactive<T>) {
        if (key === TARGET) {
          return target;
        }
        observeTargetKey(target, key, callback);
        const value = Reflect.get(target, key, proxy);
        if (!canBeMadeReactive(value)) {
          return value;
        }
        return reactive(value, callback);
      },
      set(target, key, value, proxy) {
        const isNewKey = !Object.hasOwnProperty.call(target, key);
        const originalValue = Reflect.get(target, key, proxy);
        const ret = Reflect.set(target, key, value, proxy);
        if (isNewKey) {
          notifyReactives(target, KEYCHANGES);
        }
        // While Array length may trigger the set trap, it's not actually set by this
        // method but is updated behind the scenes, and the trap is not called with the
        // new value. We disable the "same-value-optimization" for it because of that.
        if (originalValue !== value || (Array.isArray(target) && key === "length")) {
          notifyReactives(target, key);
        }
        return ret;
      },
      deleteProperty(target, key) {
        const ret = Reflect.deleteProperty(target, key);
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
        observeTargetKey(target, KEYCHANGES, callback);
        return Reflect.has(target, key);
      },
    });
    reactivesForTarget.set(callback, proxy);
    if (!callbacksToTargets.has(callback)) {
      callbacksToTargets.set(callback, new Set());
    }
    callbacksToTargets.get(callback)!.add(target);
  }
  return reactivesForTarget.get(callback) as Reactive<T>;
}

const batchedRenderFunctions = new WeakMap<ComponentNode, Callback>();
/**
 * Creates a reactive object that will be observed by the current component.
 * Reading data from the returned object (eg during rendering) will cause the
 * component to subscribe to that data and be rerendered when it changes.
 *
 * @param state the state to observe
 * @returns a reactive object that will cause the component to re-render on
 *  relevant changes
 * @see reactive
 */
export function useState<T extends object>(state: T): Reactive<T> {
  const node = getCurrent()!;
  if (!batchedRenderFunctions.has(node)) {
    batchedRenderFunctions.set(
      node,
      batched(() => node.render())
    );
  }
  const render = batchedRenderFunctions.get(node)!;
  const reactiveState = reactive(state, render);
  onWillUnmount(() => clearReactivesForCallback(render));
  return reactiveState;
}
