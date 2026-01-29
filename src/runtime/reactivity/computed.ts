import {
  atomSymbol,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  updateComputation,
  WritableReactiveValue,
  createComputation,
} from "./computations";

type ReadonlyComputedTransform<T> = () => T;
interface WritableComputedTransform<T> {
  get(): T;
  set(nextValue: T): void;
}

export function computed<T>(transform: WritableComputedTransform<T>): WritableReactiveValue<T>;
export function computed<T>(transform: ReadonlyComputedTransform<T>): ReactiveValue<T>;
export function computed(transform: any): any {
  const get = typeof transform === "function" ? transform : transform.get;
  const set = typeof transform === "function" ? null : transform.set;

  const computation = createComputation({
    compute: () => {
      onWriteAtom(computation);
      return get();
    },
    isDerived: true,
  });

  function readComputed() {
    updateComputation(computation);
    onReadAtom(computation);
    return computation.value;
  }
  readComputed[atomSymbol] = computation;

  if (set) {
    readComputed.set = function writeComputed(nextValue: any) {
      if (Object.is(nextValue, computation.value)) {
        return;
      }
      computation.value = nextValue;
      set(nextValue);
      onWriteAtom(computation);
    };
  }

  return readComputed;
}
