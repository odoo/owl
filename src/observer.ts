//------------------------------------------------------------------------------
// Observer
//------------------------------------------------------------------------------
export interface Observer {
  rev: number;
  allowMutations: boolean;
  observe: (val: any) => void;
  set: (target: any, key: number | string, value: any) => void;
}

export function makeObserver(): Observer {
  const observer: Observer = {
    rev: 1,
    allowMutations: true,
    observe: observe,
    set: set
  };

  function set(target: any, key: number | string, value: any) {
    addProp(target, key, value);
    target.__owl__.rev++;
    observer.rev++;
  }

  function addProp<T extends { __owl__?: any }>(
    obj: T,
    key: string | number,
    value: any
  ) {
    Object.defineProperty(obj, key, {
      enumerable: true,
      get() {
        return value;
      },
      set(newVal) {
        if (!observer.allowMutations) {
          throw new Error(
            `State cannot be changed outside a mutation! (key: "${key}", val: "${newVal}")`
          );
        }
        if (newVal !== value) {
          unobserve(value);
          value = newVal;
          observe(newVal, obj);
          obj.__owl__.rev!++;
          observer.rev++;
          let parent = obj;
          do {
            parent.__owl__.deepRev++;
          } while ((parent = parent.__owl__.parent));
        }
      }
    });
    observe(value, obj);
  }

  function observeObj<T extends { __owl__?: any }>(obj: T, parent?: any) {
    const keys = Object.keys(obj);
    obj.__owl__ = { rev: 1, deepRev: 1, parent };
    Object.defineProperty(obj, "__owl__", { enumerable: false });
    for (let key of keys) {
      addProp(obj, key, obj[key]);
    }
  }

  const ArrayProto = Array.prototype;
  const ModifiedArrayProto = Object.create(ArrayProto);

  const methodsToPatch = [
    "push",
    "pop",
    "shift",
    "unshift",
    "splice",
    "sort",
    "reverse"
  ];

  for (let method of methodsToPatch) {
    const initialMethod = ArrayProto[method];
    ModifiedArrayProto[method] = function(...args) {
      observer.rev++;
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
          observe(elem, this);
        }
      }
      return initialMethod.call(this, ...args);
    };
  }

  function observeArr(arr: Array<any>, parent?: any) {
    (<any>arr).__owl__ = { rev: 1, deepRev: 1, parent };
    Object.defineProperty(arr, "__owl__", { enumerable: false });
    (<any>arr).__proto__ = ModifiedArrayProto;
    for (let i = 0; i < arr.length; i++) {
      observe(arr[i], arr);
    }
  }

  function observe(value: any, parent?: any) {
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
      observeArr(value, parent);
    } else {
      observeObj(value, parent);
    }
  }

  function unobserve(target: any) {
    if (target !== null && typeof target === "object") {
      delete target.__owl__;
    }
  }

  return observer;
}
