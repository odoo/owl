import { templates } from "../../assets/templates.js";
import { getOwlStatus } from "../utils";
const { Component, signal, onWillStart, mount, App } = owl;

class PopUpApp extends Component {
  static template = "popup.PopUpApp";

  setup() {
    this.status = signal(0);
    onWillStart(async () => {
      try {
        this.status.set(await getOwlStatus());
      } catch (e) {
        this.status.set(-1);
      }
    });
  }
}

for (const template in templates) {
  App.registerTemplate(template, templates[template]);
}
mount(PopUpApp, document.body, { dev: true });
