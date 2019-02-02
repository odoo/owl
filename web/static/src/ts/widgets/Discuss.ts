import { Widget } from "../core/widget";
import { Env } from "../env";
import { Clock } from "./clock";
import { Counter } from "./counter";

export class Discuss extends Widget<Env, {}> {
  template = "discuss";
  widgets = { Clock, Counter, ColorWidget };
  state = { validcounter: true, color: "red" };

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

  addNotif(sticky: boolean) {
    const text = (<any>this.refs.textinput).value;
    const message = `It is now ${new Date().toLocaleTimeString()}.<br/> Msg: ${text}`;
    this.env.notifications.add({ title: "hey", message: message, sticky });
  }
}

class ColorWidget extends Widget<Env, { color: "red" | "blue" }> {
  template = "colorwidget";
}
