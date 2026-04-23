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
    // Unbracket currentComputation so that atoms read by the user's cleanup
    // function don't get tracked as dependencies.
    setComputation(undefined);
    unsubscribeEffect(computation);
    setComputation(computation);
    return fn();
  }, false);
  getCurrentComputation()?.observers.add(computation);
  updateComputation(computation);

  // Remove sources and unsubscribe
  return function cleanupEffect() {
    // Save/restore currentComputation so that if the user calls this cleanup
    // from inside another effect, atoms read by the cleanup don't leak into
    // that surrounding effect's dependency set.
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
    // Mark as executed so that if the child is already queued in
    // `observers` (because its own source changed concurrently), the
    // scheduler's updateComputation call becomes a no-op.
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
