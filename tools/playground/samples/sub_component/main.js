// Composition: a parent renders two Counter sub-components.
// Each Counter holds its own state and receives a label via props.
// Try: add a third Counter, or pass a dynamic label from a Root signal.
import { Component, mount, signal, xml } from "@odoo/owl";

class Counter extends Component {
  static template = xml`
    <button t-on-click="this.increment">
      <t t-out="this.props.label"/>: <t t-out="this.value()"/>
    </button>`;

  value = signal(0);

  increment() {
    this.value.set(this.value() + 1);
  }
}

class Root extends Component {
  static components = { Counter };
  static template = xml`
    <Counter label="'Apples'"/>
    <Counter label="'Bananas'"/>`;
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
