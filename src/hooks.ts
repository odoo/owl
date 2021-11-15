import type { Env } from "./app/app";
import { getCurrent } from "./component/component_node";
import { onMounted, onPatched, onWillPatch, onWillUnmount } from "./component/lifecycle_hooks";

// -----------------------------------------------------------------------------
// useRef
// -----------------------------------------------------------------------------

/**
 * The purpose of this hook is to allow components to get a reference to a sub
 * html node or component.
 */
export function useRef<T extends HTMLElement = HTMLElement>(name: string): { el: T | null } {
  const node = getCurrent()!;
  return {
    get el(): T | null {
      return node.refs[name] || null;
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
  return getCurrent()!.component.env as any;
}

/**
 * This hook is a simple way to let components use a sub environment.  Note that
 * like for all hooks, it is important that this is only called in the
 * constructor method.
 */
export function useSubEnv(envExtension: Env) {
  const node = getCurrent()!;
  node.childEnv = Object.freeze(Object.assign({}, node.childEnv, envExtension));
}

// -----------------------------------------------------------------------------
// useEffect
// -----------------------------------------------------------------------------

const NO_OP = () => {};
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
  let cleanup: () => void;
  let dependencies: any[];
  onMounted(() => {
    dependencies = computeDependencies();
    cleanup = effect(...dependencies) || NO_OP;
  });

  let shouldReapplyOnPatch = false;
  onWillPatch(() => {
    const newDeps = computeDependencies();
    shouldReapplyOnPatch = newDeps.some((val, i) => val !== dependencies[i]);
    if (shouldReapplyOnPatch) {
      cleanup();
      dependencies = newDeps;
    }
  });
  onPatched(() => {
    if (shouldReapplyOnPatch) {
      cleanup = effect(...dependencies) || NO_OP;
    }
  });

  onWillUnmount(() => cleanup());
}
