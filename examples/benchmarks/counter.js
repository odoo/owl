export class Counter extends owl.core.Component {
  inlineTemplate = `
    <div>
      <button t-on-click="increment(-1)">-</button>
      <span style="font-weight:bold">Value: <t t-esc="state.counter"/></span>
      <button t-on-click="increment(1)">+</button>
    </div>`;
  constructor(parent, props) {
    super(parent, props);
    this.state = {
      counter: props.initialState || 0
    };
  }

  increment(delta) {
    this.updateState({ counter: this.state.counter + delta });
  }
}
