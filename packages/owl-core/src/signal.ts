import { OwlError } from "./owl_error";
import { Atom, atomSymbol, onReadAtom, onWriteAtom, ReactiveValue } from "./computations";
import { proxifyTarget } from "./proxy";
import type { Constructor } from "./types";

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

function triggerSignal(signal: Signal<any>): void {
  if (typeof signal !== "function" || (signal as any)[atomSymbol]?.type !== "signal") {
    throw new OwlError(`Value is not a signal (${signal})`);
  }
  onWriteAtom((signal as any)[atomSymbol]);
}

/**
 * Create a signal meant to receive an element through t-ref. It starts at null
 * and is typed as `Signal<HTMLElement | null>` (or narrower if a constructor
 * is given): `myRef = signal.ref()` or `inputRef = signal.ref(HTMLInputElement)`.
 */
function signalRef(): Signal<HTMLElement | null>;
function signalRef<T extends Constructor<HTMLElement>>(type: T): Signal<InstanceType<T> | null>;
function signalRef(): Signal<any> {
  return buildSignal<any>(null, (atom) => atom.value);
}

function signalArray<T>(initialValue: T[]): Signal<T[]>;
function signalArray<T>(initialValue: NoInfer<T>[], options: SignalOptions<T>): Signal<T[]>;
function signalArray<T>(initialValue: T[]): Signal<T[]> {
  return buildSignal<T[]>(initialValue, (atom) => proxifyTarget(atom.value, atom));
}

function signalObject<T extends Record<PropertyKey, any>>(initialValue: T): Signal<T>;
function signalObject<T extends Record<PropertyKey, any>>(
  initialValue: NoInfer<T>,
  options: SignalOptions<T>
): Signal<T>;
function signalObject<T extends Record<PropertyKey, any>>(initialValue: T): Signal<T> {
  return buildSignal<T>(initialValue, (atom) => proxifyTarget(atom.value, atom));
}

interface MapSignalOptions<K, V> {
  name?: string;
  keyType?: K;
  valueType?: V;
}

function signalMap<K, V>(initialValue: Map<K, V>): Signal<Map<K, V>>;
function signalMap<K, V>(
  initialValue: NoInfer<Map<K, V>>,
  options: MapSignalOptions<K, V>
): Signal<Map<K, V>>;
function signalMap<K, V>(initialValue: Map<K, V>): Signal<Map<K, V>> {
  return buildSignal<Map<K, V>>(initialValue, (atom) => proxifyTarget(atom.value, atom));
}

function signalSet<T>(initialValue: Set<T>): Signal<Set<T>>;
function signalSet<T>(initialValue: Set<NoInfer<T>>, options: SignalOptions<T>): Signal<Set<T>>;
function signalSet<T>(initialValue: Set<T>): Signal<Set<T>> {
  return buildSignal<Set<T>>(initialValue, (atom) => proxifyTarget(atom.value, atom));
}

export function signal<T>(value: T): Signal<T>;
export function signal<T>(value: NoInfer<T>, options: SignalOptions<T>): Signal<T>;
export function signal<T>(value: T): Signal<T> {
  return buildSignal<T>(value, (atom) => atom.value);
}
signal.trigger = triggerSignal;
signal.ref = signalRef;
signal.Array = signalArray;
signal.Map = signalMap;
signal.Object = signalObject;
signal.Set = signalSet;
