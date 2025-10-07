import { Atom, Computation, ComputationState, Derived } from "../common/types";
import { batched } from "./utils";

let Effects: Computation[];

export let CurrentComputation: Computation;
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

export function makeAtom(): Atom {
  const atom: Atom = {
    value: undefined,
    observers: new Set(),
  };
  return atom;
}

export function onReadAtom(atom: Atom) {
  if (!CurrentComputation) return;
  CurrentComputation.sources!.add(atom);
  atom.observers.add(CurrentComputation);
}

function runComputation(computation: Computation) {
  const state = computation.state;
  computation.isDerived && onReadAtom(computation as Derived<any, any>);
  if (state === ComputationState.EXECUTED) return;
  if (state === ComputationState.PENDING) {
    computeSources(computation as Derived<any, any>);
  }
  const executionContext = CurrentComputation;
  CurrentComputation = undefined!;
  removeAtomsFromContext(computation);
  CurrentComputation = computation;
  computation.value = computation.compute?.();
  computation.state = ComputationState.EXECUTED;
  CurrentComputation = executionContext;
}

export function effect<T>(fn: () => T) {
  let parent = CurrentComputation;
  // todo: is it useful?
  if (parent && !parent?.meta.children) {
    parent = undefined!;
  }
  const executionContext: Computation = {
    state: ComputationState.STALE,
    value: undefined,
    compute: () => {
      CurrentComputation = undefined!;
      cleanupComputation(executionContext);
      unsubscribeChildEffect(executionContext);
      CurrentComputation = executionContext;
      return fn();
    },
    sources: new Set(),
    meta: {
      parent: parent,
      children: [],
    },
  };
  if (parent) {
    // todo: is it useful?
    parent.meta.children?.push?.(executionContext);
  }
  runComputation(executionContext);
  return () => {
    cleanupComputation(executionContext);
    removeAtomsFromContext(executionContext);
    unsubscribeChildEffect(executionContext);
  };
}

function processEffects() {
  if (!Effects) return;
  for (const computation of Effects) {
    runComputation(computation);
  }
  Effects = undefined!;
}
const batchProcessEffects = batched(processEffects);

function removeAtomsFromContext(executionContext: Computation) {
  for (const source of executionContext.sources!) {
    source.observers.delete(executionContext);
    // if source has no observer anymore, remove its sources too
    if (source.observers.size === 0 && "sources" in source) {
      removeAtomsFromContext(source as Derived<any, any>);
      source.state = ComputationState.STALE;
    }
  }
  executionContext.sources!.clear();
}

/**
 * Unsubscribe an execution context and all its children from all atoms
 * they are subscribed to.
 *
 * @param parentExecutionContext the context to unsubscribe
 */
function unsubscribeChildEffect(parentExecutionContext: Computation) {
  for (const children of parentExecutionContext.meta.children) {
    children.meta.parent = undefined;
    cleanupComputation(children);
    removeAtomsFromContext(children);
    // Consider it executed to avoid it's re-execution
    children.state = ComputationState.EXECUTED;
    unsubscribeChildEffect(children);
  }
  parentExecutionContext.meta.children.length = 0;
}

export function withoutReactivity<T extends (...args: any[]) => any>(fn: T): ReturnType<T> {
  return runWithComputation(undefined!, fn);
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
export const testHooks = {
  makeDerived(derived: Derived<any, any>) {},
};

const makeDerived = (fn: () => any) => {
  const derived: Derived<any, any> = {
    state: ComputationState.STALE,
    sources: new Set(),
    compute: () => {
      onWriteAtom(derived);
      return fn();
    },
    isDerived: true,
    value: undefined,
    observers: new Set<Computation>(),
  };
  testHooks.makeDerived(derived);
  return derived;
};

export function derived<T>(fn: () => T): () => T {
  let derived: Derived<any, any>;

  return () => {
    if (!derived) derived = makeDerived(fn);
    runComputation(derived);
    return derived.value;
  };
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

function markDownstream<A, B>(derived: Derived<A, B>) {
  for (const observer of derived.observers) {
    // if the state has already been marked, skip it
    if (observer.state) continue;
    observer.state = ComputationState.PENDING;
    if (observer.isDerived) markDownstream(observer as Derived<any, any>);
    else Effects.push(observer);
  }
}
