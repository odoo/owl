import { getCurrent } from "./component/component_node";
import { onWillUnmount } from "./component/lifecycle_hooks";

type Atom = any; // proxy linked to a unique observer and source
type Source = any; // trackable that is not an atom
type Observer = () => void;
type Keys = Set<any>;

const sourceAtoms: WeakMap<Source, Set<Atom>> = new WeakMap();
const observerAtoms: WeakMap<Observer, Set<Atom>> = new WeakMap();

const SOURCE = Symbol("source");
const OBSERVER = Symbol("observer");
const KEYS = Symbol("keys");

export function atom(source: any, observer: Observer) {
  if (isTrackable(source) && observerAtoms.has(observer)) {
    source = source[SOURCE] || source;
    const oldAtom = getObserverSourceAtom(observer, source);
    if (oldAtom) {
      return oldAtom;
    }
    registerSource(source);
    return createAtom(source, observer);
  }
  return source;
}

function createAtom(source: Source, observer: Observer): Atom {
  const keys: Keys = new Set();
  const newAtom: Atom = new Proxy(source as any, {
    set(target: any, key: string, value: any): boolean {
      if (!(key in target)) {
        target[key] = value;
        notifySourceObservers(source);
        return true;
      }
      const current = target[key];
      if (current !== value) {
        target[key] = value;
        notifySourceKeyOBservers(source, key);
      }
      return true;
    },
    deleteProperty(target: any, key: string): boolean {
      if (key in target) {
        delete target[key];
        notifySourceObservers(source);
        deleteKeyFromKeys(source, key);
      }
      return true;
    },
    get(target: any, key: any): any {
      switch (key) {
        case OBSERVER:
          return observer;
        case SOURCE:
          return source;
        case KEYS:
          return keys;
        default:
          const value = target[key];
          keys.add(key);
          return atom(value, observer);
      }
    },
  });
  getObserverAtoms(observer).add(newAtom);
  getSourceAtoms(source).add(newAtom);
  return newAtom;
}

function deleteKeyFromKeys(source: Source, key: any) {
  for (const atom of getSourceAtoms(source)) {
    atom[KEYS].delete(key);
  }
}

function getObserverAtoms(observer: Observer): Set<Atom> {
  return observerAtoms.get(observer)!;
}

function getObserverSourceAtom(observer: Observer, source: Source): Atom | null {
  for (const atom of getObserverAtoms(observer)) {
    if (atom[SOURCE] === source) {
      return atom;
    }
  }
  return null;
}

function getSourceAtoms(source: Source): Set<Atom> {
  return sourceAtoms.get(source)!;
}

function isTrackable(value: any): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof Promise)
  );
}

function notifySourceKeyOBservers(source: Source, key: any) {
  for (const atom of getSourceAtoms(source)) {
    if (atom[KEYS].has(key)) {
      atom[OBSERVER]();
    }
  }
}

function notifySourceObservers(source: Source) {
  for (const atom of getSourceAtoms(source)) {
    atom[OBSERVER]();
  }
}

export function registerObserver(observer: Observer) {
  if (!observerAtoms.get(observer)) {
    observerAtoms.set(observer, new Set());
  }
  return unregisterObserver.bind(null, observer);
}

function registerSource(source: Source) {
  if (!sourceAtoms.get(source)) {
    sourceAtoms.set(source, new Set());
  }
}

function unregisterObserver(observer: Observer) {
  for (const atom of getObserverAtoms(observer)) {
    const source = atom[SOURCE];
    const sourceAtoms = getSourceAtoms(source);
    sourceAtoms.delete(atom);
  }
  observerAtoms.delete(observer);
}

export function useState(state: any): Atom {
  if (!isTrackable(state)) {
    throw new Error("Argument is not trackable");
  }
  const node = getCurrent()!;
  const observer = () => node.render();
  const unregisterObserver = registerObserver(observer);
  onWillUnmount(() => unregisterObserver());
  return atom(state, observer);
}
