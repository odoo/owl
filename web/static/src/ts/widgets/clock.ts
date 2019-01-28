import { Widget } from "../core/widget";
import { Env } from "../env";

const template = `<div class="o_clock"><t t-esc="state.currentTime"/></div>`;

export class Clock extends Widget<Env, {}> {
  name = "clock";
  template = template;
  interval: any | undefined;

  state = {
    currentTime: ""
  };

  async willStart() {
    this.updateTime();
  }

  mounted() {
    this.interval = setInterval(this.updateTime.bind(this), 500);
  }

  willUnmount() {
    clearInterval(this.interval);
  }
  updateTime() {
    this.updateState({
      currentTime: new Date().toLocaleTimeString()
    });
  }
}
