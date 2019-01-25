import { Widget } from "../core/widget";
import { Env } from "../env";
import { Clock } from "./clock";
import { Counter } from "./counter";

const template = `
    <div class="o_discuss">
        <span>DISCUSS!!</span>
        <button t-on-click="resetCounter">Reset</button>
        <button t-on-click="resetCounterAsync">Reset in 3s</button>
        <button t-on-click="toggle">Toggle  Counter</button>
        <input/>
        <t t-if="state.validcounter">
            <t t-widget="Counter" t-ref="counter" t-props="{initialState:4}"/>
        </t>
        <t t-else="1">
            <t t-widget="Clock"/>
        </t>
        <div ref="target"/>
    </div>
`;

export class Discuss extends Widget<Env> {
  name = "discuss";
  template = template;
  widgets = { Clock, Counter };
  state = { validcounter: true };

  mounted() {}
  resetCounter(ev: MouseEvent) {
    if (this.refs.counter instanceof Counter) {
      this.refs.counter.updateState({ counter: 3 });
    }
  }

  resetCounterAsync(ev: MouseEvent) {
    setTimeout(() => {
      if (this.refs.counter instanceof Counter) {
        this.refs.counter.updateState({ counter: 3 });
      }
    }, 3000);
  }

  toggle() {
    if (this.refs.counter instanceof Counter) {
      this.updateState({ validcounter: !this.state.validcounter });
    }
  }
}
