import {
  ComputationState,
  ComputationAtom,
  getCurrentComputation,
  removeSources,
  setComputation,
  updateComputation,
  createComputation,
  addObserver,
  clearObservers,
  getObserverEdges,
  observerCount,
} from "./computations";

export function effect<T>(fn: () => T) {
  const computation = createComputation(() => {
    // updateComputation has already removed this effect's sources. Further
    // cleanup is only needed for a stored cleanup function (computation.value)
    // or nested child effects (computation.observers).
    if (computation.value || observerCount(computation)) {
      // Keep cleanup function and child cleanup from tracking atom reads as
      // sources of this effect.
      setComputation(undefined);
      cleanupEffect(computation);
      setComputation(computation);
    }
    return fn();
  }, false);
  const parent = getCurrentComputation();
  if (parent) addObserver(parent, computation);
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
}

function cleanupEffect(effect: ComputationAtom) {
  // the computation.value of an effect is a cleanup function
  const cleanupFn = effect.value;
  if (cleanupFn && typeof cleanupFn === "function") {
    cleanupFn();
    effect.value = undefined;
  }
  const children = getObserverEdges(effect);
  if (Array.isArray(children) || children instanceof Set) {
    for (const child of children) unsubscribeChild(child);
  } else if (children !== null) {
    unsubscribeChild(children);
  }
  clearObservers(effect);
}

function unsubscribeChild(child: ComputationAtom) {
  // Skip a queued re-execution of a child disposed with its parent.
  child.state = ComputationState.EXECUTED;
  unsubscribeEffect(child);
}
