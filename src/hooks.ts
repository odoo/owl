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

// -----------------------------------------------------------------------------
// useState
// -----------------------------------------------------------------------------

/**
 * This is the main way a component can be made reactive.  The useState hook
 * will return an observed object (or array).  Changes to that value will then
 * trigger a rerendering of the current component.
 */
export function useState<T>(state: T): T {
  const component: Component = Component.current!;
  const __owl__ = component.__owl__;
  if (!__owl__.observer) {
    __owl__.observer = new Observer();
    __owl__.observer.notifyCB = component.render.bind(component);
  }
  return __owl__.observer.observe(state);
}

// -----------------------------------------------------------------------------
// Life cycle hooks
// -----------------------------------------------------------------------------
function makeLifecycleHook(method: string, reverse: boolean = false) {
  if (reverse) {
    return function (cb) {
      const component: Component = Component.current!;
      if (component.__owl__[method]) {
        const current = component.__owl__[method];
        component.__owl__[method] = function () {
          current.call(component);
          cb.call(component);
        };
      } else {
        component.__owl__[method] = cb;
      }
    };
  } else {
    return function (cb) {
      const component: Component = Component.current!;
      if (component.__owl__[method]) {
        const current = component.__owl__[method];
        component.__owl__[method] = function () {
          cb.call(component);
          current.call(component);
        };
      } else {
        component.__owl__[method] = cb;
      }
    };
  }
}

function makeAsyncHook(method: string) {
  return function (cb) {
    const component: Component = Component.current!;
    if (component.__owl__[method]) {
      const current = component.__owl__[method];
      component.__owl__[method] = function (...args) {
        return Promise.all([current.call(component, ...args), cb.call(component, ...args)]);
      };
    } else {
      component.__owl__[method] = cb;
    }
  };
}

export const onMounted = makeLifecycleHook("mountedCB", true);
export const onWillUnmount = makeLifecycleHook("willUnmountCB");
export const onWillPatch = makeLifecycleHook("willPatchCB");
export const onPatched = makeLifecycleHook("patchedCB", true);

export const onWillStart = makeAsyncHook("willStartCB");
export const onWillUpdateProps = makeAsyncHook("willUpdatePropsCB");

// -----------------------------------------------------------------------------
// useRef
// -----------------------------------------------------------------------------

/**
 * The purpose of this hook is to allow components to get a reference to a sub
 * html node or component.
 */
interface Ref<C extends Component = Component> {
  el: HTMLElement | null;
  comp: C | null;
}

export function useRef<C extends Component = Component>(name: string): Ref<C> {
  const __owl__ = Component.current!.__owl__;
  return {
    get el(): HTMLElement | null {
      const val = __owl__.refs && __owl__.refs[name];
      if (val instanceof HTMLElement) {
        return val;
      } else if (val instanceof Component) {
        return val.el;
      }
      return null;
    },
    get comp(): C | null {
      const val = __owl__.refs && __owl__.refs[name];
      return val instanceof Component ? (val as C) : null;
    },
  };
}

// -----------------------------------------------------------------------------
// useSubEnv
// -----------------------------------------------------------------------------

/**
 * This hook is a simple way to let components use a sub environment.  Note that
 * like for all hooks, it is important that this is only called in the
 * constructor method.
 */
export function useSubEnv(nextEnv) {
  const component = Component.current!;
  component.env = Object.assign(Object.create(component.env), nextEnv);
}

// -----------------------------------------------------------------------------
// useExternalListener
// -----------------------------------------------------------------------------

/**
 * When a component needs to listen to DOM Events on element(s) that are not
 * part of his hierarchy, we can use the `useExternalListener` hook.
 * It will correctly add and remove the event listener, whenever the
 * component is mounted and unmounted.
 *
 * Example:
 *  a menu needs to listen to the click on window to be closed automatically
 *
 * Usage:
 *  in the constructor of the OWL component that needs to be notified,
 *  `useExternalListener(window, 'click', this._doSomething);`
 * */
export function useExternalListener(
  target: HTMLElement | typeof window,
  eventName: string,
  handler,
  eventParams?
) {
  const boundHandler = handler.bind(Component.current);

  onMounted(() => target.addEventListener(eventName, boundHandler, eventParams));
  onWillUnmount(() => target.removeEventListener(eventName, boundHandler, eventParams));
}
