import { Widget } from "../core/widget";
import { Env } from "../env";

interface Props {
  initialState?: number;
}

export class Counter extends Widget<Env, Props> {
  template = "counter";
  state = {
    counter: 0
  };

  constructor(parent: Widget<Env, {}>, props: Props) {
    super(parent, props);
    this.state.counter = props.initialState || 0;
  }

  increment(delta: number) {
    this.updateState({ counter: this.state.counter + delta });
  }
}
