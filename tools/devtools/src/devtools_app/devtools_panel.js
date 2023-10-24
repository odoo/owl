/** @odoo-module **/

import { DevtoolsWindow } from "./devtools_window/devtools_window";
const { mount } = owl;
import { templates } from "../../assets/templates.js";
import { createStore } from "./store/store";

for (const template in templates) {
  owl.App.registerTemplate(template, templates[template]);
}
createStore();
mount(DevtoolsWindow, document.body, { dev: true });
