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
        getters: this.getters
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
        getters: this.getters
      },
      ...payload
    );
    return result;
  }
}

interface SelectorOptions {
  store?: Store;
  isEqual?: (a: any, b: any) => boolean;
}

const isStrictEqual = (a, b) => a === b;

export function useStore(selector, options: SelectorOptions = {}): any {
  const component: Component<any, any> = Component.current!;
  const store = options.store || (component.env.store as Store);
  let result = selector(store.state, component.props);
  const hashFn = store.observer.revNumber.bind(store.observer);
  let revNumber = hashFn(result) || result;
  const isEqual = options.isEqual || isStrictEqual;
  if (!store.updateFunctions[component.__owl__.id]) {
    store.updateFunctions[component.__owl__.id] = [];
  }
  const updateFunctions = store.updateFunctions[component.__owl__.id];
  updateFunctions.push(function(): boolean {
    const oldResult = result;
    result = selector(store!.state, component.props);
    const newRevNumber = hashFn(result);
    if (
      (newRevNumber > 0 && revNumber !== newRevNumber) ||
      (newRevNumber === 0 && !isEqual(oldResult, result))
    ) {
      revNumber = newRevNumber;
      return true;
    }
    return false;
  });

  useContextWithCB(store, component, function(): Promise<void> | void {
    let shouldRender = false;
    updateFunctions.forEach(function(updateFn) {
      shouldRender = updateFn() || shouldRender;
    });
    if (shouldRender) {
      return component.render();
    }
  });
  onWillUpdateProps(props => {
    delete store.updateFunctions[component.__owl__.id];
    result = selector(store.state, props);
  });
  return new Proxy(result, {
    get(target, k) {
      return result[k];
    },
    set(target, k, v) {
      result[k] = v;
      return true;
    }
  });
}

export function useDispatch(store?: Store): Store["dispatch"] {
  store = store || (Component.current!.env.store as Store);
  return store.dispatch.bind(store);
}

export function useGetters(store?: Store): Store["getters"] {
  store = store || (Component.current!.env.store as Store);
  return store.getters;
}
