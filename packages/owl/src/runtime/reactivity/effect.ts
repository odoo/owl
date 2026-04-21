import {
  ComputationState,
  ComputationAtom,
  getCurrentComputation,
  removeSources,
  setComputation,
  updateComputation,
  createComputation,
  atomSymbol,
} from "./computations";

export function effect<T>(fn: () => T) {
  const computation = createComputation(() => {
    // In case the cleanup read an atom.
    // todo: test it
    setComputation(undefined);
    unsubscribeEffect(computation);
    setComputation(computation);
    return fn();
  }, false);

  // Remove sources and unsubscribe
  function cleanupEffect() {
    // In case the cleanup read an atom.
    // todo: test it
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    unsubscribeEffect(computation);
    setComputation(previousComputation);
  };
  cleanupEffect[atomSymbol] = computation;
  computation.onDetach = cleanupEffect;
  computation.onAttach = (child) => {
    computation.observers.add(child);
  };

  const parent = getCurrentComputation();
  parent?.onAttach?.(computation);

  updateComputation(computation);
  return cleanupEffect;
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
