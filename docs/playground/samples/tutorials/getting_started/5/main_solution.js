import { Component, mount, xml } from "@odoo/owl";
import { Timer } from "./timer";

class Root extends Component {
    static components = { Timer };
    static template = xml`
      <div class="root">
        <div>Timer (+1): <Timer increment="1"/></div>
        <div>Timer (+2): <Timer increment="2"/></div>
      </div>`;
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
