import { EventBus } from "./event_bus";

export function StoreMixin(Component) {
  return class extends Component {
    mounted() {
      this.env.store.on("update", this, this.render);
    }
  };
}

interface StoreConfig {
  state?: any;
  actions?: any;
  mutations?: any;
}
export class Store extends EventBus {
  _state: any;
  actions: any;
  mutations: any;
  _isMutating: boolean = false;

  constructor(config: StoreConfig = {}) {
    super();
    this._state = Object.assign({}, config.state);
    this.actions = config.actions;
    this.mutations = config.mutations;
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

  commit(type, payload) {
    if (!this.mutations[type]) {
      throw new Error(`[Error] mutation ${type} is undefined`);
    }
    this._isMutating = true;
    this.mutations[type].call(null, this._state, payload);
    Promise.resolve().then(() => {
      if (this._isMutating) {
        this._isMutating = false;
        this.trigger("update");
      }
    });
  }

  _clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}
