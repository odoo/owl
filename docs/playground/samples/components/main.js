import { Component, signal, mount, xml } from "@odoo/owl";

class Counter extends Component {
    static template = xml`
        <div class="counter">
          <span>
            <t t-out="this.count()"/>
          </span>
          <button class="btn" t-on-click="this.increment">+</button>
        </div>`;

    count = signal(0);

    increment() {
        this.count.set(this.count() + 1);
    }
}

class Root extends Component {
    static components = { Counter };
    static template = xml`
        <Counter/>
        <Counter/>`;
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
