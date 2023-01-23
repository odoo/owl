import { PopUpApp } from "./components/popup_app";
import { templates } from "../../assets/templates.js";
const { whenReady, mount, App } = owl;
import "../main.css";

const init = () => {
  (async () => {
    await whenReady();
    for(var template in templates) {
      App.registerTemplate(template, templates[template]);
    }
    await mount(PopUpApp, document.body, {dev: true});
  })();
};

window.onload = init;
