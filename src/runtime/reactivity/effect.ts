import {
  ComputationState,
  ComputationAtom,
  getCurrentComputation,
  removeSources,
  setComputation,
  updateComputation,
  createComputation,
} from "./computations";

export function effect<T>(fn: () => T) {
  const computation = createComputation({
    compute() {
      // In case the cleanup read an atom.
      // todo: test it
      setComputation(undefined);
      unsubscribeEffect(computation);
      setComputation(computation);
      return fn();
    },
    isDerived: false,
  });
  getCurrentComputation()?.observers.add(computation);
  updateComputation(computation);

  // Remove sources and unsubscribe
  return function cleanupEffect() {
    // In case the cleanup read an atom.
    // todo: test it
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    unsubscribeEffect(computation);
    setComputation(previousComputation);
  };
}

function unsubscribeEffect(effect: ComputationAtom) {
  removeSources(effect);
  cleanupEffect(effect);
  for (const childEffect of effect.observers) {
    // Consider it executed to avoid it's re-execution
    // todo: make a test for it
    childEffect.state = ComputationState.EXECUTED;
    removeSources(childEffect);
    unsubscribeEffect(childEffect);
  }
  effect.observers.clear();
}

function cleanupEffect(effect: ComputationAtom) {
  // the computation.value of an effect is a cleanup function
  const cleanupFn = effect.value;
  if (cleanupFn && typeof cleanupFn === "function") {
    cleanupFn();
    effect.value = undefined;
  }
}
