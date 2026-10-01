import {
  atomSymbol,
  ComputationNode,
  ComputationState,
  Equals,
  HAS_VALUE,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  toEqualsFn,
  updateComputation,
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

class ComputedAtom<T> extends ComputationNode<T> {
  declare getter: () => T;
  declare equals: (a: T, b: T) => boolean;

  constructor(getter: () => T, equals: (a: T, b: T) => boolean) {
    super(computeValue<T>, true);
    this.getter = getter;
    this.equals = equals;
  }
}

// A shared compute body removes one closure per computed. Keep it as an own
// property on each atom, just like createComputation's `compute`, so dependency
// tracking and propagation continue to use ordinary data properties.
function computeValue<T>(this: ComputedAtom<T>): T {
  const getter = this.getter;
  const newValue = getter();
  // The first compute has no previous value to compare against (and nothing
  // observes the computation until the first read returns): skip the equality
  // check so a custom equals never receives the initial undefined.
  if (this.flags & HAS_VALUE) {
    const equals = this.equals;
    if (equals(this.value, newValue)) {
      // Discard the equal result: readers keep a stable identity, like a
      // signal write that compares equal.
      return this.value;
    }
    onWriteAtom(this);
  }
  this.flags |= HAS_VALUE;
  return newValue;
}

export function computed<TRead, TWrite = TRead>(
  getter: () => TRead,
  options: ComputedOptions<TRead, TWrite> = {}
): ReactiveValue<TRead, TWrite> {
  const computation = new ComputedAtom(getter, toEqualsFn(options.equals));

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
