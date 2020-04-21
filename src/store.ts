import { Component } from "./component/component";
import { Env } from "./component/component";
import { Context, useContextWithCB } from "./context";
import { onWillUpdateProps } from "./hooks";

/**
 * Owl Store
 *
 * We have here:
 * - a Store class
 * - useStore hook
 * - useDispatch hook
 * - useGetters hook
 *
 * The Owl store is our answer to the problem of managing complex state across
 * components. The main idea is that the store owns some state, allow external
 * code to modify it through actions, and for each state changes,
 * connected component will be notified, and updated if necessary.
 *
 * Note that this code is partly inspired by VueX and React/Redux
 */

//------------------------------------------------------------------------------
// Store Definition
//------------------------------------------------------------------------------

export interface EnvWithStore extends Env {
  store: Store;
}

export type Action = ({ state, dispatch, env, getters }, ...payload: any) => any;
export type Getter = ({ state: any, getters }, payload?) => any;

interface StoreConfig {
  env?: Env;
  state?: any;
  actions?: { [name: string]: Action };
  getters?: { [name: string]: Getter };
}

export class Store extends Context {
  actions: any;
  env: any;
  getters: { [name: string]: (payload?) => any };
  updateFunctions: { [key: number]: (() => boolean)[] };

  constructor(config: StoreConfig) {
    super(config.state);
    this.actions = config.actions;
    this.env = config.env;
    this.getters = {};
    this.updateFunctions = [];
    if (config.getters) {
      const firstArg = {
        state: this.state,
        getters: this.getters,
      };
      for (let g in config.getters) {
        this.getters[g] = config.getters[g].bind(this, firstArg);
      }
    }
  }

  dispatch(action: string, ...payload: any): Promise<void> | void {
    if (!this.actions[action]) {
      throw new Error(`[Error] action ${action} is undefined`);
    }
    const result = this.actions[action](
      {
        dispatch: this.dispatch.bind(this),
        env: this.env,
        state: this.state,
        getters: this.getters,
      },
      ...payload
    );
    return result;
  }
}

interface SelectorOptions {
  store?: Store;
  isEqual?: (a: any, b: any) => boolean;
  onUpdate?: (result: any) => any;
}

const isStrictEqual = (a, b) => a === b;

export function useStore(selector, options: SelectorOptions = {}): any {
  const component = Component.current as Component<any, EnvWithStore>;
  const componentId = component.__owl__.id;
  const store = options.store || (component.env.store as Store);
  if (!(store instanceof Store)) {
    throw new Error(`No store found when connecting '${component.constructor.name}'`);
  }
  let result = selector(store.state, component.props);
  const hashFn = store.observer.revNumber.bind(store.observer);
  let revNumber = hashFn(result);
  const isEqual = options.isEqual || isStrictEqual;
  if (!store.updateFunctions[componentId]) {
    store.updateFunctions[componentId] = [];
  }
  function selectCompareUpdate(state, props): boolean {
    const oldResult = result;
    result = selector(state, props);
    const newRevNumber = hashFn(result);
    if ((newRevNumber > 0 && revNumber !== newRevNumber) || !isEqual(oldResult, result)) {
      revNumber = newRevNumber;
      if (options.onUpdate) {
        options.onUpdate(result);
      }
      return true;
    }
    return false;
  }
  store.updateFunctions[componentId].push(function (): boolean {
    return selectCompareUpdate(store!.state, component.props);
  });

  useContextWithCB(store, component, function (): Promise<void> | void {
    let shouldRender = false;
    for (let fn of store.updateFunctions[componentId]) {
      shouldRender = fn() || shouldRender;
    }
    if (shouldRender) {
      return component.render();
    }
  });
  onWillUpdateProps((props) => {
    selectCompareUpdate(store.state, props);
  });

  const __destroy = component.__destroy;
  component.__destroy = (parent) => {
    delete store.updateFunctions[componentId];
    __destroy.call(component, parent);
  };

  if (typeof result !== "object" || result === null) {
    return result;
  }
  return new Proxy(result, {
    get(target, k) {
      return result[k];
    },
    set(target, k, v) {
      throw new Error("Store state should only be modified through actions");
    },
    has(target, k) {
      return k in result;
    },
  });
}

export function useDispatch(store?: Store): Store["dispatch"] {
  store = store || (Component.current!.env as EnvWithStore).store;
  return store.dispatch.bind(store);
}

export function useGetters(store?: Store): Store["getters"] {
  store = store || (Component.current!.env as EnvWithStore).store;
  return store.getters;
}
