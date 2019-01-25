import { Widget } from "../core/widget";
import { Env } from "../env";

const template = `<div class="o_clock"><t t-esc="state.currentTime"/></div>`;

export class Clock extends Widget<Env> {
  name = "clock";
  template = template;
  state = {
    currentTime: ""
  };

  async willStart() {
    this.updateTime();
  }

  mounted() {
    setInterval(this.updateTime.bind(this), 500);
  }

  updateTime() {
    this.updateState({
      currentTime: new Date().toLocaleTimeString()
    });
  }
}
