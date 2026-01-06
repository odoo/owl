import { batched } from "../utils";

export enum ComputationState {
  EXECUTED = 0,
  STALE = 1,
  PENDING = 2,
}
export type Computation<T = any> = {
  compute?: () => T;
  state: ComputationState;
  sources: Set<Atom | Derived<any, any>>;
  isEager?: boolean;
  isDerived?: boolean;
  value: T; // for effects, this is the cleanup function
  childrenEffect?: Computation[]; // only for effects
} & Opts;

export type Opts = {
  name?: string;
};
export type Atom<T = any> = {
  value: T;
  observers: Set<Computation>;
} & Opts;

export interface Derived<Prev, Next = Prev> extends Atom<Next>, Computation<Next> {}

let Effects: Computation[];
let CurrentComputation: Computation | undefined;

// export function computed<T>(fn: () => T, opts?: Opts) {
//   // todo: handle cleanup
//   let computedComputation: Computation = {
//     state: ComputationState.STALE,
//     sources: new Set(),
//     isEager: true,
//     compute: () => {
//       return fn();
//     },
//     value: undefined,
//     name: opts?.name,
//   };
//   updateComputation(computedComputation);
// }

export function onReadAtom(atom: Atom) {
  if (!CurrentComputation) return;
  CurrentComputation.sources!.add(atom);
  atom.observers.add(CurrentComputation);
}

export function onWriteAtom(atom: Atom) {
  collectEffects(() => {
    for (const ctx of atom.observers) {
      if (ctx.state === ComputationState.EXECUTED) {
        if (ctx.isDerived) markDownstream(ctx as Derived<any, any>);
        else Effects.push(ctx);
      }
      ctx.state = ComputationState.STALE;
    }
  });
  batchProcessEffects();
}
function collectEffects(fn: Function) {
  if (Effects) return fn();
  Effects = [];
  try {
    return fn();
  } finally {
    // todo
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

export function untrack<T extends (...args: any[]) => any>(fn: T): ReturnType<T> {
  return runWithComputation(undefined!, fn);
}
export function getCurrentComputation() {
  return CurrentComputation;
}
export function setComputation(computation: Computation | undefined) {
  CurrentComputation = computation;
}
// todo: should probably use updateComputation instead.
export function runWithComputation<T>(computation: Computation, fn: () => T): T {
  const previousComputation = CurrentComputation;
  CurrentComputation = computation;
  let result: T;
  try {
    result = fn();
  } finally {
    CurrentComputation = previousComputation;
  }
  return result;
}

export function updateComputation(computation: Computation) {
  const state = computation.state;
  if (state === ComputationState.EXECUTED) return;
  if (state === ComputationState.PENDING) {
    computeSources(computation as Derived<any, any>);
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
  const previousComputation = CurrentComputation;
  CurrentComputation = computation;
  computation.value = computation.compute?.();
  computation.state = ComputationState.EXECUTED;
  CurrentComputation = previousComputation;
}
export function removeSources(computation: Computation) {
  const sources = computation.sources;
  for (const source of sources) {
    const observers = source.observers;
    observers.delete(computation);
    // todo: if source has no effect observer anymore, remove its sources too
    // todo: test it
  }
  sources.clear();
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
function computeSources(derived: Derived<any, any>) {
  for (const source of derived.sources) {
    if (!("compute" in source)) continue;
    updateComputation(source as Derived<any, any>);
  }
}
