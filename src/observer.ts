/**
 * Owl Observer
 *
 * This code contains the logic that allows Owl to observe and react to state
 * changes.
 *
 * This is a Observer class that can observe any JS values.  The way it works
 * can be summarized thusly:
 * - primitive values are not observed at all
 * - Objects are observed by replacing all their keys with getters/setters
 *   (recursively)
 * - Arrays are observed by replacing their prototype with a customized version,
 *   which wrap some methods to allow the tracking of each state change.
 *
 * Note that this code is inspired by Vue.
 */

//------------------------------------------------------------------------------
// Modified Array prototype
//------------------------------------------------------------------------------

// we define here a new modified Array prototype, which basically override all
// Array methods that change some state to be able to track their changes
const methodsToPatch = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse"
];
const methodLen = methodsToPatch.length;

const ArrayProto = Array.prototype;
const ModifiedArrayProto = Object.create(ArrayProto);

for (let i = 0; i < methodLen; i++) {
  const method = methodsToPatch[i];
  const initialMethod = ArrayProto[method];
  ModifiedArrayProto[method] = function(...args) {
    if (!this.__observer__.allowMutations) {
      throw new Error(`Array cannot be changed here")`);
    }
    this.__observer__.rev++;
    this.__observer__.notifyChange();
    this.__owl__.rev++;
    let parent = this;
    do {
      parent.__owl__.deepRev++;
    } while ((parent = parent.__owl__.parent));
    let inserted;
    switch (method) {
      case "push":
      case "unshift":
        inserted = args;
        break;
      case "splice":
        inserted = args.slice(2);
        break;
    }
    if (inserted) {
      for (let i = 0, iLen = inserted.length; i < iLen; i++) {
        this.__observer__.observe(inserted[i], this);
      }
    }
    return initialMethod.call(this, ...args);
  };
}

//------------------------------------------------------------------------------
// Observer
//------------------------------------------------------------------------------
export class Observer {
  rev: number = 1;
  allowMutations: boolean = true;
  dirty: boolean = false;

  static set(target: any, key: number | string, value: any) {
    if (!target.__owl__) {
      throw Error(
        "`Observer.set()` can only be called with observed Objects or Arrays"
      );
    }
    target.__owl__.observer.set(target, key, value);
  }

  static delete(target: any, key: number | string) {
    if (!target.__owl__) {
      throw Error(
        "`Observer.delete()` can only be called with observed Objects"
      );
    }
    target.__owl__.observer.delete(target, key);
  }

  notifyCB() {}
  notifyChange() {
    this.dirty = true;
    Promise.resolve().then(() => {
      if (this.dirty) {
        this.dirty = false;
        this.notifyCB();
      }
    });
  }

  observe(value: any, parent?: any) {
    if (value === null) {
      // fun fact: typeof null === 'object'
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    if ("__owl__" in value) {
      // already observed
      value.__owl__.parent = parent;
      return;
    }
    if (Array.isArray(value)) {
      this._observeArr(value, parent);
    } else {
      this._observeObj(value, parent);
    }
  }

  set(target: any, key: number | string, value: any) {
    let alreadyDefined =
      key in target &&
      Object.getOwnPropertyDescriptor(target, key)!.configurable === false;
    if (alreadyDefined) {
      target[key] = value;
    } else {
      this._addProp(target, key, value);
      this._updateRevNumber(target);
    }
    this.notifyChange();
  }

  delete(target: any, key: number | string) {
    delete target[key];
    this._updateRevNumber(target);
    this.notifyChange();
  }

  _observeObj<T extends { __owl__?: any }>(obj: T, parent?: any) {
    obj.__owl__ = {
      rev: this.rev,
      deepRev: this.rev,
      parent,
      observer: this
    };
    Object.defineProperty(obj, "__owl__", { enumerable: false });
    for (let key in obj) {
      this._addProp(obj, key, obj[key]);
    }
  }

  _observeArr(arr: Array<any>, parent?: any) {
    (<any>arr).__owl__ = {
      rev: this.rev,
      deepRev: this.rev,
      parent,
      observer: this
    };
    Object.defineProperty(arr, "__owl__", { enumerable: false });
    (<any>arr).__proto__ = Object.create(ModifiedArrayProto);
    (<any>arr).__proto__.__observer__ = this;
    for (let i = 0, iLen = arr.length; i < iLen; i++) {
      this.observe(arr[i], arr);
    }
  }

  _addProp<T extends { __owl__?: any }>(
    obj: T,
    key: string | number,
    value: any
  ) {
    var self = this;
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: true,
      get() {
        return value;
      },
      set(newVal) {
        if (newVal !== value) {
          if (!self.allowMutations) {
            throw new Error(
              `Observed state cannot be changed here! (key: "${key}", val: "${newVal}")`
            );
          }
          self._updateRevNumber(obj);
          value = newVal;
          self.observe(newVal, obj);
          self.notifyChange();
        }
      }
    });
    this.observe(value, obj);
  }
  _updateRevNumber(target: any) {
    this.rev++;
    target.__owl__.rev!++;
    let parent = target;
    do {
      parent.__owl__.deepRev++;
    } while ((parent = parent.__owl__.parent) && parent !== target);
  }
}
