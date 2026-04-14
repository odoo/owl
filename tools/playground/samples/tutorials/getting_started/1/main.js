import { Component, mount, xml } from "@odoo/owl";

class Counter extends Component {
    static template = xml`<div>hello owl</div>`;
}

mount(Counter, document.body, { templates: TEMPLATES, dev: true });
