import type { Env } from "./app";
import { getCurrent } from "./component_node";
import { onMounted, onPatched, onWillUnmount } from "./lifecycle_hooks";

// -----------------------------------------------------------------------------
// useRef
// -----------------------------------------------------------------------------

/**
 * The purpose of this hook is to allow components to get a reference to a sub
 * html node or component.
 */
export function useRef<T extends HTMLElement = HTMLElement>(name: string): { el: T | null } {
  const node = getCurrent();
  const refs = node.refs;
  return {
    get el(): T | null {
      return refs[name] || null;
    },
  };
}

// -----------------------------------------------------------------------------
// useEnv and useSubEnv
// -----------------------------------------------------------------------------

/**
 * This hook is useful as a building block for some customized hooks, that may
 * need a reference to the env of the component calling them.
 */
export function useEnv<E extends Env>(): E {
  return getCurrent().component.env as any;
}

function extendEnv(currentEnv: Object, extension: Object): Object {
  const env = Object.create(currentEnv);
  const descrs = Object.getOwnPropertyDescriptors(extension);
  return Object.freeze(Object.defineProperties(env, descrs));
}

/**
 * This hook is a simple way to let components use a sub environment.  Note that
 * like for all hooks, it is important that this is only called in the
 * constructor method.
 */
export function useSubEnv(envExtension: Env) {
  const node = getCurrent();
  node.component.env = extendEnv(node.component.env as any, envExtension);
  useChildSubEnv(envExtension);
}

export function useChildSubEnv(envExtension: Env) {
  const node = getCurrent();
  node.childEnv = extendEnv(node.childEnv, envExtension);
}
// -----------------------------------------------------------------------------
// useEffect
// -----------------------------------------------------------------------------

/**
 * @param {...any} dependencies the dependencies computed by computeDependencies
 * @returns {void|(()=>void)} a cleanup function that reverses the side
 *      effects of the effect callback.
 */
type Effect = (...dependencies: any[]) => void | (() => void);

/**
 * This hook will run a callback when a component is mounted and patched, and
 * will run a cleanup function before patching and before unmounting the
 * the component.
 *
 * @param {Effect} effect the effect to run on component mount and/or patch
 * @param {()=>any[]} [computeDependencies=()=>[NaN]] a callback to compute
 *      dependencies that will decide if the effect needs to be cleaned up and
 *      run again. If the dependencies did not change, the effect will not run
 *      again. The default value returns an array containing only NaN because
 *      NaN !== NaN, which will cause the effect to rerun on every patch.
 */
export function useEffect(effect: Effect, computeDependencies: () => any[] = () => [NaN]) {
  let cleanup: (() => void) | void;
  let dependencies: any[];
  onMounted(() => {
    dependencies = computeDependencies();
    cleanup = effect(...dependencies);
  });

  onPatched(() => {
    const newDeps = computeDependencies();
    const shouldReapply = newDeps.some((val, i) => val !== dependencies[i]);
    if (shouldReapply) {
      dependencies = newDeps;
      if (cleanup) {
        cleanup();
      }
      cleanup = effect(...dependencies);
    }
  });

  onWillUnmount(() => cleanup && cleanup());
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
  target: EventTarget,
  eventName: string,
  handler: EventListener,
  eventParams?: AddEventListenerOptions
) {
  const node = getCurrent();
  const boundHandler = handler.bind(node.component);
  onMounted(() => target.addEventListener(eventName, boundHandler, eventParams));
  onWillUnmount(() => target.removeEventListener(eventName, boundHandler, eventParams));
}
