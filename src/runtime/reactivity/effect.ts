import {
  Computation,
  ComputationState,
  getCurrentComputation,
  ReactiveOptions,
  removeSources,
  setComputation,
  updateComputation,
} from "./computations";

export function effect<T>(fn: () => T, options?: ReactiveOptions) {
  const effectComputation: Computation = {
    state: ComputationState.STALE,
    value: undefined,
    compute() {
      // In case the cleanup read an atom.
      // todo: test it
      setComputation(undefined);
      //   CurrentComputation = undefined!;
      // `removeSources` is made by `runComputation`.
      unsubscribeEffect(effectComputation);
      setComputation(effectComputation);
      //   CurrentComputation = effectComputation;
      return fn();
    },
    sources: new Set(),
    childrenEffect: [],
    name: options?.name,
  };
  getCurrentComputation()?.childrenEffect?.push?.(effectComputation);
  updateComputation(effectComputation);

  // Remove sources and unsubscribe
  return () => {
    // In case the cleanup read an atom.
    // todo: test it
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    unsubscribeEffect(effectComputation);
    setComputation(previousComputation);
  };
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
