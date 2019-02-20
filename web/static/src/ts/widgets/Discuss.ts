import { Clock } from "./clock";
import { Counter } from "./counter";
import { Widget } from "./widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

interface State {
  validcounter: boolean;
  color: "red" | "blue";
}

//------------------------------------------------------------------------------
// Discuss
//------------------------------------------------------------------------------

export class Discuss extends Widget<{}, State> {
  template = "web.discuss";
  widgets = { Clock, Counter, ColorWidget };
  state: State = { validcounter: true, color: "red" };

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
    this.env.addNotification({
      title: "hey",
      message: message,
      sticky
    });
  }
}

class ColorWidget extends Widget<{ color: "red" | "blue" }, {}> {
  inlineTemplate = `
    <div t-name="colorwidget">
      <span>Current Color: </span>
      <t t-esc="props.color"/>
    </div>`;
}
