import {
  Atom,
  Computation,
  ComputationAsync,
  ComputationState,
  Derived,
  Opts,
} from "../common/types";
import { PromiseExecContext } from "./cancellablePromise";
import { CancellablePromise } from "./cancellablePromise";
import { batched } from "./utils";

let Effects: Computation[];
let CurrentComputation: Computation;

export function signal<T>(value: T, opts?: Opts) {
  const atom: Atom = {
    value,
    observers: new Set(),
  };
  const read = () => {
    onReadAtom(atom);
    return atom.value;
  };
  const write = (newValue: T) => {
    if (Object.is(atom.value, newValue)) return;
    atom.value = newValue;
    onWriteAtom(atom);
  };
  return [read, write] as const;
}
export function effect<T>(fn: () => T, opts?: Opts) {
  const effectComputation: Computation = {
    state: ComputationState.STALE,
    value: undefined,
    compute() {
      // In case the cleanup read an atom.
      // todo: test it
      CurrentComputation = undefined!;
      // `removeSources` is made by `runComputation`.
      unsubscribeEffect(effectComputation);
      CurrentComputation = effectComputation;
      return fn();
    },
    sources: new Set(),
    childrenEffect: [],
    name: opts?.name,
  };
  CurrentComputation?.childrenEffect?.push?.(effectComputation);
  updateComputation(effectComputation);

  // Remove sources and unsubscribe
  return () => {
    // In case the cleanup read an atom.
    // todo: test it
    const previousComputation = CurrentComputation;
    CurrentComputation = undefined!;
    unsubscribeEffect(effectComputation);
    CurrentComputation = previousComputation!;
  };
}
export function derived<T>(fn: () => T, opts?: Opts): () => T {
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
      name: opts?.name,
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
  collectEffects(() => {
    for (const ctx of atom.observers) {
      if (ctx.state === ComputationState.EXECUTED) {
        if (ctx.isDerived) markDownstream(ctx as Derived<any, any>);
        else Effects.push(ctx);
      }
      resetAsync(ctx);
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
    // processEffects();
    true;
  }
}
const batchProcessEffects = batched(processEffects);
// todo: the export is a temporary hack remove before merge
export function processEffects() {
  if (!Effects) return;
  for (const computation of Effects) {
    try {
      updateComputation(computation);
    } catch (e) {
      const isAsyncAccessor = e instanceof AsyncAccessorPending;
      if (isAsyncAccessor) return;
      throw e;
    }
  }
  Effects = undefined!;
}

export function withoutReactivity<T extends (...args: any[]) => any>(fn: T): ReturnType<T> {
  return runWithComputation(undefined!, fn);
}
export function getCurrentComputation() {
  return CurrentComputation;
}
export function setComputation(computation: Computation) {
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
    if (computation) computation.state = ComputationState.EXECUTED;
    CurrentComputation = previousComputation!;
  }
  return result;
}

function updateComputation(computation: Computation) {
  const state = computation.state;
  if (computation.isDerived) onReadAtom(computation as Derived<any, any>);
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
  if (!computation.isAsync) {
    computation.value = computation.compute?.();
    computation.state = ComputationState.EXECUTED;
    CurrentComputation = previousComputation;
  } else {
    updateAsyncComputation(computation);
  }
}
function removeSources(computation: Computation) {
  const sources = computation.sources;
  for (const source of sources) {
    const observers = source.observers;
    observers.delete(computation);
    // todo: if source has no effect observer anymore, remove its sources too
    // todo: test it
  }
  sources.clear();
}

function unsubscribeEffect(effectComputation: Computation) {
  removeSources(effectComputation);
  cleanupEffect(effectComputation);
  for (const children of effectComputation.childrenEffect!) {
    // Consider it executed to avoid it's re-execution
    // todo: make a test for it
    children.state = ComputationState.EXECUTED;
    removeSources(children);
    unsubscribeEffect(children);
  }
  effectComputation.childrenEffect!.length = 0;
}
function cleanupEffect(computation: Computation) {
  // the computation.value of an effect is a cleanup function
  const cleanupFn = computation.value;
  if (cleanupFn && typeof cleanupFn === "function") {
    cleanupFn();
    computation.value = undefined;
  }
}

function markDownstream<A, B>(derived: Derived<A, B>) {
  for (const observer of derived.observers) {
    // if the state has already been marked, skip it
    // todo: check async
    if (observer.state) continue;
    resetAsync(observer);
    observer.state = ComputationState.PENDING;
    if (observer.isDerived) markDownstream(observer as Derived<any, any>);
    else Effects.push(observer);
  }
}
function resetAsync(computation: Computation) {
  const async = computation.async;
  if (async) {
    async.cancelled = true;
    async.subscribers.length = 0;
    computation.async = undefined;
  }
}
function computeSources(derived: Derived<any, any>) {
  for (const source of derived.sources) {
    if (!("compute" in source)) continue;
    updateComputation(source as Derived<any, any>);
  }
}

export function derivedAsync<T>(fn: () => Promise<T>, opts?: Opts): () => Promise<T> {
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
      name: opts?.name,
      isAsync: true,
      async: undefined,
    };
    onDerived?.(derivedComputation);
    updateComputation(derivedComputation);
    return derivedComputation.value;
  };
}
export class AsyncAccessorPending extends Error {
  constructor(public subscribers: Function[]) {
    super("Async accessor is still pending");
    // this.name = "AsyncAccessorError";
  }
}
function updateAsyncComputation(computation: Computation) {
  if (computation.state === ComputationState.ASYNC) {
    throw new AsyncAccessorPending(computation.async!.subscribers);
  }
  // const promise = computation.compute?.();
  const subscribers: Function[] = [];
  computation.async = {
    promise: undefined!,
    cancelled: false,
    promiseState: "pending",
    subscribers,
  };
  computation.value = undefined;
  computation.state = ComputationState.ASYNC;
  computation.async.promise = computation.compute().then(
    (value: any) => {
      computation.value = value;
      computation.state = ComputationState.EXECUTED;
      subscribers.forEach((fn) => fn());
    },
    (error: any) => {
      computation.state = ComputationState.EXECUTED;
    }
  );
  throw new AsyncAccessorPending(subscribers);
}

// For tests

let onDerived: (derived: Derived<any, any>) => void;

export function setSignalHooks(hooks: { onDerived: (derived: Derived<any, any>) => void }) {
  if (hooks.onDerived) onDerived = hooks.onDerived;
}
export function resetSignalHooks() {
  onDerived = (void 0)!;
}

// function delay(ms = 0) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// type Deferred = { promise: Promise<any>; resolve: (value: any) => void };
// function withResolvers<T = any>(): Deferred {
//   let resolve: (value: T) => void;
//   const promise = new Promise<T>((res) => {
//     resolve = res;
//   });
//   // @ts-ignore
//   return { promise, resolve };
// }
// const steps: string[] = [];
// function step(message: string) {
//   steps.push(message);
// }
// const deffereds: Record<string, Deferred> = {};
// const deferred = (key: string) => {
//   deffereds[key] ||= withResolvers();
//   return deffereds[key].promise;
// };
// const resolve = async (key: string) => {
//   deffereds[key] ||= withResolvers();
//   deffereds[key].resolve(key);
//   await delay();
//   return;
// };

// function verifySteps(expectedSteps: string[]) {
//   // expect(steps).toEqual(expectedSteps);
//   steps.length = 0;
// }

// (async () => {
//   patchPromise();
//   const context = getCancellableTask(async () => {
//     step("a before");
//     await deferred("a value");
//     step("a after");
//     const asyncFunction = async () => {
//       step("b before");
//       await deferred("b value");
//       step("b after");
//     };
//     await asyncFunction();
//     step("gen end");
//   });
//   console.warn(`context:`, context);

//   verifySteps(["a before"]);
//   await resolve("a value");
//   verifySteps(["a after", "b before"]);
//   context.cancel();
//   await resolve("b value");
//   expect(context.isCancel).toBe(true);
//   verifySteps([]);
//   restorePromise();
// })();
