import { onReadAtom, onWriteAtom, Atom, Opts } from "./computations";

export type ReactiveValue<T> = () => T;

export interface Signal<T> extends ReactiveValue<T> {
  /**
   * Update the value of the signal with a new value. If the new value is different
   * from the previous values, all computations that depends on this signal will
   * be invalidated, and effects will rerun.
   */
  set(value: T): void;
  /**
   * Call the updater function (if given) to update the signal value.
   * If the updater value is not given, then all computations that depends on
   * this signal will be invalidated and effects will rerun.
   */
  update(updater?: (value: T) => T): void;
}

export function signal<T>(value: T, opts?: Opts): Signal<T> {
  const atom: Atom<T> = {
    value,
    observers: new Set(),
    name: opts?.name,
  };
  const read = () => {
    onReadAtom(atom);
    return atom.value;
  };
  const write = (newValue: T | ((prevValue: T) => T)) => {
    if (typeof newValue === "function") {
      newValue = (newValue as (prevValue: T) => T)(atom.value);
    }
    if (Object.is(atom.value, newValue)) return;
    atom.value = newValue;
    onWriteAtom(atom);
  };
  read.set = write;
  read.update = (updater?: (value: T) => T) => {
    if (updater) {
      write(updater(atom.value));
    } else {
      onWriteAtom(atom);
    }
  };
  return read;
}
