import { EventBus } from "./event_bus";
import { Component } from "./component";
import { shallowEqual } from "./utils";

interface StoreConfig {
  env?: any;
  state?: any;
  actions?: any;
  mutations?: any;
}

interface StoreOption {
  debug?: boolean;
}
export class Store extends EventBus {
  state: any;
  mstate: any;
  actions: any;
  mutations: any;
  _isMutating: boolean = false;
  _isDirty: boolean = false;
  history: any[] = [];
  debug: boolean;
  env: any;

  constructor(config: StoreConfig, options: StoreOption = {}) {
    super();
    this.debug = options.debug || false;
    this.state = Object.assign({}, config.state);
    const self = this;
    this.mstate = magify({
      raw: this.state,
      key: "state",
      parent: this,
      onDirty: function() {
        self._isDirty = true;
      }
    });
    this.actions = config.actions;
    this.mutations = config.mutations;
    this.env = config.env;

    if (this.debug) {
      this.history.push({ state: this.state });
    }
  }

  dispatch(action, payload?: any) {
    if (!this.actions[action]) {
      throw new Error(`[Error] action ${action} is undefined`);
    }
    this.actions[action](
      {
        commit: this.commit.bind(this),
        dispatch: this.dispatch.bind(this),
        env: this.env,
        state: this.state
      },
      payload
    );
  }

  async commit(type, payload?: any) {
    if (!this.mutations[type]) {
      throw new Error(`[Error] mutation ${type} is undefined`);
    }
    this._isMutating = true;

    this.mutations[type].call(null, this.mstate, payload);
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
      if (this._isDirty) {
        this._isDirty = false;
        this.trigger("update", this.state);
      }
    }
  }
}

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

function _magifyArray({ raw, key, parent, magic, onDirty }) {
  Object.defineProperty(magic, "length", {
    get() {
      return magic.raw.length;
    }
  });
  Object.assign(magic, {
    push: function(item) {
      onDirty();
      parent.raw[key] = [...magic.raw, item];
      magic.raw = parent.raw[key];
      const index = magic.raw.length - 1;
      let prop = magify({ raw: item, key: index, parent: magic, onDirty });
      Object.defineProperty(magic, index, {
        set(newVal) {
          onDirty();
          parent.raw[key] = [...magic.raw];
          parent.raw[key][index] = newVal;
          magic.raw = parent.raw[key];
          prop = magify({ raw: newVal, key: index, parent: magic, onDirty });
        },
        get() {
          return prop;
        }
      });
    }
  });
  raw.forEach((value, index) => {
    let prop = magify({
      raw: value,
      key: index,
      parent: magic,
      onDirty
    });
    Object.defineProperty(magic, index, {
      set(newVal) {
        onDirty();
        parent.raw[key] = [...magic.raw];
        parent.raw[key][index] = newVal;
        magic.raw = parent.raw[key];
        prop = magify({ raw: newVal, key: index, parent: magic, onDirty });
      },
      get() {
        return prop;
      }
    });
  });
}

function magify({ raw, key, parent, onDirty }) {
  if (!parent.magic) {
    parent = {
      raw: parent,
      magic: true,
      parent: null
    };
  }
  if (raw.magic) {
    return raw;
  }
  if (typeof raw !== "object") {
    return raw;
  }
  let magic = { raw, key, parent, magic: true };
  if (Array.isArray(raw)) {
    _magifyArray({ raw, key, parent, magic, onDirty });
  } else {
    Object.keys(raw).forEach(propKey => {
      let prop = magify({
        raw: raw[propKey],
        key: propKey,
        parent: magic,
        onDirty
      });
      Object.defineProperty(magic, propKey, {
        set(newVal) {
          onDirty();
          parent.raw[key] = { ...magic.raw, [propKey]: newVal };
          magic.raw = parent.raw[key];
          prop = magify({ raw: newVal, key: propKey, parent: magic, onDirty });
        },
        get() {
          return prop;
        }
      });
    });
  }
  return magic;
}
