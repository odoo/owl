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
        <button t-on-click="toggleColor">Toggle Color</button>
        <button t-on-click="updateState({})">Rerender this widget</button>
        <input/>
        <t t-if="state.validcounter">
            <t t-widget="Counter" t-ref="counter" t-props="{initialState:4}"/>
            <t t-widget="Counter" t-ref="counter2" t-props="{initialState:400}"/>
        </t>
        <t t-else="1">
            <t t-widget="Clock"/>
        </t>
        <t t-widget="ColorWidget" t-props="{color: state.color}"/>
    </div>
`;

export class Discuss extends Widget<Env> {
  name = "discuss";
  template = template;
  widgets = { Clock, Counter, ColorWidget };
  state = { validcounter: true, color: "red" };

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

  toggleColor() {
    const newColor = this.state.color === "red" ? "blue" : "red";
    this.updateState({ color: newColor });
  }
}

class ColorWidget extends Widget<Env> {
  name = "colorwidget";
  template = `<div>Current Color: <t t-esc="state.color"/></div>`;
  state: { color: "red" | "blue" };
  constructor(parent: Widget<Env>, props: { color: "red" | "blue" }) {
    super(parent);
    this.state = { color: props.color };
  }
}
