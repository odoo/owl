# Component

Components are the reusable, composable widgets. They are designed to be low
level, to be declarative, and with asynchronous rendering.

For example:

```javascript
export class Counter extends Component {
  inlineTemplate = `
    <div t-name="counter">
      <button t-on-click="increment(-1)">-</button>
      <span style="font-weight:bold">Value: <t t-esc="state.counter"/></span>
      <button t-on-click="increment(1)">+</button>
    </div>`;

  state = {
    counter: 0
  };

  constructor(parent, props) {
    super(parent, props);
    this.state.counter = props.initialState || 0;
  }

  increment(delta) {
    this.setState({ counter: this.state.counter + delta });
  }
}
```
