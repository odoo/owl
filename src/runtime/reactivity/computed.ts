import {
  atomSymbol,
  ComputationState,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  updateComputation,
  createComputation,
} from "./computations";
import { contextStack } from "../context";

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

  const context = contextStack.at(-1);
  if (context) {
    if (context.type === "component") {
      context.node.computations.push(computation);
    } else if (context.type === "plugin") {
      context.manager.computations.push(computation);
    }
  }

  return readComputed;
}
