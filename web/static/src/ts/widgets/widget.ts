import { BaseWidget } from "../core/base_widget";
import { Env } from "../env";

export class Widget<Props, State> extends BaseWidget<Env, Props, State> {}

// TODO: move this to PureComponent in core
export class PureWidget<Props, State> extends Widget<Props, State> {
  shouldUpdate(nextProps: Props): boolean {
    for (let k in nextProps) {
      if (nextProps[k] !== this.props[k]) {
        return true;
      }
    }
    return false;
  }
  async updateState(nextState: Partial<State>) {
    for (let k in nextState) {
      if (nextState[k] !== this.state[k]) {
        return;
      }
    }
    return super.updateState(nextState);
  }
}
