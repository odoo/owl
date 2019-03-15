import { Widget } from "../widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

interface State {
  currentTime: string;
}

//------------------------------------------------------------------------------
// Clock
//------------------------------------------------------------------------------

export class Clock extends Widget<{}, State> {
  inlineTemplate = `<div class="o_clock"><t t-esc="state.currentTime"/></div>`;
  timeout: any | undefined;

  state = {
    currentTime: ""
  };

  willStart() {
    return this.env.rpc({ model: "res.partner", method: "fetch" });
  }
  mounted() {
    this.updateTime();
    this.startClock();
  }

  willUnmount() {
    clearTimeout(this.timeout);
  }

  updateTime() {
    this.setState({ currentTime: new Date().toLocaleTimeString() });
  }

  startClock() {
    const now = Date.now();
    const offset = 1000 - (now % 1000);
    this.timeout = setTimeout(() => {
      this.updateTime();
      this.startClock();
    }, offset);
  }
}
