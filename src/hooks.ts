import { Component } from "./component/component";
import { Observer } from "./core/observer";

/**
 * Owl Hook System
 *
 * This file introduces the concept of hooks, similar to React or Vue hooks.
 * We have currently an implementation of:
 * - useState (reactive state)
 * - onMounted
 * - onWillUnmount
 */


/**
 * useState hook
 *
 * This is the main way a component can be made reactive.  The useState hook
 * will return an observed object (or array).  Changes to that value will then
 * trigger a rerendering of the current component.
 */
export function useState<T>(state: T): T {
  const component: Component<any,any> = Component._current;
  const __owl__ = component.__owl__;
  if (!__owl__.observer) {
    __owl__.observer = new Observer();
    __owl__.observer.notifyCB = component.render.bind(component);
  }
  return __owl__.observer.observe(state);
}

/**
 * Mounted hook. The callback will be called when the current component is
 * mounted.  Note that the component mounted method is called first.
 */
export function onMounted(cb) {
  const component = Component._current;
  const current = component.mounted;
  component.mounted = function() {
    current.call(component);
    cb();
  };
}

/**
 * willUnmount hook. The callback will be called when the current component is
 * willUnmounted.  Note that the component mounted method is called last.
 */
export function onWillUnmount(cb) {
  const component = Component._current;
  const current = component.willUnmount;
  component.willUnmount = function() {
    cb();
    current.call(component);
  };
}
