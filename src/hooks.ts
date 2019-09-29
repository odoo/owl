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
 * - useRef
 */

/**
 * useState hook
 *
 * This is the main way a component can be made reactive.  The useState hook
 * will return an observed object (or array).  Changes to that value will then
 * trigger a rerendering of the current component.
 */
export function useState<T>(state: T): T {
  const component: Component<any, any> = Component._current;
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
let nextID = 1;

export function onMounted(cb) {
  const component: Component<any, any> = Component._current;
  component.__owl__.mountedHandlers[`h${nextID++}`] = cb;
}

function makeLifecycleHook(method: string, reverse: boolean = false) {
  return function(cb) {
    const component: Component<any, any> = Component._current;
    if (component.__owl__[method]) {
      const current = component.__owl__[method];
      if (reverse) {
        component.__owl__[method] = function() {
          current.call(component);
          cb.call(component);
        };
      } else {
        component.__owl__[method] = function() {
          cb.call(component);
          current.call(component);
        };
      }
    } else {
      component.__owl__[method] = cb;
    }
  };
}

/**
 * willUnmount hook. The callback will be called when the current component is
 * willUnmounted.  Note that the component mounted method is called last.
 */
export const onWillUnmount = makeLifecycleHook("willUnmountCB");
export const onWillPatch = makeLifecycleHook("willPatchCB");
export const onPatched = makeLifecycleHook("patchedCB", true);
/**
 * useRef hook
 *
 * The purpose of this hook is to allow components to get a reference to a sub
 * html node or component.
 */
interface Ref {
  el: HTMLElement | null;
  comp: Component<any, any> | null;
}

export function useRef(name: string): Ref {
  const __owl__ = Component._current.__owl__;
  return {
    get el(): HTMLElement | null {
      const val = __owl__.refs && __owl__.refs[name];
      return val instanceof HTMLElement ? val : null;
    },
    get comp(): Component<any, any> | null {
      const val = __owl__.refs && __owl__.refs[name];
      return val instanceof Component ? val : null;
    }
  };
}
