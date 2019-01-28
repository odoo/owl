import { Widget } from "../core/widget";
import { Env } from "../env";

const template = `
    <div>
        <button t-on-click="increment(-1)">-</button>
        <span style="font-weight:bold">Value: <t t-esc="state.counter"/></span>
        <button t-on-click="increment(1)">+</button>
    </div>
`;

interface Props {
  initialState?: number;
}

export class Counter extends Widget<Env, Props> {
  name = "counter";
  template = template;
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
