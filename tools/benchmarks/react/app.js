import {
  buildData,
  startMeasure,
  stopMeasure,
  formatNumber
} from "../shared/utils.js";

//------------------------------------------------------------------------------
// Counter Widget
//------------------------------------------------------------------------------
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      counter: 0
    };
    this.increment = this.increment.bind(this);
  }

  render() {
    return React.createElement(
      "div",
      null,
      React.createElement(
        "button",
        {
          onClick: this.increment
        },
        "Value: ",
        this.state.counter
      )
    );
  }

  increment() {
    this.setState({
      counter: this.state.counter + 1
    });
  }
}
//------------------------------------------------------------------------------
// Message Widget
//------------------------------------------------------------------------------
class Message extends React.Component {
  constructor(props) {
    super(props);
    this.removeMessage = this.removeMessage.bind(this);
  }

  render() {
    return React.createElement(
      "div",
      {
        className: "message"
      },
      React.createElement(
        "span",
        {
          className: "author"
        },
        this.props.message.author
      ),
      React.createElement(
        "span",
        {
          className: "msg"
        },
        this.props.message.msg
      ),
      React.createElement(
        "button",
        {
          className: "remove",
          onClick: this.removeMessage
        },
        "Remove"
      ),
      React.createElement(Counter, null)
    );
  }

  removeMessage() {
    this.props.removeCB(this.props.message.id);
  }
}

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------
class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      messages: [],
      multipleFlag: false,
      clearAfterFlag: false
    };
    this.removeMessage = this.removeMessage.bind(this);
    this.toggleMultipleFlag = this.toggleMultipleFlag.bind(this);
    this.toggleClearAfterFlag = this.toggleClearAfterFlag.bind(this);
  }

  componentDidMount() {
    this.log(`Benchmarking React v${React.version}`);
  }
  log(str, isBold) {
    const div = document.createElement("div");
    if (isBold) {
      div.classList.add("bold");
    }
    div.textContent = `> ${str}`;
    this.refs.logref.appendChild(div);
    this.refs.logref.scrollTop = this.refs.logref.scrollHeight;
  }

  toggleMultipleFlag() {
    this.setState({ multipleFlag: !this.state.multipleFlag });
  }
  toggleClearAfterFlag() {
    this.setState({ clearAfterFlag: !this.state.clearAfterFlag });
  }

  render() {
    const msgList = this.state.messages.map(m =>
      React.createElement(Message, {
        key: m.id,
        message: m,
        removeCB: this.removeMessage
      })
    );
    return React.createElement(
      "div",
      {
        className: "main"
      },
      React.createElement(
        "div",
        {
          className: "left-thing"
        },
        React.createElement("div", { className: "title" }, "Actions"),
        React.createElement(
          "div",
          { className: "panel" },
          React.createElement(
            "button",
            {
              onClick: _ => this.addMessages(100)
            },
            "Add 100 messages"
          ),
          React.createElement(
            "button",
            {
              onClick: _ => this.addMessages(1000)
            },
            "Add 1k messages"
          ),
          React.createElement(
            "button",
            {
              onClick: _ => this.addMessages(10000)
            },
            "Add 10k messages"
          ),
          React.createElement(
            "button",
            {
              onClick: _ => this.addMessages(30000)
            },
            "Add 30k messages"
          ),
          React.createElement(
            "button",
            {
              onClick: _ => this.updateSomeMessages()
            },
            "Update every 10th message"
          ),
          React.createElement(
            "button",
            {
              onClick: _ => this.clear()
            },
            "Clear"
          )
        ),
        React.createElement(
          "div",
          { className: "flags" },
          React.createElement(
            "div",
            null,
            React.createElement("input", {
              type: "checkbox",
              id: "multipleFlag",
              value: this.state.multipleFlag,
              onChange: this.toggleMultipleFlag
            }),
            React.createElement("label", { for: "multipleFlag" }, " Do it 20x")
          ),
          React.createElement(
            "div",
            null,
            React.createElement("input", {
              type: "checkbox",
              id: "clearFlag",
              value: this.state.clearAfterFlag,
              onChange: this.toggleClearAfterFlag
            }),
            React.createElement("label", { for: "clearFlag" }, " Clear after")
          )
        ),
        React.createElement(
          "div",
          { className: "info" },
          "Number of messages: ",
          this.state.messages.length
        ),
        React.createElement("hr"),
        React.createElement(
          "div",
          { className: "title" },
          "Log ",
          React.createElement("span", { className: "clear-log" }, "(clear)")
        ),
        React.createElement(
          "div",
          { className: "log" },
          React.createElement("div", {
            className: "log-content",
            ref: "logref"
          })
        )
      ),
      React.createElement(
        "div",
        {
          className: "right-thing"
        },
        React.createElement(
          "div",
          {
            className: "content"
          },
          msgList
        )
      )
    );
  }

  addMessages(n) {
    this.benchmark("add " + n, () => {
      const newMessages = this.state.messages.concat(buildData(n));
      this.setState({
        messages: newMessages
      });
    });
  }

  clear() {
    this._benchmark("clear", () => {
      this.setState({
        messages: []
      });
    });
  }

  updateSomeMessages() {
    this.benchmark("update every 10th", () => {
      const messages = this.state.messages;
      for (let i = 0; i < messages.length; i += 10) {
        messages[i].author += "!!!";
      }
      this.forceUpdate();
    });
  }

  removeMessage(id) {
    startMeasure("remove message");
    const index = this.state.messages.findIndex(m => m.id === id);
    const messages = this.state.messages.slice();
    messages.splice(index, 1);
    this.setState({
      messages
    });
    stopMeasure();
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
              this.setState({ messages: [] });
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
} //-----------------------------
// INIT
//-----------------------------

ReactDOM.render(React.createElement(Main, null), document.body);
