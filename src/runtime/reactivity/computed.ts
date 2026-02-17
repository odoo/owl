import {
  atomSymbol,
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
    onWriteAtom(computation);
    return getter();
  }, true);

  function readComputed() {
    updateComputation(computation);
    onReadAtom(computation);
    return computation.value;
  }
  readComputed[atomSymbol] = computation;
  readComputed.set = options.set ?? (() => {});

  return readComputed;
}
