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
  // Positional dependency tracking: sourcesList records the atoms in read
  // order (duplicates included). On a re-run, reads are matched against it
  // position by position; while they match, the existing subscriptions are
  // reused with no Set operation at all. On the first mismatch the run
  // switches to recording mode (trackDiverged) and the links are reconciled
  // in finishTracking.
  sourcesList: Atom[];
  trackIndex: number;
  trackDiverged: boolean;
  newSources: Atom[];
}

export const atomSymbol = Symbol("Atom");

let observers: ComputationAtom[] = [];
let currentComputation: ComputationAtom | undefined;

export function createComputation(
  compute: () => any,
  isDerived: boolean,
  state: ComputationState = ComputationState.STALE
): ComputationAtom {
  return {
    state,
    value: undefined,
    compute,
    sources: new Set(),
    observers: new Set(),
    isDerived,
    sourcesList: [],
    trackIndex: 0,
    trackDiverged: true,
    newSources: [],
  };
}

export function onReadAtom(atom: Atom) {
  const computation = currentComputation;
  if (!computation) {
    return;
  }
  if (!computation.trackDiverged) {
    const list = computation.sourcesList;
    const i = computation.trackIndex;
    if (i < list.length && list[i] === atom) {
      computation.trackIndex = i + 1;
      return;
    }
    // The read sequence no longer matches the previous run: switch to
    // recording mode, keeping the already-matched prefix.
    computation.trackDiverged = true;
    computation.newSources = list.slice(0, i);
  }
  computation.newSources.push(atom);
  computation.sources.add(atom);
  atom.observers.add(computation);
}

/**
 * Start a tracking run for the given computation, reusing the source links
 * from its previous run for as long as reads arrive in the same order.
 * Must be paired with finishTracking.
 */
export function startTracking(computation: ComputationAtom) {
  computation.trackIndex = 0;
  computation.trackDiverged = computation.sourcesList.length === 0;
  if (computation.trackDiverged) {
    computation.newSources = [];
  }
}

/**
 * Reconcile the source links after a tracking run: unsubscribe from sources
 * that were not read this run, and commit the new read list.
 */
export function finishTracking(computation: ComputationAtom) {
  if (!computation.trackDiverged) {
    if (computation.trackIndex === computation.sourcesList.length) {
      // Exact same reads as last run: all links are already correct.
      return;
    }
    // Read a strict prefix of the previous run: drop the tail.
    computation.newSources = computation.sourcesList.slice(0, computation.trackIndex);
    computation.trackDiverged = true;
  }
  const newList = computation.newSources;
  if (computation.sourcesList.length === 0) {
    // First run (or run right after a full teardown): there were no previous
    // links, so nothing can be stale. `sources` was filled during recording
    // and is already exact.
    computation.sourcesList = newList;
    computation.newSources = [];
    return;
  }
  const newSet = new Set(newList);
  for (const source of computation.sources) {
    if (!newSet.has(source)) {
      source.observers.delete(computation);
    }
  }
  computation.sources = newSet;
  computation.sourcesList = newList;
  computation.newSources = [];
}

export function onWriteAtom(atom: Atom) {
  if (atom.observers.size !== 0) {
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
  }
  // Only schedule a flush when an effect was actually queued (here or by an
  // earlier write in the same batch): writes to unobserved atoms, or atoms
  // only observed by derived computations, have nothing to process.
  if (observers.length !== 0) {
    batchProcessEffects();
  }
}

const batchProcessEffects = batched(processEffects);
function processEffects() {
  const pending = observers;
  observers = [];
  for (let i = 0; i < pending.length; i++) {
    updateComputation(pending[i]);
  }
}

export function getCurrentComputation() {
  return currentComputation;
}

export function hasCurrentComputation(): boolean {
  return currentComputation !== undefined;
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
      // Plain atoms have no compute: a property load is cheaper than `in`.
      if ((source as ComputationAtom).compute === undefined) {
        continue;
      }
      updateComputation(source as ComputationAtom);
      // As soon as a source's recompute has marked us STALE (via onWriteAtom),
      // we already know this computation must re-run. Stop probing the rest of
      // the sources: any work they'd do is redundant, and worse, evaluating
      // them eagerly can surface errors from values the about-to-run body will
      // not actually read (e.g. an `if (lastValue()) uppercase()` guard whose
      // upstream signal just went falsy).
      if (computation.state === ComputationState.STALE) {
        break;
      }
    }
    // If the state is still not stale after processing the sources, none of
    // the dependencies have actually changed.
    if (computation.state !== ComputationState.STALE) {
      computation.state = ComputationState.EXECUTED;
      return;
    }
  }
  startTracking(computation);
  const previousComputation = currentComputation;
  currentComputation = computation;
  try {
    computation.value = computation.compute();
    computation.state = ComputationState.EXECUTED;
  } finally {
    // Reconcile subscriptions even if compute() threw (only the reads that
    // actually happened count as sources), and restore the previous tracking
    // pointer so a subsequent atom read does not silently attach itself as a
    // source of the failed computation.
    finishTracking(computation);
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
  // Leave the computation in recording mode: callers may start reading right
  // after removeSources without going through startTracking.
  computation.sourcesList = [];
  computation.newSources = [];
  computation.trackIndex = 0;
  computation.trackDiverged = true;
}

export function disposeComputation(computation: ComputationAtom) {
  const sources = computation.sources;
  for (const source of sources) {
    source.observers.delete(computation);
    // Recursively dispose derived computations that lost all observers.
    // `isDerived` is only set on ComputationAtoms produced by `computed`, so
    // this check also acts as the "is this a ComputationAtom?" discriminator
    // that the previous `"compute" in source` test served.
    const derived = source as ComputationAtom;
    if (derived.isDerived && derived.observers.size === 0) {
      disposeComputation(derived);
    }
  }
  sources.clear();
  computation.sourcesList = [];
  computation.newSources = [];
  computation.trackIndex = 0;
  computation.trackDiverged = true;
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
