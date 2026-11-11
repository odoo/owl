import { batched } from "./batched";

export interface ReactiveValue<TRead, TWrite = TRead> {
  (): TRead;
  /**
   * Update the value of the reactive with a new value. If the new value is different
   * from the previous values, all computations that depends on this reactive will
   * be invalidated, and effects will rerun.
   *
   * Absent on a read-only reactive value: read-only is checked by the absence of `set`.
   */
  set?(nextValue: TWrite): void;
}

export interface WritableReactiveValue<TRead, TWrite = TRead>
  extends ReactiveValue<TRead, TWrite> {
  set(nextValue: TWrite): void;
}

/**
 * The `equals` option accepted by `signal` and `computed`: a custom equality
 * used to decide whether a new value should notify observers. Defaults to
 * `Object.is`. Pass `false` to disable the check entirely (every write or
 * recompute notifies, even with an identical value — useful for values that
 * are mutated in place). The function receives (previous, next) and runs
 * untracked: it can safely read reactive values without subscribing to them.
 */
export type Equals<T> = false | ((a: T, b: T) => boolean);

function neverEqual() {
  return false;
}

export function toEqualsFn<T>(equals: Equals<T> | undefined): (a: T, b: T) => boolean {
  if (equals === false) {
    return neverEqual;
  }
  if (!equals) {
    return Object.is;
  }
  // A custom equals runs while tracking may be active (inside a computed's
  // recompute, or a signal set() issued from an effect): run it untracked so
  // reading through reactive proxies does not register spurious dependencies
  // on the active computation.
  return (a, b) => {
    const previousComputation = currentComputation;
    currentComputation = undefined;
    try {
      return equals(a, b);
    } finally {
      currentComputation = previousComputation;
    }
  };
}

/**
 * `ComputationAtom.flags` packs the mutable state (low two bits) with two
 * immutable kind bits, so a notified observer is classified from a single
 * property read. EXECUTED is 0: "needs an update" is `flags & STATE_MASK`, and
 * clearing the state bits marks a computation as executed.
 */
export enum ComputationFlags {
  EXECUTED = 0,
  STALE = 1,
  PENDING = 2,
  STATE_MASK = 3,
  // Produced by `computed`: lazy, pulled by its readers, notifies downstream.
  DERIVED = 4,
  // Effect that re-runs synchronously in the write that invalidated it,
  // instead of being batched in the microtask flush (see `immediateEffect`).
  IMMEDIATE = 8,
}

export interface Atom<T = any> {
  observers: Set<ComputationAtom>;
  value: T;
}

export interface ComputationAtom<T = any> extends Atom<T> {
  compute: () => T;
  sources: Set<Atom>;
  // a combination of ComputationFlags
  flags: number;
}

export const atomSymbol = Symbol("Atom");

let observers: ComputationAtom[] = [];
let immediateObservers: ComputationAtom[] = [];
let currentComputation: ComputationAtom | undefined;
// Derived computations that were notified of a write while nothing observed
// them. Left alone, they would stay subscribed to their sources forever (a
// lazy computed with no observer never re-runs, so removeSources never fires
// for it): a long-lived signal would retain every discarded computed that
// ever read it. Disposal is deferred to the effect flush because "unobserved"
// can be transient — an effect queued by the same write may re-subscribe, and
// a computation being pulled lazily is unobserved while it recomputes — so
// the flush re-checks before disposing.
let pendingDisposals = new Set<ComputationAtom>();

export function createComputation(
  compute: () => any,
  flags: number = ComputationFlags.STALE
): ComputationAtom {
  return {
    flags,
    value: undefined,
    compute,
    sources: new Set(),
    observers: new Set(),
  };
}

export function onReadAtom(atom: Atom) {
  if (!currentComputation) {
    return;
  }
  currentComputation.sources.add(atom);
  atom.observers.add(currentComputation);
}

export function onWriteAtom(atom: Atom) {
  for (const ctx of atom.observers) {
    const flags = ctx.flags;
    if (!(flags & ComputationFlags.STATE_MASK)) {
      // EXECUTED
      if (flags & ComputationFlags.DERIVED) {
        markDownstream(ctx);
      } else if (flags & ComputationFlags.IMMEDIATE) {
        immediateObservers.push(ctx);
      } else {
        observers.push(ctx);
      }
    }
    ctx.flags = (flags & ~ComputationFlags.STATE_MASK) | ComputationFlags.STALE;
    if (flags & ComputationFlags.DERIVED && ctx.observers.size === 0) {
      pendingDisposals.add(ctx);
    }
  }
  let hasError = false;
  let error: unknown;
  if (immediateObservers.length) {
    // Swap the queue out before running: an immediate effect may itself write
    // an atom, and that nested onWriteAtom collects and flushes its own queue.
    const toRun = immediateObservers;
    immediateObservers = [];
    for (let i = 0; i < toRun.length; i++) {
      try {
        updateComputation(toRun[i]);
      } catch (e) {
        if (!hasError) {
          hasError = true;
          error = e;
        }
      }
    }
  }
  batchProcessEffects();
  if (hasError) {
    throw error;
  }
}

const batchProcessEffects = batched(processEffects);
function processEffects() {
  const pending = observers;
  observers = [];
  let hasError = false;
  let error: unknown;
  for (let i = 0; i < pending.length; i++) {
    try {
      updateComputation(pending[i]);
    } catch (e) {
      if (!hasError) {
        hasError = true;
        error = e;
      }
    }
  }
  if (pendingDisposals.size !== 0) {
    const candidates = pendingDisposals;
    pendingDisposals = new Set();
    for (const computation of candidates) {
      // Re-check: the effects above (or any read since the write) may have
      // re-subscribed to the candidate. Disposing an unobserved derived is
      // safe: it is already STALE, so a later read fully recomputes it and
      // re-subscribes to whatever it reads.
      if (computation.observers.size === 0) {
        disposeComputation(computation);
      }
    }
  }
  if (hasError) {
    throw error;
  }
}

export function getCurrentComputation() {
  return currentComputation;
}

export function setComputation(computation: ComputationAtom | undefined) {
  currentComputation = computation;
}

export function updateComputation(computation: ComputationAtom) {
  const state = computation.flags & ComputationFlags.STATE_MASK;
  if (state === ComputationFlags.EXECUTED) {
    return;
  }
  if (state === ComputationFlags.PENDING) {
    for (const source of computation.sources) {
      if (!("compute" in source)) {
        continue;
      }
      updateComputation(source as ComputationAtom);
      // As soon as a source's recompute has marked us STALE (via onWriteAtom),
      // we already know this computation must re-run. Stop probing the rest of
      // the sources: any work they'd do is redundant, and worse, evaluating
      // them eagerly can surface errors from values the about-to-run body will
      // not actually read (e.g. an `if (lastValue()) uppercase()` guard whose
      // upstream signal just went falsy).
      if ((computation.flags & ComputationFlags.STATE_MASK) === ComputationFlags.STALE) {
        break;
      }
    }
    // If the state is still not stale after processing the sources, none of
    // the dependencies have actually changed.
    if ((computation.flags & ComputationFlags.STATE_MASK) !== ComputationFlags.STALE) {
      computation.flags &= ~ComputationFlags.STATE_MASK; // EXECUTED
      return;
    }
  }
  // todo: test performance. We might want to avoid removing the atoms to
  // directly re-add them at compute. Especially as we are making them stale.
  removeSources(computation);
  const previousComputation = currentComputation;
  currentComputation = computation;
  try {
    computation.value = computation.compute();
  } finally {
    // mark executed even after a throw, as onWriteAtom only notifies an executed computation
    computation.flags &= ~ComputationFlags.STATE_MASK;
    // Restore the previous tracking pointer even if compute() threw, so a
    // subsequent atom read does not silently attach itself as a source of
    // the failed computation.
    currentComputation = previousComputation;
  }
}

export function removeSources(computation: ComputationAtom) {
  const sources = computation.sources;
  for (const source of sources) {
    const observers = source.observers;
    observers.delete(computation);
    // todo: if source has no effect observer anymore, remove its sources too
    // todo: test it
  }
  sources.clear();
}

export function disposeComputation(computation: ComputationAtom) {
  const sources = computation.sources;
  for (const source of sources) {
    source.observers.delete(computation);
    // Recursively dispose derived computations that lost all observers.
    // Only ComputationAtoms produced by `computed` carry the DERIVED flag (a
    // plain atom has no `flags` at all), so this check also acts as the "is
    // this a ComputationAtom?" discriminator that the previous
    // `"compute" in source` test served.
    const derived = source as ComputationAtom;
    if (derived.flags & ComputationFlags.DERIVED && derived.observers.size === 0) {
      disposeComputation(derived);
    }
  }
  sources.clear();
  // Mark as stale so it recomputes correctly if ever re-used (shared computed case)
  computation.flags = (computation.flags & ~ComputationFlags.STATE_MASK) | ComputationFlags.STALE;
}

function markDownstream(computation: ComputationAtom) {
  const stack: ComputationAtom[] = [computation];
  let current: ComputationAtom | undefined;
  while ((current = stack.pop())) {
    for (const observer of current.observers) {
      const flags = observer.flags;
      // Collect dead branches before the staleness short-circuit below: an
      // already-stale unobserved derived still needs to be unsubscribed.
      if (flags & ComputationFlags.DERIVED && observer.observers.size === 0) {
        pendingDisposals.add(observer);
      }
      if (flags & ComputationFlags.STATE_MASK) {
        continue;
      }
      // the state bits are 0 (EXECUTED) here
      observer.flags = flags | ComputationFlags.PENDING;
      if (flags & ComputationFlags.DERIVED) {
        stack.push(observer);
      } else if (flags & ComputationFlags.IMMEDIATE) {
        immediateObservers.push(observer);
      } else {
        observers.push(observer);
      }
    }
  }
}

export function untrack<T>(fn: (...args: any[]) => T): T {
  const previousComputation = currentComputation;
  currentComputation = undefined;
  let result: T;
  try {
    result = fn();
  } finally {
    currentComputation = previousComputation;
  }
  return result;
}
