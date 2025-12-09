import { getCurrent } from "./component_node";
import { onMounted, onPatched, onWillDestroy, onWillUnmount } from "./lifecycle_hooks";
import { PluginConstructor, PluginManager } from "./plugins";
import { runWithComputation } from "./reactivity/computations";
import { inOwnerDocument } from "./utils";

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
      const el = refs[name];
      return inOwnerDocument(el) ? el : null;
    },
  };
}

// -----------------------------------------------------------------------------
// useEffect
// -----------------------------------------------------------------------------

type EffectDeps<T extends unknown[]> = T | (T extends [...infer H, never] ? EffectDeps<H> : never);

/**
 * @template T
 * @param {...T} dependencies the dependencies computed by computeDependencies
 * @returns {void|(()=>void)} a cleanup function that reverses the side
 *      effects of the effect callback.
 */
type Effect<T extends unknown[]> = (...dependencies: EffectDeps<T>) => void | (() => void);

/**
 * This hook will run a callback when a component is mounted and patched, and
 * will run a cleanup function before patching and before unmounting the
 * the component.
 *
 * @template T
 * @param {Effect<T>} effect the effect to run on component mount and/or patch
 * @param {()=>[...T]} [computeDependencies=()=>[NaN]] a callback to compute
 *      dependencies that will decide if the effect needs to be cleaned up and
 *      run again. If the dependencies did not change, the effect will not run
 *      again. The default value returns an array containing only NaN because
 *      NaN !== NaN, which will cause the effect to rerun on every patch.
 */
export function useEffect<T extends unknown[]>(
  effect: Effect<T>,
  computeDependencies: () => [...T] = () => [NaN] as never
) {
  const context = getCurrent().component.__owl__.signalComputation;

  let cleanup: (() => void) | void;

  let dependencies: any;
  const runEffect = () =>
    runWithComputation(context, () => {
      cleanup = effect(...dependencies);
    });
  const computeDependenciesWithContext = () => runWithComputation(context, computeDependencies);

  onMounted(() => {
    dependencies = computeDependenciesWithContext();
    runEffect();
  });

  onPatched(() => {
    const newDeps = computeDependenciesWithContext();
    const shouldReapply = newDeps.some((val: any, i: number) => val !== dependencies[i]);
    if (shouldReapply) {
      dependencies = newDeps;
      if (cleanup) {
        cleanup();
      }
      runEffect();
    }
  });

  onWillUnmount(() => cleanup && cleanup());
}

// -----------------------------------------------------------------------------
// useListener
// -----------------------------------------------------------------------------

/**
 * When a component needs to listen to DOM Events on element(s) that are not
 * part of his hierarchy, we can use the `useListener` hook.
 * It will correctly add and remove the event listener, whenever the
 * component is mounted and unmounted.
 *
 * Example:
 *  a menu needs to listen to the click on window to be closed automatically
 *
 * Usage:
 *  in the constructor of the OWL component that needs to be notified,
 *  `useListener(window, 'click', this._doSomething);`
 * */
export function useListener(
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

export function usePlugins(Plugins: PluginConstructor[]) {
  const node = getCurrent();

  const manager = new PluginManager(node.pluginManager);
  node.pluginManager = manager;
  onWillDestroy(() => manager.destroy());

  return manager.startPlugins(Plugins);
}
