import { Component, mount, xml } from "@odoo/owl";
import { Timer } from "./timer";

class Root extends Component {
    static components = { Timer };
    static template = xml`
      <div style="padding: 20px;">
        <h3>Timer (+1)</h3>
        <Timer increment="1"/>
        <h3>Timer (+2)</h3>
        <Timer increment="2"/>
      </div>`;
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
