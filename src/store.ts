import { EventBus } from "./event_bus";
import { shallowEqual } from "./utils";
import { Component } from "./component";

//------------------------------------------------------------------------------
// Store Definition
//------------------------------------------------------------------------------

interface StoreConfig {
  env?: any;
  state?: any;
  actions?: any;
  mutations?: { [name: string]: any };
}

interface StoreOption {
  debug?: boolean;
}

export class Store extends EventBus {
  state: any;
  actions: any;
  mutations: any;
  _isMutating: boolean = false;
  history: any[] = [];
  debug: boolean;
  env: any;
  observer: Observer;

  constructor(config: StoreConfig, options: StoreOption = {}) {
    super();
    this.debug = options.debug || false;
    this.state = config.state || {};
    this.actions = config.actions;
    this.mutations = config.mutations;
    this.env = config.env;
    this.observer = makeObserver();
    this.observer.allowMutations = false;
    this.observer.observe(this.state);

    if (this.debug) {
      this.history.push({ state: this.state });
    }
  }

  dispatch(action, payload?: any): Promise<void> | void {
    if (!this.actions[action]) {
      throw new Error(`[Error] action ${action} is undefined`);
    }
    const result = this.actions[action](
      {
        commit: this.commit.bind(this),
        dispatch: this.dispatch.bind(this),
        env: this.env,
        state: this.state
      },
      payload
    );
    if (result instanceof Promise) {
      return new Promise((resolve, reject) => {
        result.then(() => resolve());
        result.catch(reject);
      });
    }
  }

  async commit(type, payload?: any) {
    if (!this.mutations[type]) {
      throw new Error(`[Error] mutation ${type} is undefined`);
    }
    const currentRev = this.observer.rev;

    this._isMutating = true;
    this.observer.allowMutations = true;
    this.mutations[type].call(
      null,
      { state: this.state, set: this.observer.set },
      payload
    );
    this.observer.allowMutations = false;

    if (this.debug) {
      this.history.push({
        state: this.state,
        mutation: type,
        payload: payload
      });
    }
    await Promise.resolve();
    if (this._isMutating) {
      this._isMutating = false;
      if (currentRev !== this.observer.rev) {
        this.trigger("update", this.state);
      }
    }
  }
}

//------------------------------------------------------------------------------
// Observer
//------------------------------------------------------------------------------
interface Observer {
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

  return observer;
}

//------------------------------------------------------------------------------
// Connect function
//------------------------------------------------------------------------------

function revNumber<T extends Object>(o: T): number {
  if (!("__owl__" in o)) {
    return 0;
  }
  return (<any>o).__owl__.rev;
}

function deepRevNumber<T extends Object>(o: T): number {
  if (!("__owl__" in o)) {
    return 0;
  }
  return (<any>o).__owl__.deepRev;
}

export function connect(mapStateToProps, options: any = {}) {
  let hashFunction = options.hashFunction || null;

  return function(Comp) {
    return class extends Comp {
      constructor(parent, props?: any) {
        const env = parent instanceof Component ? parent.env : parent;
        const ownProps = Object.assign({}, props || {});
        const storeProps = mapStateToProps(env.store.state, ownProps);
        const mergedProps = Object.assign({}, props || {}, storeProps);
        super(parent, mergedProps);
        this.__owl__.ownProps = ownProps;
        this.__owl__.currentStoreProps = storeProps;
        if (!hashFunction) {
          if ("__owl__" in storeProps) {
            hashFunction = s => deepRevNumber(s.storeProps);
          } else {
            let areKeyObservable = false;
            for (let key in storeProps) {
              areKeyObservable =
                areKeyObservable || "__owl__" in storeProps[key];
            }
            if (areKeyObservable) {
              hashFunction = function({ storeProps }) {
                return Object.values(storeProps).reduce(
                  (sum: number, val: any) => sum + deepRevNumber(val),
                  0
                );
              };
            }
          }
        }
        if (hashFunction) {
          this.__owl__.storeHash = hashFunction({
            state: env.store.state,
            storeProps: storeProps,
            revNumber,
            deepRevNumber
          });
        }
      }
      mounted() {
        this.env.store.on("update", this, () => {
          const ownProps = this.__owl__.ownProps;
          const storeProps = mapStateToProps(this.env.store.state, ownProps);
          let didChange = false;
          if (hashFunction) {
            const storeHash = hashFunction({
              state: this.env.store.state,
              storeProps: storeProps,
              revNumber,
              deepRevNumber
            });
            if (storeHash !== this.__owl__.storeHash) {
              didChange = true;
              this.__owl__.storeHash = storeHash;
            }
          } else {
            didChange = !shallowEqual(
              storeProps,
              this.__owl__.currentStoreProps
            );
          }
          if (didChange) {
            this.__owl__.currentStoreProps = storeProps;
            this.updateProps(ownProps, false);
          }
        });
        super.mounted();
      }
      willUnmount() {
        this.env.store.off("update", this);
        super.willUnmount();
      }
      updateProps(nextProps, forceUpdate) {
        if (this.__owl__.ownProps !== nextProps) {
          this.__owl__.currentStoreProps = mapStateToProps(
            this.env.store.state,
            nextProps
          );
        }
        this.__owl__.ownProps = nextProps;
        const mergedProps = Object.assign(
          {},
          nextProps,
          this.__owl__.currentStoreProps
        );
        return super.updateProps(mergedProps, forceUpdate);
      }
    };
  };
}
