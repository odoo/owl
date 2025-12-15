import { Component, signal, mount, proxy, computed, props } from "@odoo/owl";

class Counter extends Component {
    static template = "Counter";

    props = props({ count: Function });

    increment() {
        this.props.count.update((val) => val + 1);
    }
}

class Root extends Component {
    static components = { Counter };
    static template = "Root";

    counters = proxy([signal(1), signal(2)]);
    sum = computed(() => this.counters.reduce((acc, value) => acc + value(), 0));

    addCounter() {
        this.counters.push(signal(0));
    }
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
