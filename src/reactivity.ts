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

export function atom<T>(source: T, observer: Observer): T {
  if (isTrackable(source) && observerSourceAtom.has(observer)) {
    source = (source as any)[SOURCE] || source;
    const oldAtom = observerSourceAtom.get(observer)!.get(source);
    if (oldAtom) {
      return oldAtom;
    }
    if (!sourceAtoms.get(source)) {
      sourceAtoms.set(source, new Map([[ROOT, new ObserverSet()]]));
    }
    const newAtom = createAtom(source, observer);
    observerSourceAtom.get(observer)!.set(source, newAtom);
    sourceAtoms.get(source)!.get(ROOT)!.add(newAtom);
    return newAtom;
  }
  return source;
}

function createAtom(source: Source, observer: Observer): Atom {
  const keys: Set<any> = new Set();
  return new Proxy(source as any, {
    set(target: any, key: string, value: any): boolean {
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
          notify(observerSet);
        }
      }
      return true;
    },
    deleteProperty(target: any, key: string): boolean {
      if (key in target) {
        delete target[key];
        // notify source observers
        notify(sourceAtoms.get(source)!.get(ROOT)!);
        const atoms = sourceAtoms.get(source)!;
        if (atoms.has(key)) {
          // clear source-key observers
          atoms.get(key)!.deleteKey(key);
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
        default:
          const value = target[key];
          // register observer to source-key
          if (!keys.has(key) && observerSourceAtom.has(observer)) {
            const atoms = sourceAtoms.get(source)!;
            if (!atoms.has(key)) {
              atoms.set(key, new ObserverSet());
            }
            atoms.get(key)!.add(proxy);
            keys.add(key);
          }
          //
          return atom(value, observer);
      }
    },
  });
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
  return unregisterObserver.bind(null, observer);
}

function unregisterObserver(observer: Observer) {
  for (const [source, atom] of observerSourceAtom.get(observer)!) {
    const atoms = sourceAtoms.get(source)!;
    atoms.get(ROOT)!.delete(atom);
    for (const key of atom[KEYS]) {
      atoms.get(key)!.delete(atom);
    }
  }
  observerSourceAtom.delete(observer);
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
  deleteKey(key: any) {
    for (const atom of this.nodeAntichain) {
      atom[KEYS].delete(key);
    }
    for (const atom of this.callbackSet) {
      atom[KEYS].delete(key);
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
      atom[OBSERVER].render();
    }
    for (const atom of this.callbackSet) {
      atom[OBSERVER]();
    }
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
async function notify(observers: ObserverSet) {
  if (toNotify) {
    toNotify.union(observers);
    return;
  }
  toNotify = new ObserverSet();
  toNotify.union(observers);
  await Promise.resolve();
  toNotify.notify();
  toNotify = null;
}
