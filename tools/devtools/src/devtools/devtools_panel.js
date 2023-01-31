/** @odoo-module **/

import { DevtoolsWindow } from "./components/devtools_window";
const { mount, whenReady } = owl

import "../main.css";
import {templates} from "../../assets/templates.js";

for(var template in templates) {
    owl.App.registerTemplate(template, templates[template]);
}
whenReady();
mount(DevtoolsWindow, document.body, {dev: true});

