import { Component, Env } from "../component/component";

//------------------------------------------------------------------------------
// Connect function
//------------------------------------------------------------------------------

type HashFunction = (a: any, b: any) => number;

export class ConnectedComponent<T extends Env, P, S> extends Component<T, P, S> {
  deep: boolean = true;
  getStore(env) {
    return env.store;
  }

  storeProps: any;

  hashFunction: HashFunction = (storeProps, options) => {
    const revFn = (this.__owl__ as any).revFn;
    const rev = revFn(storeProps);
    if (rev > 0) {
      return rev;
    }
    let hash = 0;
    for (let key in storeProps) {
      const val = storeProps[key];
      const hashVal = revFn(val);
      if (hashVal === 0) {
        if (val !== options.prevStoreProps[key]) {
          options.didChange = true;
        }
      } else {
        hash += hashVal;
      }
    }
    return hash;
  };

  static mapStoreToProps(storeState, ownProps, getters) {
    return {};
  }

  dispatch(name, ...payload) {
    return (this.__owl__ as any).store.dispatch(name, ...payload);
  }

  /**
   * Need to do this here so 'deep' can be overrided by subcomponent easily
   */
  async __prepareAndRender(
    scope?: Object,
    vars?: any
  ): ReturnType<Component<any, any, any>["__prepareAndRender"]> {
    const store = this.getStore(this.env);
    const ownProps = this.props || {};
    this.storeProps = (<any>this.constructor).mapStoreToProps(store.state, ownProps, store.getters);
    const observer = store.observer;
    const revFn = this.deep ? observer.deepRevNumber : observer.revNumber;
    (this.__owl__ as any).store = store;
    (this.__owl__ as any).revFn = revFn.bind(observer);
    (this.__owl__ as any).storeHash = this.hashFunction(this.storeProps, {
      prevStoreProps: this.storeProps
    });
    (this.__owl__ as any).rev = observer.rev;
    return super.__prepareAndRender(scope, vars);
  }
  /**
   * We do not use the mounted hook here for a subtle reason: we want the
   * updates to be called for the parents before the children.  However,
   * if we use the mounted hook, this will be done in the reverse order.
   */
  __callMounted() {
    (this.__owl__ as any).store.on("update", this, this.__checkUpdate);
    super.__callMounted();
  }
  __callWillUnmount() {
    (this.__owl__ as any).store.off("update", this);
    super.__callWillUnmount();
  }

  async __updateProps(nextProps: P, f, p, s, v) {
    this.__updateStoreProps(nextProps);
    return super.__updateProps(nextProps, f, p, s, v);
  }

  __updateStoreProps(nextProps): boolean {
    const store = (this.__owl__ as any).store;
    const storeProps = (<any>this.constructor).mapStoreToProps(
      store.state,
      nextProps,
      store.getters
    );
    const options = { prevStoreProps: this.storeProps, didChange: false };
    const storeHash = this.hashFunction(storeProps, options);
    this.storeProps = storeProps;
    let didChange = options.didChange;
    if (storeHash !== (this.__owl__ as any).storeHash) {
      (this.__owl__ as any).storeHash = storeHash;
      didChange = true;
    }
    (this.__owl__ as any).rev = store.observer.rev;
    return didChange;
  }

  async __checkUpdate() {
    const observer = (this.__owl__ as any).store.observer;
    if (observer.rev === (this.__owl__ as any).rev) {
      // update was already done by updateProps, from parent
      return;
    }
    const didChange = this.__updateStoreProps(this.props);
    if (didChange) {
      this.render();
    }
  }
}
