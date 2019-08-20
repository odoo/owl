import { buildData, startMeasure, stopMeasure, formatNumber } from "../shared/utils.js";

//------------------------------------------------------------------------------
// Likes Counter Widget
//------------------------------------------------------------------------------
class Counter extends owl.Component {
  state = { counter: 0 };

  increment() {
    this.state.counter++;
  }
}

//------------------------------------------------------------------------------
// Message Widget
//------------------------------------------------------------------------------
class Message extends owl.Component {
  components = { Counter };

  shouldUpdate(nextProps) {
    return nextProps.message !== this.props.message;
  }
  removeMessage() {
    this.trigger("remove-message", {
      id: this.props.message.id
    });
  }
}

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------
class App extends owl.Component {
  components = { Message };
  state = { messages: [], multipleFlag: false, clearAfterFlag: false };

  mounted() {
    this.log(`Benchmarking Owl v${owl.__info__.version} (build date: ${owl.__info__.date})`);
  }

  benchmark(message, fn, callback) {
    if (this.state.multipleFlag) {
      const N = 20;
      let n = N;
      let total = 0;
      let cb = info => {
        let finalize = () => {
          n--;
          total += info.delta;
          if (n === 0) {
            const avg = total / N;
            this.log(`Average: ${formatNumber(avg)}ms`, true);
            if (callback) {
              callback();
            }
          } else {
            this._benchmark(message, fn, cb);
          }
        };

        if (this.state.clearAfterFlag) {
          this._benchmark(
            "clear",
            () => {
              this.state.messages = [];
            },
            finalize,
            false
          );
        } else {
          finalize();
        }
      };
      this._benchmark(message, fn, cb);
    } else {
      this._benchmark(message, fn, callback);
    }
  }

  _benchmark(message, fn, cb, log = true) {
    setTimeout(() => {
      startMeasure(message);
      fn();
      stopMeasure(info => {
        if (log) {
          this.log(info.msg);
        }
        if (cb) {
          cb(info);
        }
      });
    }, 10);
  }

  addMessages(n) {
    this.benchmark("add " + n, () => {
      const newMessages = buildData(n);
      this.state.messages.push.apply(this.state.messages, newMessages);
    });
  }

  clear() {
    this._benchmark("clear", () => {
      this.state.messages = [];
    });
  }

  updateSomeMessages() {
    this.benchmark("update every 10th", () => {
      const setState = owl.core.Observer.set;
      const messages = this.state.messages;
      for (let i = 0; i < messages.length; i += 10) {
        const msg = Object.assign({}, messages[i]);
        msg.author += "!!!";
        setState(messages, i, msg);
      }
    });
  }

  removeMessage(event) {
    this.benchmark("remove message", () => {
      const index = this.state.messages.findIndex(m => m.id === event.detail.id);
      this.state.messages.splice(index, 1);
    });
  }

  log(str, isBold) {
    const div = document.createElement("div");
    if (isBold) {
      div.classList.add("bold");
    }
    div.textContent = `> ${str}`;
    this.refs.log.appendChild(div);
    this.refs.log.scrollTop = this.refs.log.scrollHeight;
  }

  clearLog() {
    this.refs.log.innerHTML = "";
  }
}

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
async function start() {
  const templates = await owl.utils.loadTemplates("templates.xml");
  const env = {
    qweb: new owl.QWeb(templates)
  };
  const app = new App(env);
  app.mount(document.body);
}

start();
