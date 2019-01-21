import Widget from "../../src/core/widget";
import Counter from "./Counter";
import Navbar from "./Navbar";

const template = `
    <div class="o_web_client">
        <t t-widget="Navbar"/>
        <div class="o_content">
            <span>Root Widget</span>
            <button t-on-click="resetCounter">Reset</button>
            <button t-on-click="resetCounterAsync">Reset in 3s</button>
            <button t-on-click="toggle">Toggle  Counter</button>
            <input/>
            <t t-if="state.validcounter">
                <t t-widget="Counter" t-ref="counter" t-props="{initialState:4}"/>
            </t>
            <t t-else="1">
                <t t-widget="Counter" t-ref="counter" t-props="{initialState:7}"/>
            </t>
            <div ref="target"/>
        </div>
    </div>
`;

export default class RootWidget extends Widget {
  name = "root";
  template = template;
  widgets = { Counter, Navbar };
  state = { validcounter: true};

  resetCounter(ev: MouseEvent) {
      this.refs.counter.updateState({counter: 3})
  }

  resetCounterAsync(ev: MouseEvent) {
      setTimeout(() => {
          this.refs.counter.updateState({counter: 3})
      }, 3000);
  }

  toggle() {
      this.updateState({validcounter: !this.state.validcounter});
  }
}
