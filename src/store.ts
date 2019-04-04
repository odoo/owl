import { EventBus } from "./event_bus";
import { Component } from "./component";
import { shallowEqual } from "./utils";

export function connect(mapStateToProps) {
  return function(Comp) {
    return class extends Comp {
      constructor(parent, props?: any) {
        const env = parent instanceof Component ? parent.env : parent;
        const ownProps = Object.assign({}, props || {});
        const storeProps = mapStateToProps(env.store.state, ownProps);
        const mergedProps = Object.assign(props || {}, storeProps);
        super(parent, mergedProps);
        this.__widget__.currentStoreProps = storeProps;
        this.__widget__.ownProps = ownProps;
      }
      mounted() {
        this.env.store.on("update", this, () => {
          const ownProps = this.__widget__.ownProps;
          const storeProps = mapStateToProps(this.env.store.state, ownProps);
          if (!shallowEqual(storeProps, this.__widget__.currentStoreProps)) {
            this.__widget__.currentStoreProps = storeProps;
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
        if (this.__widget__.ownProps !== nextProps) {
          this.__widget__.currentStoreProps = mapStateToProps(
            this.env.store.state,
            nextProps
          );
        }
        this.__widget__.ownProps = nextProps;
        const mergedProps = Object.assign(
          {},
          nextProps,
          this.__widget__.currentStoreProps
        );
        return super.updateProps(mergedProps, forceUpdate);
      }
    };
  };
}

interface StoreConfig {
  state?: any;
  actions?: any;
  mutations?: any;
}

interface StoreOption {
  debug?: boolean;
}
export class Store extends EventBus {
  _state: any;
  actions: any;
  mutations: any;
  _isMutating: boolean = false;
  history: any[] = [];
  debug: boolean;

  constructor(config: StoreConfig, options: StoreOption = {}) {
    super();
    this.debug = options.debug || false;
    this._state = Object.assign({}, config.state);
    this.actions = config.actions;
    this.mutations = config.mutations;

    if (this.debug) {
      this.history.push({ state: this.state });
    }
  }

  get state() {
    return this._clone(this._state);
  }

  dispatch(action, payload) {
    if (!this.actions[action]) {
      throw new Error(`[Error] action ${action} is undefined`);
    }
    this.actions[action](
      {
        commit: this.commit.bind(this),
        state: this.state
      },
      payload
    );
  }

  async commit(type, payload) {
    if (!this.mutations[type]) {
      throw new Error(`[Error] mutation ${type} is undefined`);
    }
    this._isMutating = true;

    this.mutations[type].call(null, this._state, payload);
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
      this.trigger("update", this.state);
    }
  }

  _clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}
