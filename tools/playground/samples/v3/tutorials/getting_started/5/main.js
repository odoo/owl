import { Component, mount, xml } from "@odoo/owl";

class Root extends Component {
    static template = xml`<div>hello owl</div>`;
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
