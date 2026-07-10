import { OwlError } from "./owl_error";
import {
  Atom,
  atomSymbol,
  Equals,
  onReadAtom,
  onWriteAtom,
  ReactiveValue,
  toEqualsFn,
} from "./computations";
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

// TValue is the type held by the signal, TElem the type carried by the
// (phantom) `type` option: they only differ for collection signals, where
// `type` names the element type while `equals` compares whole collections.
interface SignalOptions<TValue, TElem = TValue> {
  type?: TElem;
  /** Custom equality used by `set` to decide whether to notify (see Equals). */
  equals?: Equals<TValue>;
}

function buildSignal<T>(value: T, set: (atom: Atom) => T, equals?: Equals<T>): Signal<T> {
  const atom: Atom & { type: "signal" } = {
    type: "signal",
    value,
    observers: new Set(),
  };
  const equalsFn = toEqualsFn(equals);

  let readValue = set(atom);
  const readSignal = () => {
    onReadAtom(atom);
    return readValue;
  };
  readSignal[atomSymbol] = atom;

  readSignal.set = function writeSignal(newValue: T) {
    if (equalsFn(atom.value, newValue)) {
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

function signalArray<T>(): Signal<T[]>;
function signalArray<T>(initialValue: T[], options?: { equals?: Equals<T[]> }): Signal<T[]>;
function signalArray<T>(initialValue: NoInfer<T>[], options: SignalOptions<T[], T>): Signal<T[]>;
function signalArray<T>(initialValue: T[] = [], options: SignalOptions<T[], T> = {}): Signal<T[]> {
  return buildSignal<T[]>(initialValue, (atom) => proxifyTarget(atom.value, atom), options.equals);
}

function signalObject<T extends Record<PropertyKey, any>>(): Signal<T>;
function signalObject<T extends Record<PropertyKey, any>>(
  initialValue: T,
  options?: { equals?: Equals<T> }
): Signal<T>;
function signalObject<T extends Record<PropertyKey, any>>(
  initialValue: NoInfer<T>,
  options: SignalOptions<T>
): Signal<T>;
function signalObject<T extends Record<PropertyKey, any>>(
  initialValue: T = {} as T,
  options: SignalOptions<T> = {}
): Signal<T> {
  return buildSignal<T>(initialValue, (atom) => proxifyTarget(atom.value, atom), options.equals);
}

interface MapSignalOptions<K, V> {
  name?: string;
  keyType?: K;
  valueType?: V;
  /** Custom equality used by `set` to decide whether to notify (see Equals). */
  equals?: Equals<Map<K, V>>;
}

function signalMap<K, V>(): Signal<Map<K, V>>;
function signalMap<K, V>(
  initialValue: Map<K, V>,
  options?: { name?: string; equals?: Equals<Map<K, V>> }
): Signal<Map<K, V>>;
function signalMap<K, V>(
  initialValue: NoInfer<Map<K, V>>,
  options: MapSignalOptions<K, V>
): Signal<Map<K, V>>;
function signalMap<K, V>(
  initialValue: Map<K, V> = new Map(),
  options: MapSignalOptions<K, V> = {}
): Signal<Map<K, V>> {
  return buildSignal<Map<K, V>>(
    initialValue,
    (atom) => proxifyTarget(atom.value, atom),
    options.equals
  );
}

function signalSet<T>(): Signal<Set<T>>;
function signalSet<T>(initialValue: Set<T>, options?: { equals?: Equals<Set<T>> }): Signal<Set<T>>;
function signalSet<T>(
  initialValue: Set<NoInfer<T>>,
  options: SignalOptions<Set<T>, T>
): Signal<Set<T>>;
function signalSet<T>(
  initialValue: Set<T> = new Set(),
  options: SignalOptions<Set<T>, T> = {}
): Signal<Set<T>> {
  return buildSignal<Set<T>>(
    initialValue,
    (atom) => proxifyTarget(atom.value, atom),
    options.equals
  );
}

export function signal<T>(value: T, options?: { equals?: Equals<T> }): Signal<T>;
export function signal<T>(value: NoInfer<T>, options: SignalOptions<T>): Signal<T>;
export function signal<T>(value: T, options: SignalOptions<T> = {}): Signal<T> {
  return buildSignal<T>(value, (atom) => atom.value, options.equals);
}
signal.trigger = triggerSignal;
signal.ref = signalRef;
signal.Array = signalArray;
signal.Map = signalMap;
signal.Object = signalObject;
signal.Set = signalSet;
