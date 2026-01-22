import { App } from "./app";
import { getCurrent } from "./component_node";
import { onWillDestroy } from "./lifecycle_hooks";
import { GetPluginInputs, PluginConstructor, PluginManager } from "./plugins";
import { effect } from "./reactivity/effect";
import { Signal } from "./reactivity/signal";

// -----------------------------------------------------------------------------
// useEffect
// -----------------------------------------------------------------------------

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
export function useEffect(fn: Parameters<typeof effect>[0]) {
  onWillDestroy(effect(fn));
}

// -----------------------------------------------------------------------------
// useListener
// -----------------------------------------------------------------------------

/**
 * When a component needs to listen to DOM Events on element(s) that are not
 * part of his hierarchy, we can use the `useListener` hook.
 * It will immediately add the listener, and remove it whenever the plugin or
 * component is destroyed.
 *
 * Example:
 *  a menu needs to listen to the click on window to be closed automatically
 *
 * Usage:
 *  in the constructor of the OWL component that needs to be notified,
 *  `useListener(window, 'click', () => this._doSomething());`
 * */
export function useListener(
  target: EventTarget | Signal<EventTarget | null>,
  eventName: string,
  handler: EventListener,
  eventParams?: AddEventListenerOptions
) {
  if (typeof target === "function") {
    // this is a ref
    useEffect(() => {
      const el = target();
      if (el) {
        el.addEventListener(eventName, handler, eventParams);
        return () => el.removeEventListener(eventName, handler, eventParams);
      }
      return;
    });
  } else {
    target.addEventListener(eventName, handler, eventParams);
    onWillDestroy(() => target.removeEventListener(eventName, handler, eventParams));
  }
}

type GetPluginsInputs<T extends PluginConstructor[]> = {
    [I in keyof T]: (x: GetPluginInputs<InstanceType<T[I]>>) => void;
} extends {
  [K: number]: (x: infer I) => void
} ? I : never;
type PrettifyShape<T> = T extends Function ? T : { [K in keyof T]: T[K] };

export function providePlugins<const P extends PluginConstructor[]>(Plugins: P, inputs?: PrettifyShape<GetPluginsInputs<P>>) {
  const node = getCurrent();

  const manager = new PluginManager({ parent: node.pluginManager, inputs });
  node.pluginManager = manager;
  onWillDestroy(() => manager.destroy());

  return manager.startPlugins(Plugins);
}

// -----------------------------------------------------------------------------
// useApp
// -----------------------------------------------------------------------------

export function useApp(): App {
  if (App.__current) {
    return App.__current;
  }
  const node = getCurrent();
  return node.app;
}
