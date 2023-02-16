import { PopUpApp } from "./components/popup_app";
import { templates } from "../../assets/templates.js";
const { mount, App } = owl;

for (var template in templates) {
  App.registerTemplate(template, templates[template]);
}
mount(PopUpApp, document.body, { dev: true });
