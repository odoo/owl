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
}

// Most graph nodes have zero or one edge. Store those cases directly, use an
// ordered array for small collections, and switch to a Set for larger fanout.
// Nodes and edges remain ordinary GC-owned objects: no global arena retains
// discarded signals or their values.
type Edges<T> = T | T[] | Set<T> | null;
const ARRAY_LIMIT = 16;
const DERIVED = 1;
export const HAS_VALUE = 2;

export class AtomNode<T = any> implements Atom<T> {
  declare value: T;
  declare observerEdges: Edges<ComputationAtom>;

  constructor(value: T) {
    this.value = value;
    this.observerEdges = null;
  }

  // Preserve the low-level API. Materialize a native, mutable Set only when
  // callers inspect it; all subsequent tracking uses that same Set.
  get observers(): Set<ComputationAtom> {
    return (this.observerEdges = asSet(this.observerEdges));
  }

  set observers(observers: Set<ComputationAtom>) {
    this.observerEdges = observers;
  }
}

export class ComputationNode<T = any> extends AtomNode<T> implements ComputationAtom<T> {
  declare compute: () => T;
  // Keep state directly readable on cached reads. The two boolean flags share
  // a word; packing state too made the cached-read path slower in measurements.
  declare state: ComputationState;
  declare flags: number;
  declare sourceEdges: Edges<Atom>;

  constructor(
    compute: () => T,
    isDerived: boolean,
    state: ComputationState = ComputationState.STALE
  ) {
    super(undefined as T);
    this.compute = compute;
    this.state = state;
    this.flags = isDerived ? DERIVED : 0;
    this.sourceEdges = null;
  }

  get isDerived(): boolean {
    return (this.flags & DERIVED) !== 0;
  }

  set isDerived(isDerived: boolean) {
    this.flags = isDerived ? this.flags | DERIVED : this.flags & ~DERIVED;
  }

  get sources(): Set<Atom> {
    return (this.sourceEdges = asSet(this.sourceEdges));
  }

  set sources(sources: Set<Atom>) {
    this.sourceEdges = sources;
  }
}

function asSet<T>(edges: Edges<T>): Set<T> {
  if (edges instanceof Set) return edges;
  return new Set(edges === null ? [] : Array.isArray(edges) ? edges : [edges]);
}

function addEdge<T>(edges: Edges<T>, value: T): Edges<T> {
  if (edges === null) return value;
  if (Array.isArray(edges)) {
    if (!edges.includes(value)) {
      if (edges.length === ARRAY_LIMIT) return new Set([...edges, value]);
      edges.push(value);
    }
    return edges;
  }
  if (edges instanceof Set) {
    edges.add(value);
    return edges;
  }
  return edges === value ? edges : [edges, value];
}

function deleteEdge<T>(edges: Edges<T>, value: T): Edges<T> {
  if (edges === value) return null;
  if (Array.isArray(edges)) {
    const index = edges.indexOf(value);
    if (index !== -1) edges.splice(index, 1);
    return edges.length === 1 ? edges[0] : edges.length === 0 ? null : edges;
  }
  if (edges instanceof Set) edges.delete(value);
  return edges;
}

function hasEdge<T>(edges: Edges<T>, value: T): boolean {
  if (edges === value) return true;
  if (Array.isArray(edges)) return edges.includes(value);
  return edges instanceof Set && edges.has(value);
}

export function getObserverEdges(atom: Atom): Edges<ComputationAtom> {
  const edges = (atom as AtomNode).observerEdges;
  return edges === undefined ? atom.observers : edges;
}

function getSourceEdges(computation: ComputationAtom): Edges<Atom> {
  const edges = (computation as ComputationNode).sourceEdges;
  return edges === undefined ? computation.sources : edges;
}

export function observerCount(atom: Atom): number {
  const edges = getObserverEdges(atom);
  return edges === null
    ? 0
    : Array.isArray(edges)
      ? edges.length
      : edges instanceof Set
        ? edges.size
        : 1;
}

export function addObserver(atom: Atom, observer: ComputationAtom) {
  const edges = getObserverEdges(atom);
  const next = addEdge(edges, observer);
  if ((atom as AtomNode).observerEdges !== undefined) {
    (atom as AtomNode).observerEdges = next;
  }
}

function removeObserver(atom: Atom, observer: ComputationAtom) {
  const next = deleteEdge(getObserverEdges(atom), observer);
  if ((atom as AtomNode).observerEdges !== undefined) {
    (atom as AtomNode).observerEdges = next;
  }
}

export function clearObservers(atom: Atom) {
  const edges = getObserverEdges(atom);
  if (edges instanceof Set) edges.clear();
  else (atom as AtomNode).observerEdges = null;
}

export const atomSymbol = Symbol("Atom");

let observers: ComputationAtom[] = [];
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
  isDerived: boolean,
  state: ComputationState = ComputationState.STALE
): ComputationAtom {
  return new ComputationNode(compute, isDerived, state);
}

export function onReadAtom(atom: Atom) {
  if (currentComputation) trackAtom(atom, currentComputation);
}

function trackAtom(atom: Atom, computation: ComputationAtom) {
  const sources = getSourceEdges(computation);
  // Repeated reads only check the forward edge, rather than adding to both
  // directions of the graph again.
  if (sources === atom) {
    restoreExposedObserver(atom, computation);
    return;
  }
  if (sources instanceof Set) {
    const size = sources.size;
    sources.add(atom);
    if (sources.size === size) {
      restoreExposedObserver(atom, computation);
      return;
    }
  } else {
    if (hasEdge(sources, atom)) {
      restoreExposedObserver(atom, computation);
      return;
    }
    (computation as ComputationNode).sourceEdges = addEdge(sources, atom);
  }
  addObserver(atom, computation);
}

function restoreExposedObserver(atom: Atom, computation: ComputationAtom) {
  // A caller may clear/replace a native observer Set between reads. Restore
  // the reverse edge as before, without hashing compact internal collections.
  const edges = (atom as AtomNode).observerEdges;
  if (edges instanceof Set) edges.add(computation);
  else if (edges === undefined) atom.observers.add(computation);
}

export function onWriteAtom(atom: Atom) {
  const edges = getObserverEdges(atom);
  if (edges === null) return;
  if (Array.isArray(edges) || edges instanceof Set) {
    for (const ctx of edges) invalidate(ctx);
  } else {
    invalidate(edges);
  }
  batchProcessEffects();
}

function invalidate(ctx: ComputationAtom) {
  if (ctx.state === ComputationState.EXECUTED) {
    if (ctx.isDerived) markDownstream(ctx);
    else observers.push(ctx);
  }
  ctx.state = ComputationState.STALE;
  if (ctx.isDerived && observerCount(ctx) === 0) pendingDisposals.add(ctx);
}

const batchProcessEffects = batched(processEffects);
function processEffects() {
  const pending = observers;
  observers = [];
  for (let i = 0; i < pending.length; i++) {
    updateComputation(pending[i]);
  }
  if (pendingDisposals.size !== 0) {
    const candidates = pendingDisposals;
    pendingDisposals = new Set();
    for (const computation of candidates) {
      // Re-check: the effects above (or any read since the write) may have
      // re-subscribed to the candidate. Disposing an unobserved derived is
      // safe: it is already STALE, so a later read fully recomputes it and
      // re-subscribes to whatever it reads.
      if (observerCount(computation) === 0) {
        disposeComputation(computation);
      }
    }
  }
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
    const sources = getSourceEdges(computation);
    if (Array.isArray(sources) || sources instanceof Set) {
      for (const source of sources) {
        if ("compute" in source) updateComputation(source as ComputationAtom);
        // As soon as a source's recompute has marked us STALE (via onWriteAtom),
        // we already know this computation must re-run. Stop probing the rest of
        // the sources: any work they'd do is redundant, and worse, evaluating
        // them eagerly can surface errors from values the about-to-run body will
        // not actually read (e.g. an `if (lastValue()) uppercase()` guard whose
        // upstream signal just went falsy).
        if (computation.state === ComputationState.STALE) break;
      }
    } else if (sources !== null && "compute" in sources) {
      updateComputation(sources as ComputationAtom);
    }
    // If the state is still not stale after processing the sources, none of
    // the dependencies have actually changed.
    if (computation.state !== ComputationState.STALE) {
      computation.state = ComputationState.EXECUTED;
      return;
    }
  }
  let oldSources = getSourceEdges(computation);
  if (oldSources instanceof Set) {
    // Exposed/native sets must keep their identity and reflect reads during
    // compute. Large dependency lists use this path too.
    removeSources(computation);
    oldSources = null;
  } else {
    // Retain subscriptions while collecting the next dependencies. Stable
    // single-source computations need no allocation or unsubscribe/re-add.
    (computation as ComputationNode).sourceEdges = null;
  }
  const previousComputation = currentComputation;
  currentComputation = computation;
  try {
    computation.value = computation.compute();
    computation.state = ComputationState.EXECUTED;
  } finally {
    // Restore the previous tracking pointer even if compute() threw, so a
    // subsequent atom read does not silently attach itself as a source of
    // the failed computation.
    currentComputation = previousComputation;
    if (Array.isArray(oldSources)) {
      for (const source of oldSources) {
        if (!hasEdge(getSourceEdges(computation), source)) removeObserver(source, computation);
      }
    } else if (oldSources !== null && !hasEdge(getSourceEdges(computation), oldSources)) {
      removeObserver(oldSources, computation);
    }
  }
}

export function removeSources(computation: ComputationAtom) {
  const sources = getSourceEdges(computation);
  if (Array.isArray(sources) || sources instanceof Set) {
    for (const source of sources) removeObserver(source, computation);
  } else if (sources !== null) {
    removeObserver(sources, computation);
  }
  if (sources instanceof Set) sources.clear();
  else (computation as ComputationNode).sourceEdges = null;
}

export function disposeComputation(computation: ComputationAtom) {
  const sources = getSourceEdges(computation);
  if (Array.isArray(sources) || sources instanceof Set) {
    for (const source of sources) disposeSource(source, computation);
  } else if (sources !== null) {
    disposeSource(sources, computation);
  }
  if (sources instanceof Set) sources.clear();
  else (computation as ComputationNode).sourceEdges = null;
  // Mark as stale so it recomputes correctly if ever re-used (shared computed case)
  computation.state = ComputationState.STALE;
}

function disposeSource(source: Atom, computation: ComputationAtom) {
  removeObserver(source, computation);
  const derived = source as ComputationAtom;
  if (derived.isDerived && observerCount(derived) === 0) disposeComputation(derived);
}

function markDownstream(computation: ComputationAtom) {
  const stack: ComputationAtom[] = [computation];
  let current: ComputationAtom | undefined;
  while ((current = stack.pop())) {
    const edges = getObserverEdges(current);
    if (Array.isArray(edges) || edges instanceof Set) {
      for (const observer of edges) markPending(observer, stack);
    } else if (edges !== null) {
      markPending(edges, stack);
    }
  }
}

function markPending(observer: ComputationAtom, stack: ComputationAtom[]) {
  // Check before the state short-circuit: already-stale dead branches still
  // need disposal at the end of the flush.
  if (observer.isDerived && observerCount(observer) === 0) pendingDisposals.add(observer);
  if (observer.state) return;
  observer.state = ComputationState.PENDING;
  if (observer.isDerived) stack.push(observer);
  else observers.push(observer);
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
