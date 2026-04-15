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
  const computation = createComputation(() => {
    setComputation(undefined);
    unsubscribeEffect(computation);
    setComputation(computation);
    return fn();
  }, false);
  getCurrentComputation()?.observers.add(computation);
  updateComputation(computation);

  return function cleanupEffect() {
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    unsubscribeEffect(computation);
    setComputation(previousComputation);
  };
}

export function immediateEffect<T>(fn: () => T) {
  const computation = createComputation(
    () => {
      setComputation(undefined);
      unsubscribeEffect(computation);
      setComputation(computation);
      return fn();
    },
    false,
    ComputationState.STALE,
    true
  );
  getCurrentComputation()?.observers.add(computation);
  updateComputation(computation);

  return function cleanupImmediateEffect() {
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
