import { OwlError } from "../../common/owl_error";
import { Atom, atomSymbol, onReadAtom, onWriteAtom, ReactiveValue } from "./computations";
import { proxifyTarget } from "./proxy";

export interface Signal<T> extends ReactiveValue<T> {
  /**
   * Update the value of the signal with a new value. If the new value is different
   * from the previous values, all computations that depends on this signal will
   * be invalidated, and effects will rerun.
   */
  set(nextValue: T): void;
}

interface SignalOptions<T> {
  type?: T;
}

function buildSignal<T>(value: T, set: (atom: Atom) => T, options?: SignalOptions<T>): Signal<T> {
  const atom: Atom & { type: "signal" } = {
    type: "signal",
    value,
    observers: new Set(),
  };

  let readValue = set(atom);
  const readSignal = () => {
    onReadAtom(atom);
    return readValue;
  };
  readSignal[atomSymbol] = atom;

  readSignal.set = function writeSignal(newValue: T) {
    if (Object.is(atom.value, newValue)) {
      return;
    }
    atom.value = newValue;
    readValue = set(atom);
    onWriteAtom(atom);
  };

  return readSignal;
}

export function signal<T>(value: T, options: SignalOptions<T> = {}): Signal<T> {
  return buildSignal<T>(value, (atom) => atom.value, options);
}

signal.invalidate = function (signal: Signal<any>): void {
  if (typeof signal !== "function" || (signal as any)[atomSymbol]?.type !== "signal") {
    throw new OwlError(`Value is not a signal (${signal})`);
  }
  onWriteAtom((signal as any)[atomSymbol]);
};

signal.Array = function <T>(initialValue: T[], options: SignalOptions<T> = {}): Signal<T[]> {
  return buildSignal<T[]>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};

signal.Object = function <T extends object>(
  initialValue: T,
  options?: SignalOptions<T>
): Signal<T> {
  return buildSignal<T>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};

interface MapSignalOptions<K, V> {
  name?: string;
  keyType?: K;
  valueType?: V;
}

signal.Map = function <K, V>(
  initialValue: Map<K, V>,
  options?: MapSignalOptions<K, V>
): Signal<Map<K, V>> {
  return buildSignal<Map<K, V>>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};

signal.Set = function <T>(initialValue: Set<T>, options?: SignalOptions<T>): Signal<Set<T>> {
  return buildSignal<Set<T>>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};
