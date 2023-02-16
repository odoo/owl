/** @odoo-module **/

import { DevtoolsWindow } from "./devtools_window/devtools_window";
const { mount } = owl;

import "../main.css";
import { templates } from "../../assets/templates.js";

// Register the templates in the app
for (var template in templates) {
  owl.App.registerTemplate(template, templates[template]);
}
// Mount the devtools tab root component
mount(DevtoolsWindow, document.body, { dev: true });
