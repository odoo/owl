import {
  atomSymbol,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  updateComputation,
  createComputation,
} from "./computations";

export function computed<T>(fn: () => T): ReactiveValue<T> {
  const computation = createComputation({
    compute: () => {
      onWriteAtom(computation);
      return fn();
    },
    isDerived: true,
  });

  function readComputed() {
    updateComputation(computation);
    onReadAtom(computation);
    return computation.value;
  }
  readComputed[atomSymbol] = computation;

  return readComputed;
}
