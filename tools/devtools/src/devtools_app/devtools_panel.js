/** @odoo-module **/

import { DevtoolsWindow } from "./devtools_window/devtools_window";
const { mount } = owl;

import "../main.css";
import { templates } from "../../assets/templates.js";

for (var template in templates) {
  owl.App.registerTemplate(template, templates[template]);
}
mount(DevtoolsWindow, document.body, { dev: true });
