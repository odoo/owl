import { Component, mount, signal, xml } from "@odoo/owl";
import { ChatWindow } from "./chat_window";
import { useLog } from "./helpers";

class Root extends Component {
  static components = { ChatWindow };
  static template = xml`
        <p>Open the console to see the lifecycle events</p>
        <button t-on-click="this.toggle">Toggle Chat</button>
        <t t-if="this.isOpen()">
            <ChatWindow/>
        </t>`;

  isOpen = signal(false);

  setup() {
    useLog("Root");
  }

  toggle() {
    this.isOpen.set(!this.isOpen());
  }
}
mount(Root, document.body, { templates: TEMPLATES, dev: true });
