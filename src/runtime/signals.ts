import { Atom, Computation, ComputationState, Derived } from "../common/types";
import { batched } from "./utils";

let Effects: Computation[];
let CurrentComputation: Computation;

export function effect<T>(fn: () => T) {
  const effectComputation: Computation = {
    state: ComputationState.STALE,
    value: undefined,
    compute() {
      CurrentComputation = undefined!;
      // `removeSources` is made by `runComputation`.
      unsubscribeEffect(effectComputation);
      CurrentComputation = effectComputation;
      return fn();
    },
    sources: new Set(),
    childrenEffect: [],
  };
  CurrentComputation?.childrenEffect?.push?.(effectComputation);
  updateComputation(effectComputation);

  // Remove sources and unsubscribe
  return () => {
    removeSources(effectComputation);
    const currentComputation = CurrentComputation;
    CurrentComputation = undefined!;
    unsubscribeEffect(effectComputation);
    CurrentComputation = currentComputation!;
  };
}
export function derived<T>(fn: () => T): () => T {
  let derivedComputation: Derived<any, any>;
  return () => {
    derivedComputation ??= {
      state: ComputationState.STALE,
      sources: new Set(),
      compute: () => {
        onWriteAtom(derivedComputation);
        return fn();
      },
      isDerived: true,
      value: undefined,
      observers: new Set<Computation>(),
    };
    onDerived?.(derivedComputation);
    updateComputation(derivedComputation);
    return derivedComputation.value;
  };
}

export function onReadAtom(atom: Atom) {
  if (!CurrentComputation) return;
  CurrentComputation.sources!.add(atom);
  atom.observers.add(CurrentComputation);
}
export function onWriteAtom(atom: Atom) {
  stackEffects(() => {
    for (const ctx of atom.observers) {
      if (ctx.state === ComputationState.EXECUTED) {
        ctx.state = ComputationState.STALE;
        if (ctx.isDerived) markDownstream(ctx as Derived<any, any>);
        else Effects.push(ctx);
      }
    }
  });
  batchProcessEffects();
}
export function makeAtom(): Atom {
  const atom: Atom = {
    value: undefined,
    observers: new Set(),
  };
  return atom;
}

export function getCurrentComputation() {
  return CurrentComputation;
}
export function setComputation(computation: Computation) {
  CurrentComputation = computation;
}
export function runWithComputation<T>(computation: Computation, fn: () => T): T {
  const currentComputation = CurrentComputation;
  CurrentComputation = computation;
  let result: T;
  try {
    result = fn();
  } finally {
    CurrentComputation = currentComputation!;
  }
  return result;
}
export function withoutReactivity<T extends (...args: any[]) => any>(fn: T): ReturnType<T> {
  return runWithComputation(undefined!, fn);
}

function updateComputation(computation: Computation) {
  const state = computation.state;
  computation.isDerived && onReadAtom(computation as Derived<any, any>);
  if (state === ComputationState.EXECUTED) return;
  if (state === ComputationState.PENDING) {
    computeSources(computation as Derived<any, any>);
  }
  // todo: test performance. We might want to avoid removing the atoms to
  // directly re-add them at compute. Especially as we are making them stale.
  removeSources(computation);
  const executionContext = CurrentComputation;
  CurrentComputation = computation;
  computation.value = computation.compute?.();
  computation.state = ComputationState.EXECUTED;
  CurrentComputation = executionContext;
}

function removeSources(computation: Computation) {
  const sources = computation.sources;
  for (const source of sources) {
    const observers = source.observers;
    observers.delete(computation);
    // if source has no observer anymore, remove its sources too
    if (observers.size === 0 && "sources" in source) {
      removeSources(source as Derived<any, any>);
      if (source.state !== ComputationState.STALE) {
        source.state = ComputationState.PENDING;
      }
    }
  }
  sources.clear();
}

function stackEffects(fn: Function) {
  if (Effects) return fn();
  Effects = [];
  try {
    return fn();
  } finally {
    // processEffects();
    true;
  }
}
const batchProcessEffects = batched(processEffects);
function processEffects() {
  if (!Effects) return;
  for (const computation of Effects) {
    updateComputation(computation);
  }
  Effects = undefined!;
}

function unsubscribeEffect(effectComputation: Computation) {
  cleanupEffect(effectComputation);
  unsubscribeChildEffect(effectComputation);
}
/**
 * Unsubscribe an execution context and all its children from all atoms
 * they are subscribed to.
 *
 * @param parentEffect the context to unsubscribe
 */
function unsubscribeChildEffect(parentEffect: Computation) {
  for (const children of parentEffect.childrenEffect!) {
    cleanupEffect(children);
    removeSources(children);
    // Consider it executed to avoid it's re-execution
    children.state = ComputationState.EXECUTED;
    unsubscribeChildEffect(children);
  }
  parentEffect.childrenEffect!.length = 0;
}
function cleanupEffect(computation: Computation) {
  // the computation.value of an effect is a cleanup function
  const cleanupFn = computation.value;
  if (cleanupFn && typeof cleanupFn === "function") {
    cleanupFn();
    computation.value = undefined;
  }
}

function computeSources(derived: Derived<any, any>) {
  for (const source of derived.sources) {
    if ("sources" in source) continue;
    computeDerived(source as Derived<any, any>);
  }
}

function computeDerived(derived: Derived<any, any>) {
  if (derived.state === ComputationState.EXECUTED) {
    onReadAtom(derived);
    return derived.value;
  } else if (derived.state === ComputationState.PENDING) {
    computeSources(derived);
  }
  onReadAtom(derived);
  return derived.value;
}

function markDownstream<A, B>(derived: Derived<A, B>) {
  for (const observer of derived.observers) {
    // if the state has already been marked, skip it
    if (observer.state) continue;
    observer.state = ComputationState.PENDING;
    if (observer.isDerived) markDownstream(observer as Derived<any, any>);
    else Effects.push(observer);
  }
}

// For tests

let onDerived: (derived: Derived<any, any>) => void;

export function setSignalHooks(hooks: { onDerived: (derived: Derived<any, any>) => void }) {
  if (hooks.onDerived) onDerived = hooks.onDerived;
}
export function resetSignalHooks() {
  onDerived = (void 0)!;
}
