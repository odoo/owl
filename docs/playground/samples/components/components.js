// In this example, we show how components can be defined and created.
import { Component, useState, mount } from "@odoo/owl";

class Greeter extends Component {
    static template = "Greeter";
    
    setup() {
        this.state = useState({ word: 'Hello' });
    }

    toggle() {
        this.state.word = this.state.word === 'Hi' ? 'Hello' : 'Hi';
    }
}

// Main root component
class Root extends Component {
    static components = { Greeter };
    static template = "Root"

    setup() {
        this.state = useState({ name: 'World'});
    }
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
