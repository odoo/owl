import { Component, Env } from "./component";
import { EventBus } from "./event_bus";
import { Observer } from "./observer";

//------------------------------------------------------------------------------
// Store Definition
//------------------------------------------------------------------------------

type Mutation = ({state, commit, set}, payload: any) => void;
type Action = ({commit, state, dispatch, env}, payload: any) => void;

interface StoreConfig {
  env?: Env;
  state?: any;
  actions?: {[name: string]: Action};
  mutations?: { [name: string]: Mutation };
}

interface StoreOption {
  debug?: boolean;
}

export class Store extends EventBus {
  state: any;
  actions: any;
  mutations: any;
  _commitLevel: number = 0;
  history: any[] = [];
  debug: boolean;
  env: any;
  observer: Observer;
  set: any;

  constructor(config: StoreConfig, options: StoreOption = {}) {
    super();
    this.debug = options.debug || false;
    this.state = config.state || {};
    this.actions = config.actions;
    this.mutations = config.mutations;
    this.env = config.env;
    this.observer = new Observer();
    this.observer.notifyCB = this.trigger.bind(this, "update");
    this.observer.allowMutations = false;
    this.observer.observe(this.state);

    if (this.debug) {
      this.history.push({ state: this.state });
    }
    this.set = this.observer.set.bind(this.observer);
  }

  dispatch(action: string, payload?: any): Promise<void> | void {
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

  commit(type: string, payload?: any): any {
    if (!this.mutations[type]) {
      throw new Error(`[Error] mutation ${type} is undefined`);
    }
    this._commitLevel++;
    this.observer.allowMutations = true;

    const res = this.mutations[type].call(
      null,
      {
        commit: this.commit.bind(this),
        state: this.state,
        set: this.set
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

type Constructor<T> = new (...args: any[]) => T;
interface EnvWithStore extends Env {
  store: Store;
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

  return function<E extends EnvWithStore, P, S>(
    Comp: Constructor<Component<E, P, S>>
  ) {
    return class extends Comp {
      constructor(parent, props?: any) {
        const env = parent instanceof Component ? parent.env : parent;
        const ownProps = Object.assign({}, props || {});
        const storeProps = mapStateToProps(env.store.state, ownProps);
        const mergedProps = Object.assign({}, props || {}, storeProps);
        super(parent, mergedProps);
        (<any>this.__owl__).ownProps = ownProps;
        (<any>this.__owl__).currentStoreProps = storeProps;
        (<any>this.__owl__).storeHash = hashFunction(
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
      /**
       * We do not use the mounted hook here for a subtle reason: we want the
       * updates to be called for the parents before the children.  However,
       * if we use the mounted hook, this will be done in the reverse order.
       */
      _callMounted() {
        this.env.store.on("update", this, this._checkUpdate);
        super._callMounted();
      }
      willUnmount() {
        this.env.store.off("update", this);
        super.willUnmount();
      }

      _checkUpdate() {
        const ownProps = (<any>this.__owl__).ownProps;
        const storeProps = mapStateToProps(this.env.store.state, ownProps);
        const options: any = {
          currentStoreProps: (<any>this.__owl__).currentStoreProps
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
        if (storeHash !== (<any>this.__owl__).storeHash) {
          didChange = true;
          (<any>this.__owl__).storeHash = storeHash;
        }
        if (didChange) {
          (<any>this.__owl__).currentStoreProps = storeProps;
          this._updateProps(ownProps, false);
        }
      }
      _updateProps(nextProps, forceUpdate, patchQueue?: any[]) {
        if ((<any>this.__owl__).ownProps !== nextProps) {
          (<any>this.__owl__).currentStoreProps = mapStateToProps(
            this.env.store.state,
            nextProps
          );
        }
        (<any>this.__owl__).ownProps = nextProps;
        const mergedProps = Object.assign(
          {},
          nextProps,
          (<any>this.__owl__).currentStoreProps
        );
        return super._updateProps(mergedProps, forceUpdate, patchQueue);
      }
    };
  };
}
