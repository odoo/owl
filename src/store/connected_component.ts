import { Component, Env } from "../component/component";

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

type HashFunction = (a: any, b: any) => number;

export class ConnectedComponent<T extends Env, P, S> extends Component<T, P, S> {
  deep: boolean = true;
  getStore(env) {
    return env.store;
  }

  hashFunction: HashFunction = ({ storeProps }, options) => {
    let refFunction = this.deep ? deepRevNumber : revNumber;
    if ("__owl__" in storeProps) {
      return refFunction(storeProps);
    }
    const { currentStoreProps } = options;
    let hash = 0;
    for (let key in storeProps) {
      const val = storeProps[key];
      const hashVal = refFunction(val);
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

  static mapStoreToProps(storeState, ownProps, getters) {
    return {};
  }
  constructor(parent, props?: any) {
    super(parent, props);
    const store = this.getStore(this.env);
    const ownProps = Object.assign({}, props || {});
    const storeProps = (<any>this.constructor).mapStoreToProps(
      store.state,
      ownProps,
      store.getters
    );
    const mergedProps = Object.assign({}, props || {}, storeProps);
    this.props = mergedProps;
    (<any>this.__owl__).ownProps = ownProps;
    (<any>this.__owl__).currentStoreProps = storeProps;
    (<any>this.__owl__).store = store;
    (<any>this.__owl__).storeHash = this.hashFunction(
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
  __callMounted() {
    (<any>this.__owl__).store.on("update", this, this.__checkUpdate);
    super.__callMounted();
  }
  willUnmount() {
    (<any>this.__owl__).store.off("update", this);
    super.willUnmount();
  }

  async __checkUpdate(updateId) {
    if (updateId === (<any>this.__owl__).currentUpdateId) {
      return;
    }
    const ownProps = (<any>this.__owl__).ownProps;
    const storeProps = (<any>this.constructor).mapStoreToProps(
      (<any>this.__owl__).store.state,
      ownProps,
      (<any>this.__owl__).store.getters
    );
    const options: any = {
      currentStoreProps: (<any>this.__owl__).currentStoreProps
    };
    const storeHash = this.hashFunction(
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
      await this.__updateProps(ownProps, false);
    }
  }
  __updateProps(nextProps, forceUpdate, patchQueue?: any[]) {
    const __owl__ = <any>this.__owl__;
    __owl__.currentUpdateId = __owl__.store._updateId;
    if (__owl__.ownProps !== nextProps) {
      __owl__.currentStoreProps = (<any>this.constructor).mapStoreToProps(
        __owl__.store.state,
        nextProps,
        __owl__.store.getters
      );
    }
    __owl__.ownProps = nextProps;
    const mergedProps = Object.assign({}, nextProps, __owl__.currentStoreProps);
    return super.__updateProps(mergedProps, forceUpdate, patchQueue);
  }
}
