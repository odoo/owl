import { templates } from "../../assets/templates.js";
import { getOwlStatus } from "../utils.js";
const { Component, useState, onWillStart, mount, App } = owl;

class PopUpApp extends Component {
  static template = "popup.PopUpApp";

  setup() {
    this.state = useState({ status: 0 });
    onWillStart(async () => {
      this.state.status = await getOwlStatus();
    });
  }
}

for (const template in templates) {
  App.registerTemplate(template, templates[template]);
}
mount(PopUpApp, document.body, { dev: true });
