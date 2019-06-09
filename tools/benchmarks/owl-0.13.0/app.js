import { buildData, startMeasure, stopMeasure } from "../shared/utils.js";

//------------------------------------------------------------------------------
// Likes Counter Widget
//------------------------------------------------------------------------------
class Counter extends owl.Component {
  template = "counter";
  state = { counter: 0 };

  increment() {
    this.state.counter++;
  }
}

//------------------------------------------------------------------------------
// Message Widget
//------------------------------------------------------------------------------
class Message extends owl.Component {
  template = "message";
  widgets = { Counter };

  shouldUpdate(nextProps) {
    return nextProps.message !== this.props.message;
  }
  removeMessage() {
    this.trigger("remove_message", {
      id: this.props.id
    });
  }
}

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------
class App extends owl.Component {
  template = "root";
  widgets = { Message };
  state = { messages: [] };

  addMessages(n) {
    startMeasure("add " + n);
    const newMessages = buildData(n);
    this.state.messages.push.apply(this.state.messages, newMessages);
    stopMeasure();
  }

  clear() {
    startMeasure("clear");
    this.state.messages = [];
    stopMeasure();
  }

  updateSomeMessages() {
    startMeasure("update every 10th");
    const messages = this.state.messages;
    for (let i = 0; i < this.state.messages.length; i += 10) {
      const msg = Object.assign({}, messages[i]);
      msg.author += "!!!";
      this.set(messages, i, msg);
    }
    stopMeasure();
  }

  removeMessage(data) {
    startMeasure("remove message");
    const index = this.state.messages.findIndex(m => m.id === data.id);
    this.state.messages.splice(index, 1);
    stopMeasure();
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
