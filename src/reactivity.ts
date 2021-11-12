import { ComponentNode, getCurrent } from "./component/component_node";
import { onWillUnmount } from "./component/lifecycle_hooks";

type Observer = ComponentNode | Function;
type Atom = any; // proxy linked to a unique observer and source
type Source = any; // trackable that is not an atom

const sourceAtoms: WeakMap<Source, Map<any, ObserverSet>> = new WeakMap();
const observerSourceAtom: WeakMap<Observer, Map<any, Atom>> = new WeakMap();

const SOURCE = Symbol("source");
const OBSERVER = Symbol("observer");
const KEYS = Symbol("keys");
const ROOT = Symbol("root");
const SEED = Symbol("Seed");

export function atom(source: any, observer: Observer) {
  return _atom(source, observer, true);
}

export function _atom(source: any, observer: Observer, seed = false) {
  if (isTrackable(source) && observerSourceAtom.has(observer)) {
    source = (source as any)[SOURCE] || source;
    const oldAtom = observerSourceAtom.get(observer)!.get(source);
    if (oldAtom) {
      if (seed) {
        oldAtom[SEED] = true;
      }
      return oldAtom;
    }
    if (!sourceAtoms.get(source)) {
      sourceAtoms.set(source, new Map([[ROOT, new ObserverSet()]]));
    }
    const newAtom = createAtom(source, observer);
    if (seed) {
      newAtom[SEED] = true;
    }
    observerSourceAtom.get(observer)!.set(source, newAtom);
    sourceAtoms.get(source)!.get(ROOT)!.add(newAtom);
    return newAtom;
  }
  return source;
}

function createAtom(source: Source, observer: Observer): Atom {
  const keys: Set<any> = new Set();
  let seed: boolean = false;
  const newAtom: Atom = new Proxy(source as any, {
    set(target: any, key: any, value: any): boolean {
      if (key === SEED) {
        seed = value;
        return true;
      }
      if (!(key in target)) {
        target[key] = value;
        notify(sourceAtoms.get(source)!.get(ROOT)!);
        return true;
      }
      const current = target[key];
      if (current !== value) {
        target[key] = value;
        const observerSet = sourceAtoms.get(source)!.get(key);
        if (observerSet) {
          const clean = isTrackable(current);
          notify(observerSet, clean);
        }
      }
      return true;
    },
    deleteProperty(target: any, key: string): boolean {
      if (key in target) {
        const current = target[key];
        delete target[key];
        // notify source observers
        const clean = isTrackable(current);
        notify(sourceAtoms.get(source)!.get(ROOT)!, clean);
        const atoms = sourceAtoms.get(source)!;
        if (atoms.has(key)) {
          // clear source-key observers
          for (const atom of atoms.get(key)!) {
            atom[KEYS].delete(key);
          }
          atoms.delete(key);
        }
      }
      return true;
    },
    get(target: any, key: any, proxy: any): any {
      switch (key) {
        case OBSERVER:
          return observer;
        case SOURCE:
          return source;
        case KEYS:
          return keys;
        case SEED:
          return seed;
        default:
          const value = target[key];
          // register observer to source-key
          if (!keys.has(key) && observerSourceAtom.has(observer)) {
            const atoms = sourceAtoms.get(source)!;
            if (!atoms.has(key)) {
              atoms.set(key, new ObserverSet());
            }
            atoms.get(key)!.add(newAtom);
            keys.add(key);
          }
          //
          return _atom(value, observer);
      }
    },
  });
  return newAtom;
}

function isTrackable(value: any): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof Promise)
  );
}

export function registerObserver(observer: Observer) {
  if (!observerSourceAtom.get(observer)) {
    observerSourceAtom.set(observer, new Map());
  }
  return unregisterObserverAtoms.bind(null, observer, false);
}

function unregisterObserverAtoms(observer: Observer, keepSeeds: boolean) {
  const observerAtoms = observerSourceAtom.get(observer)!;
  for (const [source, atom] of observerAtoms) {
    if (keepSeeds && atom[SEED]) {
      continue;
    }
    observerAtoms.delete(source);
    const atoms = sourceAtoms.get(source)!;
    atoms.get(ROOT)!.delete(atom);
    for (const key of atom[KEYS]) {
      atoms.get(key)!.delete(atom);
    }
  }
  if (!keepSeeds) {
    observerSourceAtom.delete(observer);
  }
}

export function useState(state: any): Atom {
  if (!isTrackable(state)) {
    throw new Error("Argument is not trackable");
  }
  const node = getCurrent()!;
  const unregisterObserver = registerObserver(node);
  onWillUnmount(() => unregisterObserver());
  return atom(state, node);
}

class ObserverSet {
  nodeAntichain: Antichain = new Antichain();
  callbackSet: Set<Atom> = new Set();
  add(atom: Atom) {
    if (atom[OBSERVER] instanceof ComponentNode) {
      this.nodeAntichain.add(atom);
    } else {
      this.callbackSet.add(atom);
    }
    return this;
  }
  delete(atom: Atom) {
    if (atom[OBSERVER] instanceof ComponentNode) {
      return this.nodeAntichain.delete(atom);
    } else {
      return this.callbackSet.delete(atom);
    }
  }
  union(other: ObserverSet) {
    for (const atom of other.nodeAntichain) {
      this.nodeAntichain.add(atom);
    }
    for (const callback of other.callbackSet) {
      this.callbackSet.add(callback);
    }
  }
  notify() {
    for (const atom of this.nodeAntichain) {
      // an observer cannot be found twice here: <= in add is based on observers
      atom[OBSERVER].render();
    }
    const called = new Set();
    for (const atom of this.callbackSet) {
      const observer = atom[OBSERVER];
      if (!called.has(observer)) {
        observer();
      }
      called.add(observer);
    }
  }
  *[Symbol.iterator]() {
    yield* this.nodeAntichain;
    yield* this.callbackSet;
  }
}

// Need to optimize this!
function isLessOrEqual(node1: ComponentNode, node2: ComponentNode) {
  let current: any = node1;
  if (current.level <= node2.level) {
    return false;
  }
  do {
    if (current === node2) {
      return true;
    }
    current = current.parent;
  } while (current);
  return false;
}

// set of atoms linked to observers of type ComponentNode
class Antichain extends Set<Atom> {
  level?: number;
  add(atom: Atom) {
    const node = atom[OBSERVER];
    if (this.level === node.level || this.level === undefined) {
      super.add(atom);
      this.level = node.level;
      return this;
    }
    let willAdd = false;
    for (const atom2 of this) {
      const node2 = atom2[OBSERVER];
      if (!willAdd && isLessOrEqual(node, node2)) {
        return this;
      } else if (isLessOrEqual(node2, node)) {
        super.delete(atom2);
        willAdd = true;
      }
    }
    super.add(atom);
    this.level = NaN;
    return this;
  }
}

let toNotify: ObserverSet | null = null;
let toClean: Set<Observer> = new Set();
async function notify(observers: ObserverSet, clean = false) {
  if (clean) {
    for (const atom of observers) {
      toClean.add(atom[OBSERVER]);
    }
  }
  if (toNotify) {
    toNotify.union(observers);
    return;
  }
  toNotify = new ObserverSet();
  toNotify.union(observers);
  await Promise.resolve();
  for (const observer of toClean) {
    unregisterObserverAtoms(observer, true);
  }
  toClean.clear();
  toNotify.notify();
  toNotify = null;
}
