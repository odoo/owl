import { EventBus } from "./event_bus";
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
  _commitLevel: number = 0;
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

  commit(type, payload?: any) {
    if (!this.mutations[type]) {
      throw new Error(`[Error] mutation ${type} is undefined`);
    }
    this._commitLevel++;
    const currentRev = this.observer.__rev__;
    this._isMutating = true;
    this.observer.allowMutations = true;


    const res = this.mutations[type].call(
      null,
      {
        commit: this.commit.bind(this),
        state: this.state,
        set: this.observer.set
      },
      payload
    );

    if (this._commitLevel === 1) {
      this.observer.allowMutations = false;
      if (this.debug) {
        this.history.push({
          state: this.state,
          mutation: type,
          payload: payload
        });
      }
      Promise.resolve().then(() => {
        if (this._isMutating) {
          this._isMutating = false;
          if (currentRev !== this.observer.__rev__) {
            this.trigger("update", this.state);
          }
        }
      });
    }
    this._commitLevel--;
    return res;
  }
}

//------------------------------------------------------------------------------
// Observer
//------------------------------------------------------------------------------
interface Observer {
  __rev__: number;
  allowMutations: boolean;
  observe: (val: any) => void;
  set: (target: any, key: number | string, value: any) => void;
}

export function makeObserver(): Observer {
  const observer: Observer = {
    __rev__: 0,
    allowMutations: true,
    observe: observe,
    set: set
  };

  function set(target: any, key: number | string, value: any) {
    addProp(target, key, value);
    target.__rev__++;
    observer.__rev__++;
  }

  function addProp<T extends { __rev__?: number }>(
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
          observe(newVal);
          obj.__rev__!++;
          observer.__rev__++;
        }
      }
    });
    observe(value);
  }

  function observeObj<T extends { __rev__?: number }>(obj: T) {
    const keys = Object.keys(obj);
    obj.__rev__ = 0;
    Object.defineProperty(obj, "__rev__", { enumerable: false });
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
      observer.__rev__++;
      this.__rev__++;
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
          observe(elem);
        }
      }
      return initialMethod.call(this, ...args);
    };
  }

  function observeArr(arr: Array<any>) {
    (<any>arr).__rev__ = 0;
    Object.defineProperty(arr, "__rev__", { enumerable: false });
    (<any>arr).__proto__ = ModifiedArrayProto;
    for (let i = 0; i < arr.length; i++) {
      observe(arr[i]);
    }
  }

  function observe(value: any) {
    if (value === null) {
      // fun fact: typeof null === 'object'
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    if ("__rev__" in value) {
      // already observed
      return;
    }
    if (Array.isArray(value)) {
      observeArr(value);
    } else {
      observeObj(value);
    }
  }

  return observer;
}

//------------------------------------------------------------------------------
// Connect function
//------------------------------------------------------------------------------

function setStoreProps(__owl__: any, storeProps: any) {
  __owl__.currentStoreProps = storeProps;
  __owl__.currentStoreRevs = {};
  __owl__.currentStoreRev = storeProps.__rev__;
  for (let key in storeProps) {
    __owl__.currentStoreRevs[key] = storeProps[key].__rev__;
  }
}

export function connect(mapStateToProps) {
  return function(Comp) {
    return class extends Comp {
      constructor(parent, props?: any) {
        const env = parent instanceof Component ? parent.env : parent;
        const ownProps = Object.assign({}, props || {});
        const storeProps = mapStateToProps(env.store.state, ownProps);
        const mergedProps = Object.assign({}, props || {}, storeProps);
        super(parent, mergedProps);
        setStoreProps(this.__owl__, storeProps);
        this.__owl__.ownProps = ownProps;
      }
      mounted() {
        this.env.store.on("update", this, () => {
          const ownProps = this.__owl__.ownProps;
          const storeProps = mapStateToProps(this.env.store.state, ownProps);
          let didChange = false;
          if (this.__owl__.currentStoreRev !== storeProps.__rev__) {
            setStoreProps(this.__owl__, storeProps);
            didChange = true;
          } else {
            const revs = this.__owl__.currentStoreRevs;
            for (let key in storeProps) {
              const val = storeProps[key];
              if (val.__rev__ !== revs[key]) {
                didChange = true;
                revs[key] = val.__rev__;
                this.__owl__.currentStoreProps[key] = val;
              }
            }
          }
          if (didChange) {
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
