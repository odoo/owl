import {
  atomSymbol,
  ComputationState,
  Equals,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  toEqualsFn,
  updateComputation,
  createComputation,
} from "./computations";
import { OwlError } from "./owl_error";
import { getScope } from "./scope";

interface ComputedOptions<TRead, TWrite = TRead> {
  set?(value: TWrite): void;
  /**
   * Custom equality used after a recompute to decide whether observers should
   * be notified (see Equals). Useful when the getter builds a fresh object
   * each time (e.g. a filtered array): with a structural equality such as
   * `shallowEqual`, an equal result stops the propagation.
   */
  equals?: Equals<TRead>;
}

function readonlySetter(): never {
  throw new OwlError(
    "Cannot write to a read-only computed value. Pass a `set` option to make it writable."
  );
}

export function computed<TRead, TWrite = TRead>(
  getter: () => TRead,
  options: ComputedOptions<TRead, TWrite> = {}
): ReactiveValue<TRead, TWrite> {
  const equalsFn = toEqualsFn(options.equals);
  // The first compute has no previous value to compare against (and nothing
  // observes the computation until the first read returns): skip the equality
  // check so a custom equals never receives the initial undefined.
  let hasValue = false;
  const computation = createComputation(() => {
    const newValue = getter();
    if (hasValue) {
      if (equalsFn(computation.value, newValue)) {
        // discard the equal result: readers keep a stable identity, like a
        // signal write that compares equal
        return computation.value;
      }
      onWriteAtom(computation);
    }
    hasValue = true;
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
  readComputed.set = options.set ?? readonlySetter;

  getScope()?.computations.push(computation);

  return readComputed;
}
