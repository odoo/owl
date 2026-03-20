import { Component, mount, xml } from "@odoo/owl";

class TimeTracker extends Component {
  static template = "TimeTracker";
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
