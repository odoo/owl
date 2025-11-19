import {
  Atom,
  Computation,
  ComputationAsync,
  ComputationState,
  Derived,
  DerivedAsyncRead,
  DerivedAsyncReturn,
  DerivedAsyncStates,
  Opts,
  Transaction,
} from "../common/types";
import { makeTask } from "./contextualPromise";
import { getCurrentTransaction, setCurrentTransaction } from "./suspense";
import { batched } from "./utils";

let Effects: Computation[];
let CurrentComputation: Computation;

export function signal<T>(value: T, opts?: Opts) {
  const atom: Atom<T> = {
    value,
    observers: new Set(),
  };
  const read = () => {
    onReadAtom(atom);
    return atom.value;
  };
  const write = (newValue: T | ((prevValue: T) => T)) => {
    if (typeof newValue === "function") {
      newValue = (newValue as (prevValue: T) => T)(atom.value);
    }
    if (Object.is(atom.value, newValue)) return;
    atom.value = newValue;
    onWriteAtom(atom);
  };
  return [read, write] as const;
}
export function effect<T>(
  fn: () => T,
  { name, withChildren = true }: Opts & { withChildren?: boolean } = {}
) {
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
    name: name,
  };
  if (withChildren) effectComputation.childrenEffect = [];
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
export function computed<T>(fn: () => T, opts?: Opts) {
  // todo: handle cleanup
  let computedComputation: Computation = {
    state: ComputationState.STALE,
    sources: new Set(),
    isEager: true,
    compute: () => {
      return fn();
    },
    value: undefined,
    name: opts?.name,
  };
  updateComputation(computedComputation);
}
export function derived<T>(fn: () => T, opts?: Opts): () => T {
  // todo: handle cleanup
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
  // reset async directly
  for (const ctx of atom.observers) {
    resetAsync(ctx);
  }
  collectEffects(() => {
    for (const ctx of atom.observers) {
      if (ctx.state === ComputationState.EXECUTED) {
        if (ctx.isDerived) markDownstream(ctx as Derived<any, any>);
        else Effects.push(ctx);
      }
      // resetAsync(ctx);
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
    updateComputation(computation);
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
    updateAsyncComputation(computation as Derived<any, any>);
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
  const childrenEffect = effectComputation.childrenEffect;
  if (!childrenEffect) return;
  for (const children of childrenEffect) {
    // Consider it executed to avoid it's re-execution
    // todo: make a test for it
    children.state = ComputationState.EXECUTED;
    removeSources(children);
    unsubscribeEffect(children);
  }
  childrenEffect.length = 0;
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
    observer.state = ComputationState.PENDING;
    if (observer.isDerived) markDownstream(observer as Derived<any, any>);
    else Effects.push(observer);
  }
}
function resetAsync(computation: Computation) {
  const async = computation.async;
  if (async) {
    async.task.cancel();
    computation.async = undefined;
  }
}
function computeSources(derived: Derived<any, any>) {
  for (const source of derived.sources) {
    if (!("compute" in source)) continue;
    updateComputation(source as Derived<any, any>);
  }
}

export function derivedAsync<T>(fn: () => Promise<T>, opts?: Opts) {
  let derivedComputation: Derived<any, any>;
  const [value, setValue] = signal<T | undefined>(undefined);
  const [state, setState] = signal<DerivedAsyncStates>("unresolved");
  const [error, setError] = signal<any>(undefined);

  const _load = async () => {
    setState("pending");
    try {
      setValue(await fn());
    } catch (e) {
      setError(e);
      setState("errored");
      return;
    }
    setState("ready");
  };
  const load = () => {
    derivedComputation ??= {
      // get state() {
      //   return state;
      // },
      // set state(value: ComputationState) {
      //   // if (opts?.debug && (window as any).d) {
      //   //   debugger;
      //   // }
      //   // state = value;
      // },
      state: ComputationState.STALE,
      sources: new Set(),
      compute: _load,
      isDerived: true,
      value: undefined,
      observers: new Set<Computation>(),
      name: opts?.name,
      isAsync: true,
      async: undefined,
      // transaction: getCurrentTransaction(),
    };
    onDerived?.(derivedComputation);
    updateComputation(derivedComputation);
  };

  const read = () => {
    load();
    return value();
  };

  Object.defineProperties(read, {
    state: { get: state },
    error: { get: error },
    loading: {
      get() {
        const s = state();
        return s === "pending" || s === "refreshing";
      },
    },
    // latest: {
    //   get() {
    //     // if (!resolved) return read();
    //     // const err = error();
    //     // if (err && !pr) throw err;
    //     // return value();
    //     return undefined;
    //   },
    // },
  });

  return [read as DerivedAsyncRead<T>] as const;
}

function updateAsyncComputation(computation: Derived<any, any>) {
  if (computation.async) return;
  const transaction = getCurrentTransaction();
  const length = Effects?.length || 0;
  for (let i = 0; i < length; i++) {
    transaction.effects.add(Effects[i]);
  }

  const async: ComputationAsync = {
    task: undefined!,
    transaction,
  };
  computation.async = async;
  computation.value = undefined;
  // computation.state = ComputationState.ASYNC_PENDING;

  let lastComputation: Computation;
  let lastTransaction: Transaction;
  const setContext = () => {
    lastComputation = CurrentComputation;
    lastTransaction = getCurrentTransaction();
    CurrentComputation = computation;
    setCurrentTransaction(transaction);
  };
  const resetContext = () => {
    CurrentComputation = lastComputation;
    setCurrentTransaction(lastTransaction);
  };
  const onSuccess = (value: any) => {
    computation.value = value;
    onWriteAtom(computation);
    teardown();
  };
  const teardown = () => {
    computation.async = undefined;
    computation.state = ComputationState.EXECUTED;
    transaction.decrement();
  };
  const task = makeTask(computation.compute, setContext, resetContext, teardown);
  async.task = task;

  transaction.increment();
  task.start().then(onSuccess, teardown);
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
