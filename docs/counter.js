import { Component, signal, mount, xml } from "@odoo/owl";

class Counter extends Component {
  static template = xml`
    <div class="counter">
      <button t-on-click="this.decrement">-</button>
      <span t-out="this.count()"/>
      <button t-on-click="this.increment">+</button>
    </div>`;

  count = signal(0);

  increment() {
    this.count.set(this.count() + 1);
  }
  decrement() {
    this.count.set(this.count() - 1);
  }
}

mount(Counter, document.getElementById("app-container"));
