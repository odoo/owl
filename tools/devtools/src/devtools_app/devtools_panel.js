/** @odoo-module **/

import { DevtoolsWindow } from "./devtools_window/devtools_window";
import { StorePlugin } from "./store/store";
const { mount } = owl;
import { templates } from "../../assets/templates.js";

for (const template in templates) {
  owl.App.registerTemplate(template, templates[template]);
}
mount(DevtoolsWindow, document.body, { plugins: [StorePlugin] });
