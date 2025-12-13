// In this example, we show how components can be defined and created.
import { Component, signal, mount } from "@odoo/owl";

class Counter extends Component {
    static template = "Counter";
    
    count = signal(0);
    
    increment() {
        this.count.update(val => val + 1);
    }
}

class Root extends Component {
    static components = { Counter };
    static template = "Root"
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
