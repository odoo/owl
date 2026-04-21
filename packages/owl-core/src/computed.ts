import {
  atomSymbol,
  ComputationState,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  updateComputation,
  createComputation,
} from "./computations";
import { OwlError } from "./owl_error";
import { getScope } from "./scope";

interface ComputedOptions<TWrite> {
  set?(value: TWrite): void;
}

function readonlySetter(): never {
  throw new OwlError(
    "Cannot write to a read-only computed value. Pass a `set` option to make it writable."
  );
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
  readComputed.set = options.set ?? readonlySetter;

  getScope()?.computations.push(computation);

  return readComputed;
}
