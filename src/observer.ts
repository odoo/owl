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
const ArrayProto = Array.prototype;
const ModifiedArrayProto = Object.create(ArrayProto);

for (let method of methodsToPatch) {
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
      for (let elem of inserted) {
        this.__observer__.observe(elem, this);
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
    this.rev++;
    this._addProp(target, key, value);
    target.__owl__.rev++;
    this.notifyChange();
  }

  _observeObj<T extends { __owl__?: any }>(obj: T, parent?: any) {
    const keys = Object.keys(obj);
    obj.__owl__ = { rev: this.rev, deepRev: this.rev, parent };
    Object.defineProperty(obj, "__owl__", { enumerable: false });
    for (let key of keys) {
      this._addProp(obj, key, obj[key]);
    }
  }

  _observeArr(arr: Array<any>, parent?: any) {
    (<any>arr).__owl__ = { rev: this.rev, deepRev: this.rev, parent };
    Object.defineProperty(arr, "__owl__", { enumerable: false });
    (<any>arr).__proto__ = Object.create(ModifiedArrayProto);
    (<any>arr).__proto__.__observer__ = this;
    for (let i = 0; i < arr.length; i++) {
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
      enumerable: true,
      get() {
        return value;
      },
      set(newVal) {
        if (newVal !== value) {
          self.rev++;
          if (!self.allowMutations) {
            throw new Error(
              `Observed state cannot be changed here! (key: "${key}", val: "${newVal}")`
            );
          }
          value = newVal;
          self.observe(newVal, obj);
          obj.__owl__.rev!++;
          let parent = obj;
          do {
            parent.__owl__.deepRev++;
          } while ((parent = parent.__owl__.parent) && parent !== obj);
          self.notifyChange();
        }
      }
    });
    this.observe(value, obj);
  }
}
