import { Component, mount, xml, signal } from "@odoo/owl";
import { Dialog } from "./dialog";

class Counter extends Component {
    static template = xml`<button t-on-click="this.increment" t-out="this.value()"/>`;
    value = signal(0);

    increment() {
        this.value.set(this.value() + 1);
    }
}

// Main root component
class Root extends Component {
  static components = { Dialog, Counter };
  static template = xml`
      <button t-on-click="() => this.toggle(true)">Show Dialog</button>
      <t t-if="this.showDialog()">
          <Dialog title="'Hello'" onClose="() => this.toggle(false)">
            <p> some content here </p>
            <p> even a component: <Counter /></p>
          </Dialog>
        </t>`;

    showDialog = signal(false);

    toggle(isVisible) {
        this.showDialog.set(isVisible)
    }
}

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true});
