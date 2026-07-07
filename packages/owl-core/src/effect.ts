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
    // Source-link maintenance is handled by the tracking run itself
    // (startTracking/finishTracking in updateComputation); here we only run
    // the user cleanup function and tear down nested child effects. Calling
    // removeSources on ourselves here would reset the in-progress positional
    // tracking state.
    if (computation.value || computation.observers.size) {
      // Keep cleanup function and child cleanup from tracking atom reads as
      // sources of this effect.
      setComputation(undefined);
      cleanupEffect(computation);
      for (const childEffect of computation.observers) {
        childEffect.state = ComputationState.EXECUTED;
        unsubscribeEffect(childEffect);
      }
      computation.observers.clear();
      setComputation(computation);
    }
    return fn();
  }, false);
  getCurrentComputation()?.observers.add(computation);
  updateComputation(computation);

  // Remove sources and unsubscribe
  return function cleanupEffect() {
    // Mark as executed so a queued re-run (scheduled by an earlier signal
    // write in the same microtick) is skipped by updateComputation.
    computation.state = ComputationState.EXECUTED;
    // Clear currentComputation across unsubscribeEffect so the user cleanup
    // function's atom reads do not attach as sources of whatever computation
    // happens to be active when dispose() is called. See test
    // "dispose called inside another effect: cleanup's atom reads do not
    // leak to outer".
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
    // Consider it executed to avoid it's re-execution. The recursive
    // unsubscribeEffect below clears the child's sources as its first step,
    // so no explicit removeSources call is needed here.
    childEffect.state = ComputationState.EXECUTED;
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
