import {
  atomSymbol,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  updateComputation,
  createComputation,
} from "./computations";

interface ComputedOptions {
  set?(value: any): void;
}

export function computed<T>(getter: () => T, options: ComputedOptions = {}): ReactiveValue<T> {
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
