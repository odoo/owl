import { Env } from "../component/component";
import { EventBus } from "../core/event_bus";
import { Observer } from "../core/observer";

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

interface StoreOption {
  debug?: boolean;
}

export class Store extends EventBus {
  state: any;
  actions: any;
  mutations: any;
  debug: boolean;
  env: any;
  observer: Observer;
  getters: { [name: string]: (payload?) => any };

  constructor(config: StoreConfig, options: StoreOption = {}) {
    super();
    this.debug = options.debug || false;
    this.actions = config.actions;
    this.env = config.env;
    this.observer = new Observer();
    this.observer.notifyCB = this.__notifyComponents.bind(this);
    this.state = this.observer.observe(config.state || {});
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

  /**
   * Instead of using trigger to emit an update event, we actually implement
   * our own function to do that.  The reason is that we need to be smarter than
   * a simple trigger function: we need to wait for parent components to be
   * done before doing children components.  The reason is that if an update
   * as an effect of destroying a children, we do not want to call the
   * mapStoreToProps function of the child, nor rendering it.
   *
   * This method is not optimal if we have a bunch of asynchronous components:
   * we wait sequentially for each component to be completed before updating the
   * next.  However, the only things that matters is that children are updated
   * after their parents.  So, this could be optimized by being smarter, and
   * updating all widgets concurrently, except for parents/children.
   */
  async __notifyComponents() {
    const subs = this.subscriptions.update || [];
    for (let i = 0, iLen = subs.length; i < iLen; i++) {
      const sub = subs[i];
      const shouldCallback = sub.owner ? sub.owner.__owl__.isMounted : true;
      if (shouldCallback) {
        await sub.callback.call(sub.owner);
      }
    }
  }
}
