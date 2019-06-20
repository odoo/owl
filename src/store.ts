import { Component, Env } from "./component";
import { EventBus } from "./event_bus";
import { Observer } from "./observer";

/**
 * Owl Store
 *
 * We have here:
 * - a Store class
 * - a connect function
 *
 * The Owl store is our answer to the problem of managing complex state across
 * components. The main idea is that the store owns some state, allow external
 * code to modify it through actions/mutations, and for each state changes,
 * connected component will be notified, and updated if necessary.
 *
 * Note that this code is partly inspired by VueX and React/Redux
 */

//------------------------------------------------------------------------------
// Store Definition
//------------------------------------------------------------------------------

type Mutation = ({ state, commit, getters }, payload: any) => void;
type Action = ({ commit, state, dispatch, env, getters }, payload: any) => void;
type Getter = ({ state, getters }, payload) => any;

interface StoreConfig {
  env?: Env;
  state?: any;
  actions?: { [name: string]: Action };
  getters?: { [name: string]: Getter };
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
  getters: { [name: string]: (payload?) => any };
  _gettersCache: { [name: string]: {} };

  constructor(config: StoreConfig, options: StoreOption = {}) {
    super();
    this.debug = options.debug || false;
    this.state = config.state || {};
    this.actions = config.actions;
    this.mutations = config.mutations;
    this.env = config.env;
    this.observer = new Observer();
    this.observer.notifyCB = () => {
      this._gettersCache = {};
      this.trigger("update");
    };
    this.observer.allowMutations = false;
    this.observer.observe(this.state);
    this.getters = {};
    this._gettersCache = {};

    if (this.debug) {
      this.history.push({ state: this.state });
    }

    const cTypes = ["undefined", "number", "string"];
    for (let entry of Object.entries(config.getters || {})) {
      const name: string = entry[0];
      const func: (...any) => any = entry[1];
      this.getters[name] = payload => {
        if (this._commitLevel === 0 && cTypes.indexOf(typeof payload) >= 0) {
          this._gettersCache[name] = this._gettersCache[name] || {};
          this._gettersCache[name][payload] =
            this._gettersCache[name][payload] ||
            func({ state: this.state, getters: this.getters }, payload);
          return this._gettersCache[name][payload];
        }
        return func({ state: this.state, getters: this.getters }, payload);
      };
    }
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
        state: this.state,
        getters: this.getters
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
        getters: this.getters
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
type HashFunction = (a: any, b: any) => number;
interface StoreOptions {
  getStore?(Env): Store;
  hashFunction?: HashFunction;
  deep?: boolean;
}

export function connect<E extends EnvWithStore, P, S>(
  Comp: Constructor<Component<E, P, S>>,
  mapStoreToProps,
  options: StoreOptions = <StoreOptions>{}
) {
  let hashFunction = options.hashFunction || null;
  const getStore = options.getStore || (env => env.store);

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

  const Result = class extends Comp {
    constructor(parent, props?: any) {
      const env = parent instanceof Component ? parent.env : parent;
      const store = getStore(env);
      const ownProps = Object.assign({}, props || {});
      const storeProps = mapStoreToProps(store.state, ownProps, store.getters);
      const mergedProps = Object.assign({}, props || {}, storeProps);
      super(parent, mergedProps);
      (<any>this.__owl__).ownProps = ownProps;
      (<any>this.__owl__).currentStoreProps = storeProps;
      (<any>this.__owl__).store = store;
      (<any>this.__owl__).storeHash = (<HashFunction>hashFunction)(
        {
          state: store.state,
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
      (<any>this.__owl__).store.on("update", this, this._checkUpdate);
      super._callMounted();
    }
    willUnmount() {
      (<any>this.__owl__).store.off("update", this);
      super.willUnmount();
    }

    _checkUpdate() {
      const ownProps = (<any>this.__owl__).ownProps;
      const storeProps = mapStoreToProps(
        (<any>this.__owl__).store.state,
        ownProps,
        (<any>this.__owl__).store.getters
      );
      const options: any = {
        currentStoreProps: (<any>this.__owl__).currentStoreProps
      };
      const storeHash = (<HashFunction>hashFunction)(
        {
          state: (<any>this.__owl__).store.state,
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
        (<any>this.__owl__).currentStoreProps = mapStoreToProps(
          (<any>this.__owl__).store.state,
          nextProps,
          (<any>this.__owl__).store.getters
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

  // we assign here a unique name to the resulting anonymous class.
  // this is necessary for Owl to be able to properly deduce templates.
  // Otherwise, all connected components would have the same name, and then
  // each component after the first will necessarily have the same template.
  let name = `Connected${Comp.name}`;
  Object.defineProperty(Result, "name", { value: name });
  return Result;
}
