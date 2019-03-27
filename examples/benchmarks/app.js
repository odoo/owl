import { Message } from "./message.js";
import { messages } from "./data.js";

const template = `
    <div class="main">
        <div class="left-thing">
            <div class="counter">
                <button t-on-click="increment(-1)">-</button>
                <span style="font-weight:bold">Value: <t t-esc="state.messages.length"/></span>
                <button t-on-click="increment(1)">+</button>
            </div>
            <button t-on-click="setMessageCount(10)">10 messages</button>
            <button t-on-click="setMessageCount(20)">20 messages</button>
            <button t-on-click="setMessageCount(500)">500 messages</button>
            <button t-on-click="setMessageCount(1000)">1000 messages</button>
            <button t-on-click="setMessageCount(5000)">5000 messages</button>
            <button t-on-click="setMessageCount(15000)">15000 messages</button>
        </div>
        <div class="right-thing">
            <div class="content">
                <t t-foreach="state.messages" t-as="message">
                    <t t-widget="Message" t-att-key="message.id" t-props="message" t-on-remove_message="removeMessage"/>
                </t>
            </div>
        </div>
    </div>`;

export class App extends owl.core.Component {
  constructor(parent, props) {
    super(parent, props);
    this.inlineTemplate = template;
    this.widgets = { Message };
    this.state = {
      messages: messages.slice(0, 10)
    };
  }

  setMessageCount(n) {
    this.updateState({
      messages: messages.slice(0, n)
    });
  }

  removeMessage(data) {
    const index = messages.findIndex(m => m.id === data.id);
    const n = this.state.messages.length;
    messages.splice(index, 1);
    this.updateState({ messages: messages.slice(0, n - 1) });
  }

  increment(delta) {
    const n = this.state.messages.length + delta;
    this.setMessageCount(n);
  }
}
