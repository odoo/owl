import {
  atomSymbol,
  ComputationState,
  getComputationScope,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  updateComputation,
  createComputation,
} from "./computations";

interface ComputedOptions<TWrite> {
  set?(value: TWrite): void;
}

export function computed<TRead, TWrite = TRead>(
  getter: () => TRead,
  options: ComputedOptions<TWrite> = {}
): ReactiveValue<TRead, TWrite> {
  const computation = createComputation(() => {
    const newValue = getter();
    if (!Object.is(computation.value, newValue)) {
      onWriteAtom(computation);
    }
    return newValue;
  }, true);

  function readComputed() {
    if (computation.state !== ComputationState.EXECUTED) {
      updateComputation(computation);
    }
    onReadAtom(computation);
    return computation.value;
  }
  readComputed[atomSymbol] = computation;
  readComputed.set = options.set ?? (() => {});

  const scope = getComputationScope();
  if (scope) {
    scope.sources.add(computation);
    computation.observers.add(scope);
  }

  return readComputed;
}
