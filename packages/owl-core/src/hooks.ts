import { untrack } from "./computations";
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
// useOnChange
// -----------------------------------------------------------------------------

type Cleanup = (() => void) | void;

/**
 * Identity mapped type over a tuple. It keeps the type of each position when
 * `callback` is contextually typed, while preventing typescript from inferring
 * the dependency tuple from `callback`'s own (possibly shorter) parameter list.
 */
type Args<T extends unknown[]> = { [K in keyof T]: T[K] };

/**
 * Runs `callback` whenever one of the reactive values read by `dependencies`
 * changes. Contrary to `useEffect`, only the `dependencies` function is
 * tracked: reactive values read inside `callback` do not become dependencies,
 * so the callback cannot retrigger itself.
 *
 * `dependencies` must return an array of values, which are spread as the
 * arguments of `callback`. As with `useEffect`, if `callback` returns a
 * function, that function is called as cleanup before the next run and when
 * the owning scope is destroyed.
 *
 * By default the callback also runs on the initial execution. Pass
 * `{ initialRun: false }` to only react to subsequent changes.
 *
 * Example — refetch a record whenever its id changes, without subscribing to
 * everything `loadRecord` happens to read:
 *   useOnChange(
 *     () => [this.props.recordId],
 *     (recordId) => {
 *       this.loadRecord(recordId);
 *     }
 *   );
 */
export function useOnChange<T extends unknown[]>(
  // the variadic tuple `[...T]` (instead of a plain `T`) makes typescript infer
  // a tuple from the returned array literal, so each argument of `callback`
  // keeps its own type
  dependencies: () => [...T],
  callback: (...args: Args<T>) => Cleanup,
  { initialRun = true }: { initialRun?: boolean } = {}
): void {
  let skipRun = !initialRun;
  useEffect(() => {
    // Reading the dependencies is the only tracked part of this effect.
    const deps = dependencies();
    if (skipRun) {
      skipRun = false;
      return;
    }
    return untrack(() => callback(...deps));
  });
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
