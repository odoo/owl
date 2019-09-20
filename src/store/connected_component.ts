import { Component, Env, Fiber } from "../component/component";
import { VNode } from "../vdom/index";

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
  async __prepareAndRender(fiber: Fiber<P>): Promise<VNode> {
    const store = this.getStore(this.env);
    const ownProps = this.props || {};
    this.storeProps = (<any>this.constructor).mapStoreToProps(store.state, ownProps, store.getters);
    const observer = store.observer;
    const revFn = this.deep ? observer.deepRevNumber : observer.revNumber;
    (this.__owl__ as any).store = store;
    (this.__owl__ as any).ownProps = this.props;
    (this.__owl__ as any).revFn = revFn.bind(observer);
    (this.__owl__ as any).storeHash = this.hashFunction(this.storeProps, {
      prevStoreProps: this.storeProps
    });
    (this.__owl__ as any).rev = observer.rev;
    return super.__prepareAndRender(fiber);
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
  __destroy(parent: any) {
    (this.__owl__ as any).store.off("update", this);
    super.__destroy(parent);
  }

  async render(force: boolean = false) {
    this.__updateStoreProps(this.props);

    // this is quite technical, so this deserves some explanation.
    // When we have a connected component, it can be updated for 3 reasons:
    // - some internal state changes (this will go through this method)
    // - some props changes (if a parent is changed and need to rerender itself)
    // - a store update
    //
    // It is possible (with connected component and parent) to have the following
    // situation: the parent component is rendered first (from its state change),
    // then immediately after, it is rendered (from store update). Then, if the
    // __checkUpdate method is immediately over, the children component will
    // be rendered again by the store update, even though it is supposed to be
    // destroyed by the first rendering.
    //
    // So, the solution is to keep the information that there is a current
    // rendering occuring with the same store state, the same props, and return
    // that in the __checkUpdate method.  To do this, we use the renderPromise
    // deferred, which is not used by the component system once the
    // component is ready, so we can use it for our own purpose.
    (this.__owl__ as any).renderPromise = super.render(force);
    return (this.__owl__ as any).renderPromise;
  }

  async __updateProps(nextProps: P, f, s, v) {
    this.__updateStoreProps(nextProps);
    return super.__updateProps(nextProps, f, s, v);
  }

  __updateStoreProps(nextProps): boolean {
    const __owl__ = this.__owl__ as any;
    const store = __owl__.store;
    const observer = store.observer;
    if (observer.rev === __owl__.rev && nextProps === __owl__.ownProps) {
      return false;
    }

    const storeProps = (<any>this.constructor).mapStoreToProps(
      store.state,
      nextProps,
      store.getters
    );
    const options = { prevStoreProps: this.storeProps, didChange: false };
    const storeHash = this.hashFunction(storeProps, options);
    this.storeProps = storeProps;
    let didChange = options.didChange;
    if (storeHash !== __owl__.storeHash) {
      __owl__.storeHash = storeHash;
      didChange = true;
    }
    __owl__.rev = store.observer.rev;
    __owl__.ownProps = nextProps;
    return didChange;
  }

  async __checkUpdate() {
    const didChange = this.__updateStoreProps(this.props);
    if (didChange) {
      return this.render();
    }
    // see note in render method
    return (this.__owl__ as any).renderPromise;
  }
}
