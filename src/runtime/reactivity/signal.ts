import { OwlError } from "../../common/owl_error";
import { onReadAtom, onWriteAtom, Atom, Opts } from "./computations";
import { proxifyTarget } from "./proxy";

export type ReactiveValue<T> = () => T;

export interface Signal<T> extends ReactiveValue<T> {
  /**
   * Update the value of the signal with a new value. If the new value is different
   * from the previous values, all computations that depends on this signal will
   * be invalidated, and effects will rerun.
   */
  set(value: T): void;
}

const signalSymbol = Symbol("Signal");

function buildSignal<T>(value: T, set: (atom: Atom) => T, opts?: Opts): Signal<T> {
  const atom: Atom<T> = {
    value,
    observers: new Set(),
    name: opts?.name,
  };
  let readValue = set(atom);
  const read = () => {
    onReadAtom(atom);
    return readValue;
  };
  (read as any)[signalSymbol] = atom;
  read.set = (newValue: T) => {
    if (Object.is(atom.value, newValue)) {
      return;
    }
    atom.value = newValue;
    readValue = set(atom);
    onWriteAtom(atom);
  };
  return read;
}

export function signal<T>(value: T, opts?: Opts): Signal<T> {
  return buildSignal<T>(value, (atom) => atom.value, opts);
}

signal.invalidate = function (signal: Signal<any>): void {
  if (!(signalSymbol in signal)) {
    throw new OwlError(`Value is not a signal (${signal})`);
  }
  const atom = signal[signalSymbol] as any;
  onWriteAtom(atom);
};

signal.Array = function <T>(initialValue: T[], opts?: Opts): Signal<T[]> {
  return buildSignal<T[]>(initialValue, (atom) => proxifyTarget(atom.value, atom), opts);
};

signal.Object = function <T extends object>(initialValue: T, opts?: Opts): Signal<T> {
  return buildSignal<T>(initialValue, (atom) => proxifyTarget(atom.value, atom), opts);
};

signal.Map = function <K, V>(initialValue: Map<K, V>, opts?: Opts): Signal<Map<K, V>> {
  return buildSignal<Map<K, V>>(initialValue, (atom) => proxifyTarget(atom.value, atom), opts);
};

signal.Set = function <T>(initialValue: Set<T>, opts?: Opts): Signal<Set<T>> {
  return buildSignal<Set<T>>(initialValue, (atom) => proxifyTarget(atom.value, atom), opts);
};
