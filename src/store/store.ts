import { Env } from "../component/component";
import { Context } from "../Context";

/**
 * Owl Store
 *
 * We have here:
 * - a Store class
 * - the ConnectedComponent class
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

  constructor(config: StoreConfig) {
    super(config.state);
    this.actions = config.actions;
    this.env = config.env;
    this.getters = {};
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
