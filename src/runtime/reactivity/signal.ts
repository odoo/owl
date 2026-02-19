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

function buildSignal<T>(value: T, set: (atom: Atom) => T): Signal<T> {
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

function invalidateSignal(signal: Signal<any>): void {
  if (typeof signal !== "function" || (signal as any)[atomSymbol]?.type !== "signal") {
    throw new OwlError(`Value is not a signal (${signal})`);
  }
  onWriteAtom((signal as any)[atomSymbol]);
};

function signalArray<T>(initialValue: T[], options?: SignalOptions<T>): Signal<T[]>;
function signalArray<T>(initialValue: T[]): Signal<T[]> {
  return buildSignal<T[]>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};

function signalObject<T extends Record<PropertyKey, any>>(initialValue: T, options?: SignalOptions<T>): Signal<T>;
function signalObject<T extends Record<PropertyKey, any>>(initialValue: T): Signal<T> {
  return buildSignal<T>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};

interface MapSignalOptions<K, V> {
  name?: string;
  keyType?: K;
  valueType?: V;
}

function signalMap<K, V>(initialValue: Map<K, V>, options?: MapSignalOptions<K, V>): Signal<Map<K, V>>;
function signalMap<K, V>(initialValue: Map<K, V>): Signal<Map<K, V>> {
  return buildSignal<Map<K, V>>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};

function signalSet<T>(initialValue: Set<T>, options?: SignalOptions<T>): Signal<Set<T>>;
function signalSet<T>(initialValue: Set<T>): Signal<Set<T>> {
  return buildSignal<Set<T>>(initialValue, (atom) => proxifyTarget(atom.value, atom));
};

export function signal<T>(value: T, options?: SignalOptions<T>): Signal<T>;
export function signal<T>(value: T): Signal<T> {
  return buildSignal<T>(value, (atom) => atom.value);
}
signal.invalidate = invalidateSignal;
signal.Array = signalArray;
signal.Map = signalMap;
signal.Object = signalObject;
signal.Set = signalSet;
