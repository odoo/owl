import { effect } from "./effect";
import { onWillDestroy } from "./lifecycle_hooks";
import { useScope } from "./scope";
import { Signal } from "./signal";

// -----------------------------------------------------------------------------
// useEffect
// -----------------------------------------------------------------------------

/**
 * Creates a reactive effect bound to the surrounding component or plugin.
 * Equivalent to `onWillDestroy(effect(fn))`: the effect runs once immediately,
 * re-runs whenever any reactive value (signal, computed, proxy property) read
 * during its execution changes, and is disposed when the owning scope is
 * destroyed. If the callback returns a function, that function is called as
 * cleanup before each re-run and on disposal.
 */
export function useEffect(fn: Parameters<typeof effect>[0]): void {
  onWillDestroy(effect(fn));
}

// -----------------------------------------------------------------------------
// useListener
// -----------------------------------------------------------------------------

/**
 * Adds an event listener to a target and automatically removes it when the
 * surrounding component or plugin is destroyed.
 *
 * `target` can be either an `EventTarget` (the listener is attached
 * immediately) or a `Signal<EventTarget | null>` such as a `t-ref` (the
 * listener is attached through a `useEffect` and re-attaches when the signal's
 * value changes; nothing is attached while the signal is null).
 *
 * The handler is not bound: it is passed as-is to `addEventListener`, so inside
 * it `this` is the event target, not the calling component. Wrap a method in an
 * arrow function (or bind it) if it relies on `this`.
 *
 * Example — close a menu when the user clicks anywhere on `window`:
 *   useListener(window, "click", () => this.close());
 */
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
