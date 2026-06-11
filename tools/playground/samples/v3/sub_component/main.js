import { Component, mount, signal, props, xml, t } from "@odoo/owl";

class Counter extends Component {
    static template = xml`
        <button t-on-click="this.increment">
          <t t-out="this.label"/>: <t t-out="this.value()"/>
        </button>`;

    // note that the prop is fixed: it cannot change!
    label = props.static("label", t.string());
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
