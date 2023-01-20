/** @odoo-module **/

import { ComponentsTree } from "./components/components_tree/components_tree";
const { mount, whenReady } = owl

import "../main.css";
import {templates} from "../../assets/templates.js";

for(var template in templates) {
    owl.App.registerTemplate(template, templates[template]);
}
whenReady();
mount(ComponentsTree, document.body, {dev: true});

