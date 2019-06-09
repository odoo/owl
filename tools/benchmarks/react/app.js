import { buildData, startMeasure, stopMeasure } from "../shared/utils.js";

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
      messages: []
    };
    this.removeMessage = this.removeMessage.bind(this);
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
        React.createElement(
          "div",
          null,
          "Number of msg: ",
          this.state.messages.length
        ),
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
          "Add 1000 messages"
        ),
        React.createElement(
          "button",
          {
            onClick: _ => this.addMessages(10000)
          },
          "Add 10000 messages"
        ),
        React.createElement(
          "button",
          {
            onClick: _ => this.addMessages(50000)
          },
          "Add 50000 messages"
        ),
        React.createElement(
          "button",
          {
            onClick: _ => this.updateSomeMessages()
          },
          "Update every 10th messags"
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
    startMeasure("add " + n);
    const newMessages = this.state.messages.concat(buildData(n));
    this.setState({
      messages: newMessages
    });
    stopMeasure();
  }

  clear() {
    startMeasure("clear");
    this.setState({
      messages: []
    });
    stopMeasure();
  }

  updateSomeMessages() {
    startMeasure("update every 10th");
    const messages = this.state.messages;
    for (let i = 0; i < messages.length; i += 10) {
      messages[i].author += "!!!";
    }
    this.forceUpdate();
    stopMeasure();
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
} //-----------------------------
// INIT
//-----------------------------

ReactDOM.render(
  React.createElement(Main, null),
  document.getElementById("main")
);
