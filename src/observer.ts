//------------------------------------------------------------------------------
// Observer
//------------------------------------------------------------------------------

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

export class Observer {
  rev: number = 1;
  allowMutations: boolean = true;
  dirty: boolean = false;

  notifyCB() {}
  notifyChange() {
    this.rev++;
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
      return;
    }
    if (Array.isArray(value)) {
      this._observeArr(value, parent);
    } else {
      this._observeObj(value, parent);
    }
  }

  set(target: any, key: number | string, value: any) {
    this._addProp(target, key, value);
    target.__owl__.rev++;
    this.notifyChange();
  }

  unobserve(target: any) {
    if (target !== null && typeof target === "object") {
      delete target.__owl__;
    }
  }

  _observeObj<T extends { __owl__?: any }>(obj: T, parent?: any) {
    const keys = Object.keys(obj);
    obj.__owl__ = { rev: 1, deepRev: 1, parent };
    Object.defineProperty(obj, "__owl__", { enumerable: false });
    for (let key of keys) {
      this._addProp(obj, key, obj[key]);
    }
  }

  _observeArr(arr: Array<any>, parent?: any) {
    (<any>arr).__owl__ = { rev: 1, deepRev: 1, parent };
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
        if (!self.allowMutations) {
          throw new Error(
            `State cannot be changed outside a mutation! (key: "${key}", val: "${newVal}")`
          );
        }
        if (newVal !== value) {
          self.unobserve(value);
          value = newVal;
          self.observe(newVal, obj);
          obj.__owl__.rev!++;
          let parent = obj;
          do {
            parent.__owl__.deepRev++;
          } while ((parent = parent.__owl__.parent));
          self.notifyChange();
        }
      }
    });
    this.observe(value, obj);
  }
}
