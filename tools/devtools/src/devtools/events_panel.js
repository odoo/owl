/** @odoo-module **/

import { Events } from "./components/events/events";
const { mount, whenReady } = owl

import "../main.css";
import {templates} from "../../assets/templates.js";

for(var template in templates) {
    owl.App.registerTemplate(template, templates[template]);
}
whenReady();
mount(Events, document.body, {dev: true});
