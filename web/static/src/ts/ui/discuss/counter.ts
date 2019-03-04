import { Widget } from "../widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

interface Props {
  initialState?: number;
}

interface State {
  counter: number;
}

//------------------------------------------------------------------------------
// Counter
//------------------------------------------------------------------------------

export class Counter extends Widget<Props, State> {
  inlineTemplate = `
    <div t-name="counter">
      <button t-on-click="increment(-1)">-</button>
      <span style="font-weight:bold">Value: <t t-esc="state.counter"/></span>
      <button t-on-click="increment(1)">+</button>
    </div>`;

  state = {
    counter: 0
  };

  constructor(parent: Widget<any, any>, props: Props) {
    super(parent, props);
    this.state.counter = props.initialState || 0;
  }

  increment(delta: number) {
    this.updateState({ counter: this.state.counter + delta });
  }
}
