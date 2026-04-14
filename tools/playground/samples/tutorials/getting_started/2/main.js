import { Component, mount, xml } from "@odoo/owl";
import { Counter } from "./counter";

class Root extends Component {
    static components = { Counter };
    static template = xml`
      <Counter />
      <Counter />`
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
