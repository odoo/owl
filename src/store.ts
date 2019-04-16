import { Component } from "./component";
import { EventBus } from "./event_bus";
import { makeObserver, Observer } from "./observer";

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
    const currentRev = this.observer.rev;
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
          if (currentRev !== this.observer.rev) {
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
// Connect function
//------------------------------------------------------------------------------

function revNumber<T extends Object>(o: T): number {
  if (o !== null && typeof o === "object" && (<any>o).__owl__) {
    return (<any>o).__owl__.rev;
  }
  return 0;
}

function deepRevNumber<T extends Object>(o: T): number {
  if (o !== null && typeof o === "object" && (<any>o).__owl__) {
    return (<any>o).__owl__.deepRev;
  }
  return 0;
}

export function connect(mapStateToProps, options: any = {}) {
  let hashFunction = options.hashFunction || null;

  if (!hashFunction) {
    let deep = "deep" in options ? options.deep : true;
    let defaultRevFunction = deep ? deepRevNumber : revNumber;
    hashFunction = function({ storeProps }, options) {
      const { currentStoreProps } = options;
      if ("__owl__" in storeProps) {
        return defaultRevFunction(storeProps);
      }
      let hash = 0;
      for (let key in storeProps) {
        const val = storeProps[key];
        const hashVal = defaultRevFunction(val);
        if (hashVal === 0) {
          if (val !== currentStoreProps[key]) {
            options.didChange = true;
          }
        } else {
          hash += hashVal;
        }
      }
      return hash;
    };
  }

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
        this.__owl__.storeHash = hashFunction(
          {
            state: env.store.state,
            storeProps: storeProps,
            revNumber,
            deepRevNumber
          },
          {
            currentStoreProps: storeProps
          }
        );
      }
      mounted() {
        this.env.store.on("update", this, () => {
          const ownProps = this.__owl__.ownProps;
          const storeProps = mapStateToProps(this.env.store.state, ownProps);
          const options: any = {
            currentStoreProps: this.__owl__.currentStoreProps
          };
          const storeHash = hashFunction(
            {
              state: this.env.store.state,
              storeProps: storeProps,
              revNumber,
              deepRevNumber
            },
            options
          );
          let didChange = options.didChange;
          if (storeHash !== this.__owl__.storeHash) {
            didChange = true;
            this.__owl__.storeHash = storeHash;
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
