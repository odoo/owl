import { Widget } from "../core/widget";
import { Env } from "../env";
import { Clock } from "./clock";
import { Counter } from "./counter";

const template = `
    <div class="o_discuss">
        <span>DISCUSS!!</span>
        <button t-on-click="resetCounter">Reset first counter</button>
        <button t-on-click="resetCounterAsync">Reset counter 2 in 3s</button>
        <button t-on-click="toggle">Toggle  Clock/counters</button>
        <input/>
        <t t-if="state.validcounter">
            <t t-widget="Counter" t-ref="counter" t-props="{initialState:4}"/>
            <t t-widget="Counter" t-ref="counter2" t-props="{initialState:400}"/>
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
      if (this.refs.counter2 instanceof Counter) {
        this.refs.counter2.updateState({ counter: 300 });
      }
    }, 3000);
  }

  toggle() {
    this.updateState({ validcounter: !this.state.validcounter });
  }
}
