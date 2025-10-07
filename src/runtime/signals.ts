import { Atom, Computation, ComputationState, Derived } from "../common/types";
import { batched } from "./utils";

let Effects: Computation[];
let CurrentComputation: Computation;

export function effect<T>(fn: () => T) {
  const unsubscribe = () => {
    cleanupComputation(effectComputation);
    unsubscribeChildEffect(effectComputation);
  };
  const effectComputation: Computation = {
    state: ComputationState.STALE,
    value: undefined,
    compute() {
      CurrentComputation = undefined!;
      // removing the sources is made by `runComputation`.
      unsubscribe();
      // reseting the context will be made by `runComputation`.
      CurrentComputation = effectComputation;
      return fn();
    },
    sources: new Set(),
    childrenEffect: [],
  };
  // Push to the parent effect if any
  CurrentComputation?.childrenEffect?.push?.(effectComputation);
  runComputation(effectComputation);

  // Remove sources and unsubscribe
  return () => {
    removeSources(effectComputation);
    const currentComputation = CurrentComputation;
    CurrentComputation = undefined!;
    unsubscribe();
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
    runComputation(derivedComputation);
    return derivedComputation.value;
  };
}

export function onReadAtom(atom: Atom) {
  if (!CurrentComputation) return;
  CurrentComputation.sources!.add(atom);
  atom.observers.add(CurrentComputation);
}

export function onWriteAtom(atom: Atom) {
  runUpdates(() => {
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

export function makeAtom(): Atom {
  const atom: Atom = {
    value: undefined,
    observers: new Set(),
  };
  return atom;
}

function runComputation(computation: Computation) {
  const state = computation.state;
  computation.isDerived && onReadAtom(computation as Derived<any, any>);
  if (state === ComputationState.EXECUTED) return;
  if (state === ComputationState.PENDING) {
    computeSources(computation as Derived<any, any>);
  }
  const executionContext = CurrentComputation;
  // todo: test performance. We might want to avoid removing the atoms to
  // directly re-add them at compute. Especially as we are making them stale.
  removeSources(computation);
  CurrentComputation = computation;
  computation.value = computation.compute?.();
  computation.state = ComputationState.EXECUTED;
  CurrentComputation = executionContext;
}

const batchProcessEffects = batched(processEffects);
function processEffects() {
  if (!Effects) return;
  for (const computation of Effects) {
    runComputation(computation);
  }
  Effects = undefined!;
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

/**
 * Unsubscribe an execution context and all its children from all atoms
 * they are subscribed to.
 *
 * @param parentExecutionContext the context to unsubscribe
 */
function unsubscribeChildEffect(parentExecutionContext: Computation) {
  for (const children of parentExecutionContext.childrenEffect!) {
    cleanupComputation(children);
    removeSources(children);
    // Consider it executed to avoid it's re-execution
    children.state = ComputationState.EXECUTED;
    unsubscribeChildEffect(children);
  }
  parentExecutionContext.childrenEffect!.length = 0;
}

function cleanupComputation(computation: Computation) {
  // the computation.value of an effect is a cleanup function
  if (computation.value && typeof computation.value === "function") {
    computation.value();
    computation.value = undefined;
  }
}

function runUpdates(fn: Function) {
  if (Effects) return fn();
  Effects = [];
  try {
    return fn();
  } finally {
    // processEffects();
    true;
  }
}
function computeSources(derived: Derived<any, any>) {
  for (const source of derived.sources) {
    if ("sources" in source) continue;
    computeMemo(source as Derived<any, any>);
  }
}

function computeMemo(derived: Derived<any, any>) {
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
// todo: find a better way to test
let onDerived: (derived: Derived<any, any>) => void;

export function setSginalHooks(hooks: { onDerived: (derived: Derived<any, any>) => void }) {
  if (hooks.onDerived) onDerived = hooks.onDerived;
}
export function resetSignalHooks() {
  onDerived = (void 0)!;
}
