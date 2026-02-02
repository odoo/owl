import {
  atomSymbol,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  updateComputation,
  createComputation,
} from "./computations";

interface ComputedOptions<T> {
  set?(value: T): void;
}

export function computed<T>(getter: () => T, options: ComputedOptions<T> = {}): ReactiveValue<T> {
  const computation = createComputation({
    compute: () => {
      onWriteAtom(computation);
      return getter();
    },
    isDerived: true,
  });

  function readComputed() {
    updateComputation(computation);
    onReadAtom(computation);
    return computation.value;
  }
  readComputed[atomSymbol] = computation;
  readComputed.set = options.set ?? (() => {});

  return readComputed;
}
