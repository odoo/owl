import { PopUpApp } from "./components/popup_app";
import { templates } from "../../assets/templates.js";
const { whenReady, mount, App } = owl;
import "../main.css";


for(var template in templates) {
  App.registerTemplate(template, templates[template]);
}
whenReady();
mount(PopUpApp, document.body, {dev: true});
