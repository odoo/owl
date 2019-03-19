import { Component } from "../../../../../src/component";
import { Env } from "./env";

//------------------------------------------------------------------------------
// Widget classes
//------------------------------------------------------------------------------

export class Widget<P, S> extends Component<Env, P, S> {
  constructor(parent, props) {
    super(parent, props);
    (<any>this.__widget__).isMobile = this.env.isMobile;
  }
  async updateProps(nextProps: P): Promise<void> {
    if ((<any>this.__widget__).isMobile !== this.env.isMobile) {
      (<any>this.__widget__).isMobile = this.env.isMobile;
      return this._updateProps(nextProps);
    }
    return super.updateProps(nextProps);
  }
}

export class PureWidget<P, S> extends Widget<P, S> {
  shouldUpdate(nextProps: P): boolean {
    for (let k in nextProps) {
      if (nextProps[k] !== this.props[k]) {
        return true;
      }
    }
    return false;
  }
  async updateState(nextState: Partial<S>) {
    for (let k in nextState) {
      if (nextState[k] !== this.state[k]) {
        return super.updateState(nextState);
      }
    }
  }
}
