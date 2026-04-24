import { batched } from "./batched";

export interface ReactiveValue<TRead, TWrite = TRead> {
  (): TRead;
  /**
   * Update the value of the reactive with a new value. If the new value is different
   * from the previous values, all computations that depends on this reactive will
   * be invalidated, and effects will rerun.
   */
  set(nextValue: TWrite): void;
}

export enum ComputationState {
  EXECUTED = 0,
  STALE = 1,
  PENDING = 2,
}

export interface Atom<T = any> {
  observers: Set<ComputationAtom>;
  value: T;
}

export interface ComputationAtom<T = any> extends Atom<T> {
  compute: () => T;
  isDerived: boolean;
  sources: Set<Atom>;
  state: ComputationState;
  // Lower values run first when processEffects flushes. Used by owl-runtime
  // to schedule component renders in depth order (ancestors first), so a
  // parent's render can cancel orphaned children before the children's own
  // render effect would crash on intermediate state. Observers with no
  // explicit priority run after all prioritized ones, in insertion order.
  priority?: number;
}

export const atomSymbol = Symbol("Atom");

let observers: ComputationAtom[] = [];
let currentComputation: ComputationAtom | undefined;

export function createComputation(
  compute: () => any,
  isDerived: boolean,
  state: ComputationState = ComputationState.STALE,
  priority?: number
): ComputationAtom {
  return {
    state,
    value: undefined,
    compute,
    sources: new Set(),
    observers: new Set(),
    isDerived,
    priority,
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
    if (ctx.state === ComputationState.EXECUTED) {
      if (ctx.isDerived) {
        markDownstream(ctx);
      } else {
        observers.push(ctx);
      }
    }
    ctx.state = ComputationState.STALE;
  }
  batchProcessEffects();
}

const batchProcessEffects = batched(processEffects);
/**
 * Synchronously run every queued effect (the non-derived computations that
 * have been marked stale since the last drain). The normal flush path is
 * the microtask scheduled by `batched`; this export lets a host like the
 * Owl scheduler drain mid-tick — e.g. between the render pass and the
 * commit pass — so that signal writes performed during a render don't push
 * the dependent re-render to the next scheduler tick.
 */
export function processEffects() {
  // Sort by priority (undefined → end) so owl-runtime can guarantee that
  // ancestor component renders run before descendant renders within the
  // same microtask batch.
  observers.sort(compareByPriority);
  for (let i = 0; i < observers.length; i++) {
    updateComputation(observers[i]);
  }
  observers.length = 0;
}

function compareByPriority(a: ComputationAtom, b: ComputationAtom): number {
  const pa = a.priority;
  const pb = b.priority;
  if (pa === pb) return 0;
  if (pa === undefined) return 1;
  if (pb === undefined) return -1;
  return pa - pb;
}

export function getCurrentComputation() {
  return currentComputation;
}

export function setComputation(computation: ComputationAtom | undefined) {
  currentComputation = computation;
}

export function updateComputation(computation: ComputationAtom) {
  const state = computation.state;
  if (state === ComputationState.EXECUTED) {
    return;
  }
  if (state === ComputationState.PENDING) {
    for (const source of computation.sources) {
      if (!("compute" in source)) {
        continue;
      }
      updateComputation(source as ComputationAtom);
    }
    // If the state is still not stale after processing the sources, it means
    // none of the dependencies have changed.
    // todo: test it
    if (computation.state !== ComputationState.STALE) {
      computation.state = ComputationState.EXECUTED;
      return;
    }
  }
  // todo: test performance. We might want to avoid removing the atoms to
  // directly re-add them at compute. Especially as we are making them stale.
  removeSources(computation);
  const previousComputation = currentComputation;
  currentComputation = computation;
  computation.value = computation.compute();
  computation.state = ComputationState.EXECUTED;
  currentComputation = previousComputation;
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
  for (const source of computation.sources) {
    source.observers.delete(computation);
    // Recursively dispose derived computations that lost all observers
    if (
      "compute" in source &&
      (source as ComputationAtom).isDerived &&
      source.observers.size === 0
    ) {
      disposeComputation(source as ComputationAtom);
    }
  }
  computation.sources.clear();
  // Mark as stale so it recomputes correctly if ever re-used (shared computed case)
  computation.state = ComputationState.STALE;
}

function markDownstream(computation: ComputationAtom) {
  const stack: ComputationAtom[] = [computation];
  let current: ComputationAtom | undefined;
  while ((current = stack.pop())) {
    for (const observer of current.observers) {
      if (observer.state) {
        continue;
      }
      observer.state = ComputationState.PENDING;
      if (observer.isDerived) {
        stack.push(observer);
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
