import { computed } from "./computed";
import { untrack } from "./computations";
import { effect } from "./effect";
import { onWillDestroy } from "./lifecycle_hooks";
import { useScope } from "./scope";
import { Signal } from "./signal";
import { shallowEqual } from "./utils";

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
 * Runs `callback` whenever the array returned by `dependencies` changes.
 * Contrary to `useEffect`, only the `dependencies` function is tracked:
 * reactive values read inside `callback` do not become dependencies, so the
 * callback cannot retrigger itself.
 *
 * The dependency array is compared with `shallowEqual`, so `callback` only
 * runs when one of the values it receives actually changed: with
 * `() => [count() > 10]`, `count` going from 2 to 3 does not run it.
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
  // `dependencies` re-runs whenever any reactive value it reads changes, but
  // the structural equality discards a result equal to the previous one, so the
  // effect below is not notified when the dependency values are unchanged.
  const deps = computed(dependencies, { equals: shallowEqual });
  let skipRun = !initialRun;
  useEffect(() => {
    // Reading the dependencies is the only tracked part of this effect.
    const args = deps();
    if (skipRun) {
      skipRun = false;
      return;
    }
    return untrack(() => callback(...args));
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
 * An event already being dispatched when the listener is attached is never
 * delivered to `handler` (see `currentEvent`).
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
        const listener = makeListener(handler);
        el.addEventListener(eventName, listener, eventParams);
        return () => el.removeEventListener(eventName, listener, eventParams);
      }
      return;
    });
  } else {
    const listener = makeListener(handler);
    target.addEventListener(eventName, listener, eventParams);
    onWillDestroy(() => target.removeEventListener(eventName, listener, eventParams));
  }
}

/**
 * The last native event owl started dispatching. Kept past the end of its own
 * handler, since a component created by that handler is set up a few microtasks
 * later, while the event is still bubbling. Nothing clears it, and an `Event`
 * keeps its `target` alive, hence the `WeakRef`.
 */
let currentEvent: WeakRef<Event> | null = null;

export function setCurrentEvent(ev: Event): void {
  if (currentEvent?.deref() !== ev) {
    currentEvent = new WeakRef(ev);
  }
}

function makeListener(handler: EventListener): EventListener {
  const attachedDuring = currentEvent?.deref();
  return function (this: EventTarget, ev: Event) {
    if (ev === attachedDuring) {
      return;
    }
    setCurrentEvent(ev);
    handler.call(this, ev);
  };
}

// -----------------------------------------------------------------------------
// useApp
// -----------------------------------------------------------------------------

export function useApp(): any {
  return useScope().app;
}
