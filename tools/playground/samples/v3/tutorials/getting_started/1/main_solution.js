import { Component, mount, xml, signal } from "@odoo/owl";

class Counter extends Component {
    static template = xml`
      <div>
        <h2>Counter</h2>
        <p class="count">Count: <strong><t t-out="this.count()"/></strong></p>
        <div class="buttons">
          <button t-on-click="this.decrement">-</button>
          <button t-on-click="this.increment">+</button>
        </div>
      </div>`;

    count = signal(0);

    increment() {
        this.count.set(this.count() + 1);
    }

    decrement() {
        this.count.set(this.count() - 1);
    }
}

mount(Counter, document.body, { templates: TEMPLATES, dev: true });
