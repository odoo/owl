type CB = () => void;
const observers: WeakMap<any, PSet<CB>> = new WeakMap();

/**
 * PSet (for Prototypal Set) are sets that can lookup in their "parent sets", if
 * any.
 */

class PSet<T> extends Set<T> {
  parent?: PSet<T>;

  static createChild<T>(parent: PSet<T>): PSet<T> {
    const pset: PSet<T> = new PSet();
    pset.parent = parent;
    return pset;
  }

  has(key: T): boolean {
    if (super.has(key)) {
      return true;
    }
    return this.parent ? this.parent.has(key) : false;
  }

  *[Symbol.iterator](): Generator<T> {
    let iterator = super[Symbol.iterator]();
    for (let elem of iterator) {
      yield elem;
    }
    if (this.parent) {
      for (let elem of this.parent) {
        yield elem;
      }
    }
  }
}

// -----------------------------------------------------------------------------

export function observe<T>(value: T, cb: CB): T {
  if (isNotObservable(value)) {
    return value;
  }
  if (observers.has(value)) {
    const callbacks = observers.get(value)!;
    callbacks.add(cb);
    return value;
  }
  const callbacks: PSet<CB> = new PSet();
  callbacks.add(cb);
  return observeValue(value, callbacks);
}

export function unobserve<T>(value: T, cb: () => void) {
  if (isNotObservable(value)) {
    return;
  }
  if (observers.has(value)) {
    const callbacks = observers.get(value)!;
    callbacks.delete(cb);
  }
}

function isNotObservable(value: any): boolean {
  return (
    value === null || typeof value !== "object" || value instanceof Date || value instanceof Promise
  );
}

/**
 * value should
 * 1. be observable
 * 2. not yet be observed
 */
function observeValue(value: any, callbacks: PSet<CB>): any {
  const proxy = new Proxy(value as any, {
    get(target: any, key: any): any {
      const current = target[key];
      if (isNotObservable(current)) {
        return current;
      }
      if (observers.has(current)) {
        // this is wrong ?
        observers.get(current)!.parent = callbacks;
        return current;
      }
      const subCallbacks = PSet.createChild(callbacks);
      const subValue = observeValue(current, subCallbacks);
      target[key] = subValue;
      return subValue;
    },
    set(target: any, key: any, value: any): boolean {
      // TODO: check if current !== target or proxy ??
      const current = target[key];
      if (current !== value) {
        if (isNotObservable(value)) {
          target[key] = value;
        } else {
          // TODO: test following scenario:
          // 1. obj1 = observer({a:1}, somecb);
          // 2. unobserve(obj1, somecb)
          // 3. obj1.a = {b: 2};
          // check that somecb was not called
          // obj1.a.b = 3;
          // check again that somecb was not called
          if (observers.has(value)) {
            const pset = observers.get(value)!;
            pset.parent = callbacks;
            target[key] = value;
          } else {
            const subCallbacks = PSet.createChild(callbacks);
            target[key] = observeValue(value, subCallbacks);
          }
        }
        notify(target);
      }
      return true;
    },
    deleteProperty(target: any, key: string | number) {
      if (key in target) {
        delete target[key];
        notify(target);
      }
      return true;
    },
  });
  observers.set(value, callbacks);
  observers.set(proxy, callbacks);
  return proxy;
}

function notify(value: any) {
  const cbs = observers.get(value)!;
  for (let cb of cbs) {
    cb();
  }
}
