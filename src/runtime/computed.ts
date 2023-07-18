import { Reactive, Target, multiReactive, toRaw } from "./reactivity";

/**
 * Creates a lazy reactive computed value.
 *
 * Calling the resulting function on the target not only returns the computed value,
 * it also caches the result in the target. As a result, succeeding function calls
 * will not trigger recalculation. And because of the reactivity system, the cached
 * value will be invalidated when any of the dependencies of the compute function
 * changes.
 *
 * Aside from caching, the computation is part of the reactivity system. This means
 * that it plays well with rerendering. For example, having the following tree,
 * `<Root><A/><B/></Root>`, where `A` reads from a computed value, when the computed
 * value changes (or the dependencies of the computed value changes), only the
 * components that read from the computed value will rerender. In this case, only
 * `A` will rerender.
 *
 * Note that this is only valid for one target and one compute function.
 * Use `computed` for shared compute functions.
 */
export function defineComputed(compute: (target: any) => any, name?: string) {
  // This is the key that will be used to store the compute value in the target.
  const cacheKey = name ? Symbol(name) : Symbol();
  let isValid = false;
  const invalidate = () => (isValid = false);
  return (target: any) => {
    if (isValid) {
      // Return the cached value if it is still valid.
      // This will subscribe the target's reactive directly to the cached value.
      return target[cacheKey];
    } else {
      // Create a target with multiple reactives.
      // - First is the original target's reactive.
      // - Second is the invalidate function.
      // This means that when any of the dependencies of the compute function changes,
      // the invalidate function and the original target's reactive will be notified.
      const mTarget = multiReactive(target, invalidate);
      // Call the compute function on the multi-reactive target.
      // This will subscribe the reactives to the dependencies of the compute function.
      const value = compute(mTarget);
      isValid = true;
      try {
        return value;
      } finally {
        // Right after return, the value is cached in the target.
        // This will notify the subscribers of this computed value.
        target[cacheKey] = value;
      }
    }
  };
}

// map: target -> compute -> cached compute
const t2c2cc = new WeakMap();

/**
 * This allows sharing of a declared computed such that for each target-compute
 * combination, there is a corresponding cached computed function.
 */
export function computed<T extends Target, R>(
  compute: (target: T | Reactive<T>) => R,
  name?: string
) {
  return (target: T | Reactive<T>): R => {
    const raw = toRaw(target);
    let c2cc = t2c2cc.get(raw);
    if (!c2cc) {
      c2cc = new Map();
      t2c2cc.set(raw, c2cc);
    }
    let cachedCompute = c2cc.get(compute);
    if (!cachedCompute) {
      cachedCompute = defineComputed(compute, name);
      c2cc.set(compute, cachedCompute);
    }
    return cachedCompute(target);
  };
}
