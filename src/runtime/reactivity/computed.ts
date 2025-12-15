import {
  Opts,
  Derived,
  ComputationState,
  onWriteAtom,
  Computation,
  updateComputation,
} from "./computations";
import { ReactiveValue } from "./signal";

export function computed<T>(fn: () => T, opts?: Opts): ReactiveValue<T> {
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

// For tests

let onDerived: (derived: Derived<any, any>) => void;

export function setSignalHooks(hooks: { onDerived: (derived: Derived<any, any>) => void }) {
  if (hooks.onDerived) onDerived = hooks.onDerived;
}
export function resetSignalHooks() {
  onDerived = (void 0)!;
}
