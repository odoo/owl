import { effect } from "./effect";
import { onWillDestroy } from "./lifecycle_hooks";
import { useScope } from "./scope";
import { Signal } from "./signal";

// -----------------------------------------------------------------------------
// useEffect
// -----------------------------------------------------------------------------

export function useEffect(fn: Parameters<typeof effect>[0]): void {
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
): void {
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

// -----------------------------------------------------------------------------
// useApp
// -----------------------------------------------------------------------------

export function useApp(): any {
  return useScope().app;
}
