import { Message } from "./message.js";
import { messages } from "./data.js";

const template = `
    <div class="main">
        <div class="left-thing">
            <button t-on-click="setMessageCount(10)">10 messages</button>
            <button t-on-click="setMessageCount(200)">200 messages</button>
            <button t-on-click="setMessageCount(500)">500 messages</button>
            <button t-on-click="setMessageCount(5000)">5000 messages</button>
        </div>
        <div class="right-thing">
            <div class="content">
                <t t-foreach="state.messages" t-as="message">
                    <t t-widget="Message" t-props="message" t-on-remove_message="removeMessage"/>
                </t>
            </div>
        </div>
    </div>`;

export class App extends odoo.core.Component {
  constructor(parent, props) {
    super(parent, props);
    this.inlineTemplate = template;
    this.widgets = { Message };
    this.state = {
      messages: messages.slice(0, 10)
    };
  }

  setMessageCount(n) {
    this.setState({
      messages: messages.slice(0, n)
    });
  }

  removeMessage(data) {
    const index = this.state.messages.findIndex(m => m.id === data.id);
    this.state.messages.splice(index, 1);
    this.setState({ messages: this.state.messages });
  }
}
