import { Component, PureComponent } from "./core/component";
import { Env } from "./env";

//------------------------------------------------------------------------------
// Widget classes
//------------------------------------------------------------------------------

export class Widget<Props, State> extends Component<Env, Props, State> {}

export class PureWidget<P, S> extends PureComponent<Env, P, S> {
  constructor(parent, props) {
    super(parent, props);
    (<any>this.__widget__).isMobile = this.env.isMobile;
  }
  shouldUpdate(nextProps: P): boolean {
    if ((<any>this.__widget__).isMobile !== this.env.isMobile) {
      (<any>this.__widget__).isMobile = this.env.isMobile;
      return true;
    }
    return super.shouldUpdate(nextProps);
  }
}
