import { templates } from "../../assets/templates.js";
import { getOwlStatus } from "../utils";
const { Component, useState, onWillStart, mount, App } = owl;

class PopUpApp extends Component {
  static template = "popup.PopUpApp";

  setup() {
    this.state = useState({ status: 0 });
    onWillStart(async () => {
      try {
        this.state.status = await getOwlStatus();
      } catch (e) {
        this.state.status = -1;
      }
    });
  }
}

for (const template in templates) {
  App.registerTemplate(template, templates[template]);
}
mount(PopUpApp, document.body, { dev: true });
